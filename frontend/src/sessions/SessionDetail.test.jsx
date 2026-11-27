import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../App'

// SCRUM-220 « Utiliser le bon modèle pour générer les documents d'une session » : page d'une session, onglet
// Documents (GET /sessions/<id>/documents/, POST …/<type>/generer, GET …/<doc>/pdf simulés), compte connecté
const SESSION = { id: 5, formation: 'Excel intermédiaire', date_debut: '2026-11-21', date_fin: '2026-11-22', modalite: 'PRESENTIEL',
  lieu: 'Lyon, salle A', formateurs: ['Nadia Benali'] }
const genere = (id, numero, destinataire, source = 'GENERIQUE') => ({ id, numero, destinataire, source, date_generation: '2026-11-27T10:00:00Z' })
const type = (t, nom, source = 'GENERIQUE', generes = []) => ({ type: t, nom, source, generes })
const DOCUMENTS = [
  type('CONVENTION', 'Convention de formation'),
  type('CONTRAT', 'Contrat de formation'),
  type('CONVOCATION', 'Convocation', 'FORMATION'),
  type('ATTESTATION', 'Attestation de fin de formation'),
]
const ok = (json, status = 200) => ({ ok: status < 400, status, json: async () => json })

function simulerBackend({ documents = DOCUMENTS, generer } = {}) {
  let actuels = documents
  const fetchMock = vi.fn(async (url, options = {}) => {
    if (url.endsWith('/auth/moi')) return ok({ id: 1, email: 'camille@organisme.fr' })
    if (url.endsWith('/sessions/5/documents/')) return ok({ session: SESSION, documents: actuels })
    if (url.endsWith('/sessions/99/documents/')) return ok({ code: 'SESSION_INTROUVABLE', detail: 'Session introuvable' }, 404)
    const m = url.match(/\/sessions\/5\/documents\/(\w+)\/generer$/)
    if (m && options.method === 'POST') {
      if (generer) return generer(m[1])
      actuels = actuels.map((d) => (d.type === m[1]
        ? { ...d, generes: [genere(11, 'CVC-2026-0011', 'Inès Moreau', d.source), genere(12, 'CVC-2026-0012', 'Paul Garnier', d.source)] }
        : d))
      return ok({ type: m[1], source: 'FORMATION', nombre: 2 }, 201)
    }
    if (url.endsWith('/pdf')) return { ok: true, status: 200, blob: async () => new Blob(['%PDF']) }
    if (url.endsWith('/sessions/')) return ok([{ id: 5, formation_intitule: 'Excel intermédiaire', date_debut: '2026-11-21', date_fin: '2026-11-22', modalite: 'PRESENTIEL', statut: 'PREVUE', nombre_apprenants: 2 }])
    return ok([])
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}
const generations = (fetchMock) => fetchMock.mock.calls.filter(([, o]) => o?.method === 'POST')

let telecharges
beforeEach(() => {
  telecharges = []
  URL.createObjectURL = vi.fn(() => 'blob:pdf')
  URL.revokeObjectURL = vi.fn()
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function clic() { telecharges.push(this.download) })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

function afficher(adresse = '/sessions/5') {
  const router = createMemoryRouter(routes, { initialEntries: [adresse] })
  render(<RouterProvider router={router} />)
  return router
}
async function ouvrir(options) {
  const fetchMock = simulerBackend(options)
  const router = afficher()
  await screen.findByRole('heading', { level: 1, name: 'Excel intermédiaire' })
  return { fetchMock, router }
}
const ligne = (nom) => screen.getAllByRole('row').find((r) => within(r).queryByText(nom, { selector: 'b' }))

describe('Page d’une session, onglet Documents (SCRUM-220)', () => {
  it('en-tête de la maquette, onglet Documents actif, Participants et Émargement grisés', async () => {
    await ouvrir()
    expect(screen.getByText('21/11/2026 au 22/11/2026 · Lyon, salle A · Formateur : Nadia Benali')).toBeTruthy()
    expect(screen.getByRole('navigation', { name: 'Fil d\'Ariane' }).textContent).toBe('Sessions › Excel intermédiaire')
    expect(screen.getByRole('tab', { name: 'Documents' }).getAttribute('aria-selected')).toBe('true')
    for (const nom of ['Participants', 'Émargement']) expect(screen.getByRole('tab', { name: nom }).disabled).toBe(true)
    const entetes = within(screen.getByRole('table', { name: 'Documents de la session' })).getAllByRole('columnheader').map((c) => c.textContent)
    expect(entetes).toEqual(['Document', 'Modèle utilisé', 'Destinataire', 'Statut', ''])
  })

  it('CA1 : la formation a son modèle de convocation : « Modèle de la formation »', async () => {
    await ouvrir()
    const convocation = ligne('Convocation')
    expect(within(convocation).getByText('Modèle de la formation').className).toContain('sd-modele-formation')
  })

  it('CA2 : sans modèle de la formation : « Modèle générique »', async () => {
    await ouvrir()
    for (const nom of ['Convention de formation', 'Contrat de formation', 'Attestation de fin de formation']) {
      expect(within(ligne(nom)).getByText('Modèle générique')).toBeTruthy()
      expect(within(ligne(nom)).getByText('À générer')).toBeTruthy()
      expect(within(ligne(nom)).getByRole('button', { name: 'Générer' })).toBeTruthy()
    }
  })

  it('« Générer » : POST, message, une ligne par destinataire avec « Télécharger »', async () => {
    const { fetchMock } = await ouvrir()
    fireEvent.click(within(ligne('Convocation')).getByRole('button', { name: 'Générer' }))
    expect(await screen.findByText('2 documents générés.')).toBeTruthy()
    expect(generations(fetchMock)[0][0]).toMatch(/\/sessions\/5\/documents\/CONVOCATION\/generer$/)
    await waitFor(() => expect(within(ligne('Convocation')).getByText('Généré')).toBeTruthy())
    expect(within(ligne('Convocation')).getByText('2 destinataires')).toBeTruthy()
    expect(screen.getByText('Inès Moreau')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Télécharger Convocation - Paul Garnier' })).toBeTruthy()
  })

  it('CA3 : « Télécharger » : le PDF figé du destinataire, avec le cookie de connexion', async () => {
    const { fetchMock } = await ouvrir({
      documents: DOCUMENTS.map((d) => (d.type === 'CONVOCATION' ? { ...d, generes: [genere(12, 'CVC-2026-0012', 'Paul Garnier', 'FORMATION')] } : d)),
    })
    fireEvent.click(screen.getByRole('button', { name: 'Télécharger Convocation - Paul Garnier' }))
    await waitFor(() => expect(telecharges).toEqual(['Convocation - Paul Garnier - CVC-2026-0012.pdf']))
    const [adresse, options] = fetchMock.mock.calls.find(([u]) => u.endsWith('/pdf'))
    expect(adresse).toMatch(/\/sessions\/5\/documents\/12\/pdf$/)
    expect(options).toEqual({ credentials: 'include' })
  })

  it('CA5 / RG22 : un document généré garde le modèle avec lequel il a été généré', async () => {
    // La convocation a été générée avec le modèle générique, avant la création du modèle de la formation
    await ouvrir({
      documents: DOCUMENTS.map((d) => (d.type === 'CONVOCATION' ? { ...d, source: 'GENERIQUE', generes: [genere(12, 'CVC-2026-0012', 'Paul Garnier')] } : d)),
    })
    expect(within(ligne('Convocation')).getByText('Modèle générique')).toBeTruthy()
  })

  it('3A : « Générer à nouveau » : confirmation ; « Annuler » ne génère rien', async () => {
    const { fetchMock } = await ouvrir({
      documents: DOCUMENTS.map((d) => (d.type === 'CONVOCATION' ? { ...d, generes: [genere(12, 'CVC-2026-0012', 'Paul Garnier', 'FORMATION')] } : d)),
    })
    fireEvent.click(within(ligne('Convocation')).getByRole('button', { name: 'Générer à nouveau' }))
    const fenetre = await screen.findByRole('dialog')
    expect(within(fenetre).getByRole('heading', { name: 'Générer à nouveau ?' })).toBeTruthy()
    expect(within(fenetre).getByText('Les convocations déjà générées pour cette session seront remplacées par de nouvelles versions, créées avec le modèle actuel.')).toBeTruthy()
    fireEvent.click(within(fenetre).getByRole('button', { name: 'Annuler' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(generations(fetchMock)).toHaveLength(0)
  })

  it('3A : « Générer à nouveau » confirmé : nouvelle génération ; accord pour les contrats', async () => {
    const { fetchMock } = await ouvrir({
      documents: DOCUMENTS.map((d) => (d.type === 'CONTRAT' ? { ...d, generes: [genere(3, 'CTR-2026-0003', 'Paul Garnier')] } : d)),
    })
    fireEvent.click(within(ligne('Contrat de formation')).getByRole('button', { name: 'Générer à nouveau' }))
    const fenetre = await screen.findByRole('dialog')
    expect(within(fenetre).getByText('Les contrats déjà générés pour cette session seront remplacés par de nouvelles versions, créées avec le modèle actuel.')).toBeTruthy()
    fireEvent.click(within(fenetre).getByRole('button', { name: 'Générer à nouveau' }))
    expect(await screen.findByText('2 documents générés.')).toBeTruthy()
    expect(generations(fetchMock)).toHaveLength(1)
  })

  it('400 : session sans apprenant ou convention sans entreprise cliente : message du backend', async () => {
    const message = 'Aucun apprenant de cette session n’est rattaché à une entreprise cliente : pas de convention à générer. Pour un particulier qui finance lui-même sa formation, générez le contrat de formation.'
    await ouvrir({ generer: () => ok({ code: 'SANS_ENTREPRISE_CLIENTE', detail: message }, 400) })
    fireEvent.click(within(ligne('Convention de formation')).getByRole('button', { name: 'Générer' }))
    expect((await screen.findByRole('alert')).textContent).toBe(message)
    expect(within(ligne('Convention de formation')).getByText('À générer')).toBeTruthy()
  })

  it('1 document généré : « 1 document généré. »', async () => {
    await ouvrir({ generer: (t) => ok({ type: t, source: 'GENERIQUE', nombre: 1 }, 201) })
    fireEvent.click(within(ligne('Convention de formation')).getByRole('button', { name: 'Générer' }))
    expect(await screen.findByText('1 document généré.')).toBeTruthy()
  })

  it('échec du téléchargement : message', async () => {
    const fetchMock = simulerBackend({
      documents: DOCUMENTS.map((d) => (d.type === 'CONVOCATION' ? { ...d, generes: [genere(12, 'CVC-2026-0012', 'Paul Garnier')] } : d)),
    })
    fetchMock.mockImplementation(async (url) => {
      if (url.endsWith('/auth/moi')) return ok({ id: 1, email: 'camille@organisme.fr' })
      if (url.endsWith('/pdf')) return ok({}, 500)
      return ok({ session: { ...SESSION, modalite: 'DISTANCIEL', date_fin: SESSION.date_debut, formateurs: [] },
        documents: DOCUMENTS.map((d) => (d.type === 'CONVOCATION' ? { ...d, generes: [genere(12, 'CVC-2026-0012', 'Paul Garnier')] } : d)) })
    })
    afficher()
    expect(await screen.findByText('21/11/2026 · À distance')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Télécharger Convocation - Paul Garnier' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Le PDF n’a pas pu être téléchargé. Réessayez.')
  })

  it('session d’un autre organisme (404) : message', async () => {
    simulerBackend()
    afficher('/sessions/99')
    expect(await screen.findByText('Session introuvable')).toBeTruthy()
  })

  it('le planning ouvre la page de la session ; « ← Retour » revient au planning', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-20T10:00:00+01:00') }) // session à venir (SCRUM-167)
    simulerBackend()
    const router = afficher('/sessions')
    fireEvent.click(await screen.findByRole('link', { name: /Excel intermédiaire/ }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/sessions/5'))
    fireEvent.click(await screen.findByRole('button', { name: '← Retour' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/sessions'))
    vi.useRealTimers()
  })
})
