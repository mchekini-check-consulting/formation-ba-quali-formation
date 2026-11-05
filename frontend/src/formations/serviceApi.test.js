import { afterEach, describe, expect, it, vi } from 'vitest'
import * as api from './serviceApi'

const FORMATION_API = {
  id: 3, reference: 'FOR-2026-001', version: 2, intitule: 'Excel avancé', duree_heures: '10.50', modalite: 'DISTANCIEL',
  statut: 'VALIDEE', publication: 'PUBLIEE', organisme: 'Cap Compétences', preparee_par: 'Camille Laurent',
  valeurs: { public: ['Salariés'] }, autres_informations: [{ titre: 'Outils', contenu: 'Excel' }],
  date_creation: '2026-10-20T09:00:00+02:00', date_mise_a_jour: '2026-10-30T18:00:00+01:00',
  sequences: [{ titre: 'Tableaux croisés', duree_heures: '3.50', objectif_vise: 'Analyser', modalite: 'DISTANCIEL_SYNCHRONE', contenu: 'TCD', methodes_activites: 'Exercices', supports: '', evaluation: 'Quiz' }],
  sessions: [{ id: 1, date_debut: '2027-02-08', date_fin: '2027-02-09', lieu: 'Teams', nombre_places: null }],
  blocs_manquants: [],
}

const repondre = (status, corps) => vi.stubGlobal('fetch', vi.fn(async () => ({ ok: status < 400, status, json: async () => corps })))
afterEach(() => vi.unstubAllGlobals())

describe('service API', () => {
  it('traduit une formation de l’API vers le format des écrans', async () => {
    repondre(200, FORMATION_API)
    const f = await api.obtenirFormation(3)
    expect(fetch).toHaveBeenCalledWith('/api/formations/3/', expect.objectContaining({ method: 'GET' }))
    expect(f).toMatchObject({ id: 3, ref: 'FOR-2026-001', title: 'Excel avancé', duree: '10,5', modalite: 'Distanciel', statut: 'validee', pub: 'publiee', maj: '2026-10-30' })
    expect(f.values.modules[0]).toEqual({ seq: 'Tableaux croisés', duree: '3,5', objectif: 'Analyser', modalite: 'Distanciel synchrone (classe virtuelle)', contenu: 'TCD', activites: 'Exercices', supports: '', evalseq: 'Quiz' })
    expect(f.sess).toEqual([{ id: 1, debut: '2027-02-08', fin: '2027-02-09', lieu: 'Teams', places: '' }])
  })

  it('envoie « valider » avec forcer pour « Valider quand même », sans les séquences dans valeurs', async () => {
    repondre(200, FORMATION_API)
    const f = api.depuisApi(FORMATION_API)
    await api.enregistrerFormation(f, 'incomplete')
    const [url, options] = fetch.mock.calls[0]
    const corps = JSON.parse(options.body)
    expect([url, options.method]).toEqual(['/api/formations/3/', 'PUT'])
    expect(corps).toMatchObject({ action: 'valider', forcer: true, intitule: 'Excel avancé', duree_heures: '10.5', modalite: 'DISTANCIEL' })
    expect(corps.valeurs.modules).toBeUndefined()
    expect(corps.sequences[0]).toMatchObject({ titre: 'Tableaux croisés', duree_heures: '3.5', modalite: 'DISTANCIEL_SYNCHRONE', methodes_activites: 'Exercices' })
  })

  it('crée une nouvelle formation en brouillon (POST)', async () => {
    repondre(201, FORMATION_API)
    await api.enregistrerFormation({ id: null, title: 'Nouvelle', duree: '', modalite: 'Présentiel', values: {}, others: [] }, 'brouillon')
    const [url, options] = fetch.mock.calls[0]
    expect([url, options.method]).toEqual(['/api/formations/', 'POST'])
    expect(JSON.parse(options.body)).toMatchObject({ action: 'brouillon', forcer: false, duree_heures: null, doublon_accepte: false })
  })

  it('même intitulé : remonte INTITULE_EXISTANT puis envoie doublon_accepte (SCRUM-20)', async () => {
    const f = { id: null, title: 'Excel avancé', duree: '', modalite: 'Présentiel', values: {}, others: [] }
    repondre(409, { code: 'INTITULE_EXISTANT', detail: 'Une formation portant le même nom existe déjà.' })
    await expect(api.enregistrerFormation(f, 'brouillon')).rejects.toMatchObject({ code: 'INTITULE_EXISTANT' })
    repondre(201, FORMATION_API)
    await api.enregistrerFormation(f, 'brouillon', { doublonAccepte: true })
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ doublon_accepte: true })
  })

  it('archive et restaure en PATCH, supprime en DELETE, avec le cookie de connexion (SCRUM-23)', async () => {
    repondre(200, FORMATION_API)
    await api.archiver(3)
    await api.restaurer(3)
    expect(fetch.mock.calls.map(([url, o]) => [url, o.method, o.credentials])).toEqual([
      ['/api/formations/3/archiver/', 'PATCH', 'include'], ['/api/formations/3/restaurer/', 'PATCH', 'include']])
    repondre(204, null)
    await expect(api.supprimer(3)).resolves.toBeUndefined()
    expect(fetch.mock.calls[0].slice(0, 1).concat(fetch.mock.calls[0][1].method)).toEqual(['/api/formations/3/', 'DELETE'])
  })

  it('suppression refusée : une formation avec des sessions doit d’abord être archivée (409)', async () => {
    repondre(409, { code: 'A_DES_SESSIONS', detail: 'Cette formation a des sessions : archivez-la avant de la supprimer.' })
    await expect(api.supprimer(3)).rejects.toMatchObject({ code: 'A_DES_SESSIONS' })
  })

  it('remonte le code d’erreur métier de l’API (RG26)', async () => {
    repondre(409, { code: 'PROGRAMME_REQUIS', detail: 'Une formation ne peut pas être publiée sans son programme.' })
    await expect(api.publier(3)).rejects.toMatchObject({ code: 'PROGRAMME_REQUIS' })
  })

  it('signale un backend injoignable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    await expect(api.listerFormations()).rejects.toMatchObject({ code: 'RESEAU' })
  })

  it('envoie le nombre de places en entier, ou rien s’il est vide (RG38)', async () => {
    repondre(201, FORMATION_API)
    await api.ajouterSession(3, { debut: '2027-02-08', fin: '2027-02-09', lieu: ' Lyon ', places: '12' })
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ date_debut: '2027-02-08', date_fin: '2027-02-09', lieu: 'Lyon', nombre_places: 12 })
  })
})
