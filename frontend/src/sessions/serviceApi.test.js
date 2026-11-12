import { afterEach, describe, expect, it, vi } from 'vitest'
import { installerFauxBackend, repondre } from './fauxBackend'
import { MSG_DATES, verifierInformations } from './regles'
import * as api from './serviceApi'

afterEach(() => vi.unstubAllGlobals())

const FORM = { formation: '2', debut: '2026-11-18', fin: '2026-11-20', heureDebut: '09:00', heureFin: '17:00', duree: '21,5', places: '10', modalite: 'PRESENTIEL', lieu: ' Lyon ', lien: 'ignoré' }

describe('service Sessions', () => {
  it('envoie la session au format de l’API (POST /sessions/)', async () => {
    const fetch = installerFauxBackend()
    await api.creerSession(FORM, [4], [1, 2])
    const [url, options] = fetch.mock.calls[0]
    expect(url).toBe('/api/sessions/')
    expect(JSON.parse(options.body)).toEqual({
      formation: 2, date_debut: '2026-11-18', date_fin: '2026-11-20', heure_debut: '09:00', heure_fin: '17:00', duree_heures: '21.5',
      modalite: 'PRESENTIEL', lieu: 'Lyon', lien_classe_virtuelle: '', nombre_places: 10, formateurs: [4], apprenants: [1, 2],
    })
  })

  it('envoie le cookie de connexion : le backend ne renvoie que les données du compte', async () => {
    const fetch = installerFauxBackend()
    await api.listerSessions()
    await api.creerSession(FORM, [4], [1])
    expect(fetch.mock.calls.map(([, options]) => options.credentials)).toEqual(['include', 'include'])
  })

  it('envoie le lien pour une classe virtuelle', async () => {
    const fetch = installerFauxBackend()
    await api.creerSession({ ...FORM, modalite: 'CLASSE_VIRTUELLE', lien: ' https://visio ' }, [4], [1])
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ lieu: '', lien_classe_virtuelle: 'https://visio' })
  })

  it('reprend la durée des formations', async () => {
    installerFauxBackend()
    const formations = await api.listerFormations()
    expect(formations).toContainEqual({ id: 3, intitule: 'Anglais professionnel', duree: '' })
    expect(formations[0].duree).toBe('14')
  })

  it('traduit les erreurs du backend', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => repondre(400, { code: 'FORMATEUR_REQUIS', detail: 'Une session doit avoir au moins un formateur' })))
    await expect(api.creerSession(FORM, [], [1])).rejects.toMatchObject({ code: 'FORMATEUR_REQUIS', message: 'Une session doit avoir au moins un formateur' })
    vi.stubGlobal('fetch', vi.fn(async () => repondre(400, { lieu: ['Ce champ est obligatoire.'] })))
    await expect(api.creerSession(FORM, [1], [1])).rejects.toMatchObject({ code: 'VALIDATION', champs: { lieu: ['Ce champ est obligatoire.'] } })
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('réseau') }))
    await expect(api.listerSessions()).rejects.toMatchObject({ code: 'RESEAU' })
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, json: async () => { throw new Error('pas du JSON') } })))
    await expect(api.listerSessions()).rejects.toMatchObject({ code: 'VALIDATION', champs: {} })
  })

  it('met en forme les dates et les heures', () => {
    expect(api.periode({ date_debut: '2026-11-18', date_fin: '2026-11-20', heure_debut: '09:00:00', heure_fin: '17:30' })).toBe('Du 18/11/2026 au 20/11/2026 · 09 h – 17 h 30')
    expect(api.periode({ date_debut: '2026-11-18', date_fin: '2026-11-18', heure_debut: null, heure_fin: null })).toBe('Du 18/11/2026 au 18/11/2026')
    expect(api.heureFr('')).toBe('')
    expect(api.dateFr('')).toBe('')
    expect([api.moisCourt('2026-11-08'), api.jour('2026-11-08')]).toEqual(['NOV.', '8'])
    expect(api.initiales({ prenom: 'léa', nom: 'moreau' })).toBe('LM')
  })
})

describe('règles de l’étape 1', () => {
  it('signale chaque champ obligatoire manquant', () => {
    const e = verifierInformations({ formation: '', debut: '', fin: '', heureDebut: '', heureFin: '', duree: '', places: '', modalite: 'PRESENTIEL', lieu: ' ', lien: '' })
    expect(Object.keys(e).sort()).toEqual(['debut', 'duree', 'fin', 'formation', 'heureDebut', 'heureFin', 'lieu', 'places'])
    expect(verifierInformations({ ...FORM, modalite: 'CLASSE_VIRTUELLE', lien: '' })).toEqual({ lien: 'Ce champ est obligatoire.' })
    // Sans modalité choisie : seule la modalité est signalée, ni le lieu ni le lien
    expect(verifierInformations({ ...FORM, modalite: '', lieu: '', lien: '' })).toEqual({ modalite: 'Ce champ est obligatoire.' })
  })

  it('refuse une date de fin avant le début, une durée ou des places invalides', () => {
    expect(verifierInformations({ ...FORM, fin: '2026-11-17' })).toEqual({ fin: MSG_DATES })
    expect(verifierInformations({ ...FORM, fin: '2026-11-18' })).toEqual({})
    expect(verifierInformations({ ...FORM, duree: '0', places: '2,5' })).toEqual({ duree: 'Indiquez une durée supérieure à 0.', places: 'Indiquez un nombre entier supérieur à 0.' })
  })
})
