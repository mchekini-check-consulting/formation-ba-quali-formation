import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { routes } from '../App'
import { obtenirOrigine, retablirOrigine } from './serviceApi'

// SCRUM-217 « Rétablir le modèle d'origine » (RG5, RG6, RG8) : GET /modeles/<type>/origine et
// POST /modeles/<type>/reinitialiser simulés, compte connecté
const VARIABLES = [{ code: 'apprenant_nom', libelle: 'Nom' }]
const CATALOGUE = [{ code: 'apprenant_nom', libelle: 'Nom', categorie: 'Apprenant', exemple: 'Martin' }]
const ORIGINE_HTML = '<h1>CONVENTION D’ORIGINE</h1><p>Entre {{apprenant_nom}}</p>'
const modele = (statut, contenu = '<h1>MA CONVENTION</h1><p>Texte {{apprenant_nom}}</p>', nomFichier = null) => ({
  type: 'CONVENTION', nom: 'Convention de formation', statut, contenu, variables: VARIABLES,
  date_maj: statut === 'ORIGINE' ? null : '2026-11-24T10:00:00Z', nom_fichier_importe: nomFichier,
})
const ORIGINE = modele('ORIGINE', ORIGINE_HTML)
const MESSAGE = 'Modèle d’origine rétabli. Les modèles de la formation déjà créés ne changent pas.'
const ok = (json) => ({ ok: true, status: 200, json: async () => json })

function simulerBackend({ actuel = modele('PERSONNALISE'), retablir = () => ok(ORIGINE) } = {}) {
  const fetchMock = vi.fn(async (url, options = {}) => {
    if (url.endsWith('/auth/moi')) return ok({ id: 1, email: 'camille@organisme.fr' })
    if (url.endsWith('/variables/')) return ok(CATALOGUE)
    if (url.endsWith('/modeles/CONVENTION/origine')) return ok(ORIGINE)
    if (url.endsWith('/modeles/CONVENTION/reinitialiser') && options.method === 'POST') return retablir()
    if (url.endsWith('/modeles/')) return ok({ modeles: [actuel, { ...ORIGINE, type: 'CONTRAT', nom: 'Contrat de formation' }] })
    if (url.endsWith('/modeles/convention')) return ok(actuel)
    return ok([])
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}
const retablissements = (fetchMock) => fetchMock.mock.calls.filter(([u]) => u.endsWith('/reinitialiser'))
const ecritures = (fetchMock) => fetchMock.mock.calls.filter(([, o]) => o?.method === 'PUT' || o?.method === 'POST')

beforeAll(() => {
  const vide = () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] })
  Range.prototype.getClientRects ??= vide
  Range.prototype.getBoundingClientRect ??= () => new DOMRect()
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

function afficher(adresse) {
  const router = createMemoryRouter(routes, { initialEntries: [adresse] })
  render(<RouterProvider router={router} />)
  return router
}
async function ouvrirEditeur(options) {
  const fetchMock = simulerBackend(options)
  afficher('/modeles/generiques/convention')
  await screen.findByRole('textbox', { name: 'Convention de formation' })
  fireEvent.click(screen.getByRole('button', { name: 'Voir le modèle d’origine' }))
  const fenetre = await screen.findByRole('dialog', { name: /Convention de formation · Modèle d’origine/ })
  await within(fenetre).findByText('CONVENTION D’ORIGINE')
  return { fetchMock, fenetre }
}
async function ouvrirDepuisCarte(options) {
  const fetchMock = simulerBackend(options)
  const router = afficher('/modeles/generiques')
  const carte = await screen.findByRole('article', { name: 'Convention de formation' })
  fireEvent.click(within(carte).getByRole('button', { name: 'Rétablir le modèle d’origine' }))
  const fenetre = await screen.findByRole('dialog', { name: /Convention de formation · Modèle d’origine/ })
  await within(fenetre).findByText('CONVENTION D’ORIGINE')
  return { fetchMock, fenetre, carte, router }
}
const bouton = (fenetre, nom) => within(fenetre).getByRole('button', { name: nom })
const editeur = () => screen.getByRole('textbox', { name: 'Convention de formation' })

describe('Rétablir le modèle d’origine (SCRUM-217)', () => {
  it('CA1 : « Voir le modèle d’origine » affiche le modèle d’origine en lecture seule, avec le rappel et les 3 boutons', async () => {
    const { fenetre } = await ouvrirEditeur()
    expect(within(fenetre).getByText('Lecture seule. Rien n’est modifié. Vous pouvez copier un passage.')).toBeTruthy()
    const document = within(fenetre).getByRole('article', { name: 'Convention de formation · Modèle d’origine' })
    expect(document.querySelector('[contenteditable="true"]')).toBeNull()
    expect(within(document).getByText('Nom')).toBeTruthy() // variable en étiquette
    expect(within(fenetre).getByText(/« Rétablir le modèle d’origine » remplace votre version personnalisée\. Les modèles de la formation déjà créés ne changent pas\./)).toBeTruthy()
    for (const nom of ['Voir ma version', 'Rétablir le modèle d’origine']) expect(bouton(fenetre, nom)).toBeTruthy()
    expect(within(fenetre).getAllByRole('button', { name: 'Fermer' })).toHaveLength(2) // en haut et en bas (maquette)
  })

  it('CA2 : « Fermer » ne modifie rien', async () => {
    const { fetchMock, fenetre } = await ouvrirEditeur()
    fireEvent.click(within(fenetre).getAllByRole('button', { name: 'Fermer' })[1])
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(ecritures(fetchMock)).toHaveLength(0)
    expect(editeur().textContent).toContain('MA CONVENTION')
  })

  it('CA2 : « Voir ma version » affiche sa version sans rien modifier, puis « Voir le modèle d’origine » revient', async () => {
    const { fetchMock, fenetre } = await ouvrirEditeur()
    fireEvent.click(bouton(fenetre, 'Voir ma version'))
    expect(within(fenetre).getByRole('heading', { name: 'Convention de formation · Version personnalisée' })).toBeTruthy()
    expect(within(fenetre).getByText('MA CONVENTION')).toBeTruthy()
    expect(within(fenetre).queryByRole('button', { name: 'Rétablir le modèle d’origine' })).toBeNull()
    expect(within(fenetre).queryByRole('button', { name: 'Personnaliser' })).toBeNull() // déjà dans l'éditeur
    fireEvent.click(bouton(fenetre, 'Voir le modèle d’origine'))
    expect(within(fenetre).getByText('CONVENTION D’ORIGINE')).toBeTruthy()
    expect(ecritures(fetchMock)).toHaveLength(0)
  })

  it('CA3 : depuis l’éditeur, rétablir s’applique sans « Enregistrer » : modèle d’origine affiché et message', async () => {
    const { fetchMock, fenetre } = await ouvrirEditeur()
    fireEvent.click(bouton(fenetre, 'Rétablir le modèle d’origine'))
    expect(await screen.findByText(MESSAGE)).toBeTruthy()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(retablissements(fetchMock)).toHaveLength(1)
    expect(fetchMock.mock.calls.some(([, o]) => o?.method === 'PUT')).toBe(false) // RG8 : sans « Enregistrer »
    await waitFor(() => expect(editeur().textContent).toContain('CONVENTION D’ORIGINE'))
  })

  it('CA3 : modifications non enregistrées : après rétablissement, l’éditeur affiche le modèle d’origine', async () => {
    simulerBackend()
    afficher('/modeles/generiques/convention')
    await screen.findByRole('textbox', { name: 'Convention de formation' })
    act(() => { editeur().editor.commands.insertContent(' AJOUT NON ENREGISTRÉ') })
    fireEvent.click(screen.getByRole('button', { name: 'Voir le modèle d’origine' }))
    const fenetre = await screen.findByRole('dialog')
    fireEvent.click(bouton(fenetre, 'Voir ma version')) // « ma version » = le document en cours dans l'éditeur
    expect(within(fenetre).getByText(/AJOUT NON ENREGISTRÉ/)).toBeTruthy()
    fireEvent.click(bouton(fenetre, 'Voir le modèle d’origine'))
    await within(fenetre).findByText('CONVENTION D’ORIGINE')
    fireEvent.click(bouton(fenetre, 'Rétablir le modèle d’origine'))
    await screen.findByText(MESSAGE)
    await waitFor(() => expect(editeur().textContent).toContain('CONVENTION D’ORIGINE'))
    expect(editeur().textContent).not.toContain('AJOUT NON ENREGISTRÉ')
  })

  it('CA3 : modèle « Mon document » : rappel adapté, puis l’encadré « Document importé » disparaît', async () => {
    const { fenetre } = await ouvrirEditeur({ actuel: modele('IMPORTE', '<p>MON WORD</p>', 'Ma convention.docx') })
    expect(screen.getByText('Document importé')).toBeTruthy()
    expect(within(fenetre).getByText(/remplace votre document importé\./)).toBeTruthy()
    fireEvent.click(bouton(fenetre, 'Voir ma version'))
    expect(within(fenetre).getByRole('heading', { name: 'Convention de formation · Mon document (Ma convention.docx)' })).toBeTruthy()
    fireEvent.click(bouton(fenetre, 'Voir le modèle d’origine'))
    fireEvent.click(bouton(fenetre, 'Rétablir le modèle d’origine'))
    await screen.findByText(MESSAGE)
    await waitFor(() => expect(screen.queryByText('Document importé')).toBeNull())
    expect(screen.getByRole('button', { name: 'Utiliser mon propre document Word' })).toBeTruthy()
  })

  it('CA3 : depuis la carte, le statut redevient « Modèle d’origine », le lien disparaît et le message s’affiche', async () => {
    const { fetchMock, fenetre, carte } = await ouvrirDepuisCarte()
    expect(within(carte).getByText('Personnalisé')).toBeTruthy()
    fireEvent.click(bouton(fenetre, 'Rétablir le modèle d’origine'))
    expect(await screen.findByText(MESSAGE)).toBeTruthy()
    await waitFor(() => expect(within(carte).getByText('Modèle d’origine').className).toContain('mod-statut-origine'))
    expect(within(carte).queryByRole('button', { name: /Rétablir/ })).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(retablissements(fetchMock)).toHaveLength(1)
  })

  it('CA2 : depuis la carte, « Voir ma version » puis « Personnaliser » ouvre l’éditeur sans rien modifier', async () => {
    const { fetchMock, fenetre, router } = await ouvrirDepuisCarte()
    fireEvent.click(bouton(fenetre, 'Voir ma version'))
    expect(within(fenetre).getByText('MA CONVENTION')).toBeTruthy()
    fireEvent.click(bouton(fenetre, 'Personnaliser'))
    await waitFor(() => expect(router.state.location.pathname).toBe('/modeles/generiques/convention'))
    expect(ecritures(fetchMock)).toHaveLength(0)
  })

  it('CA2 : depuis la carte, « Fermer » laisse le statut « Personnalisé »', async () => {
    const { fetchMock, fenetre, carte } = await ouvrirDepuisCarte()
    fireEvent.click(within(fenetre).getAllByRole('button', { name: 'Fermer' })[0])
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(within(carte).getByText('Personnalisé')).toBeTruthy()
    expect(ecritures(fetchMock)).toHaveLength(0)
  })

  it('CA5 : modèle jamais modifié : la fenêtre n’offre que « Fermer » (ni rappel, ni « Voir ma version », ni « Rétablir »)', async () => {
    const { fenetre } = await ouvrirEditeur({ actuel: ORIGINE })
    expect(within(fenetre).queryByRole('button', { name: 'Voir ma version' })).toBeNull()
    expect(within(fenetre).queryByRole('button', { name: 'Rétablir le modèle d’origine' })).toBeNull()
    expect(within(fenetre).queryByText(/remplace votre/)).toBeNull()
  })

  it('échec du rétablissement : message d’erreur dans la fenêtre, rien ne change', async () => {
    const { fenetre } = await ouvrirEditeur({
      retablir: () => ({ ok: false, status: 500, json: async () => ({ code: 'ERREUR', detail: 'Le modèle n’a pas pu être rétabli.' }) }),
    })
    fireEvent.click(bouton(fenetre, 'Rétablir le modèle d’origine'))
    expect((await within(fenetre).findByRole('alert')).textContent).toBe('Le modèle n’a pas pu être rétabli.')
    expect(bouton(fenetre, 'Rétablir le modèle d’origine').disabled).toBe(false)
    expect(editeur().textContent).toContain('MA CONVENTION')
  })

  it('modèle d’origine indisponible : message dans la fenêtre', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (url.endsWith('/auth/moi')) return ok({ id: 1, email: 'camille@organisme.fr' })
      if (url.endsWith('/origine')) return { ok: false, status: 404, json: async () => ({ code: 'MODELE_INTROUVABLE', detail: 'Modèle introuvable.' }) }
      if (url.endsWith('/modeles/')) return ok({ modeles: [modele('PERSONNALISE')] })
      return ok([])
    }))
    afficher('/modeles/generiques')
    const carte = await screen.findByRole('article', { name: 'Convention de formation' })
    fireEvent.click(within(carte).getByRole('button', { name: 'Rétablir le modèle d’origine' }))
    const fenetre = await screen.findByRole('dialog')
    expect(await within(fenetre).findByText(/Modèle introuvable/)).toBeTruthy()
  })

  it('CA4 / RG5 : le rétablissement ne vise que le modèle générique : aucun appel aux modèles de la formation', async () => {
    const fetchMock = simulerBackend()
    await expect(retablirOrigine('CONVENTION')).resolves.toEqual(ORIGINE)
    await obtenirOrigine('CONVENTION')
    const [[adresse, options]] = retablissements(fetchMock)
    expect(adresse).toMatch(/\/modeles\/CONVENTION\/reinitialiser$/)
    expect(options).toEqual({ credentials: 'include', method: 'POST' })
  })

  it('CA4 / RG5 : complété avec SCRUM-218/219 : après rétablissement, le modèle de la formation reste dans son dossier', async () => {
    const { fetchMock, fenetre } = await ouvrirDepuisCarte()
    fireEvent.click(bouton(fenetre, 'Rétablir le modèle d’origine'))
    await screen.findByText(MESSAGE)
    // Aucune écriture sur les modèles de la formation (/formations/<id>/modeles/...)
    expect(fetchMock.mock.calls.filter(([u, o]) => u.includes('/formations/') && o?.method)).toEqual([])
    cleanup()
    const SIENNE = { ...modele('PERSONNALISE', '<h1>CONVENTION DE LA FORMATION</h1>'), statut: 'FORMATION', formation: { id: 3, intitule: 'Excel' } }
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (url.endsWith('/auth/moi')) return ok({ id: 1, email: 'camille@organisme.fr' })
      if (url.endsWith('/formations/3/modeles/')) return ok({ formation: SIENNE.formation, modeles: [SIENNE], generiques_appliques: [] })
      return ok([])
    }))
    afficher('/modeles/formations/3')
    const carte = await screen.findByRole('article', { name: 'Convention de formation' })
    expect(within(carte).getByText('Modèle de la formation')).toBeTruthy()
    expect(within(carte).getByText('CONVENTION DE LA FORMATION')).toBeTruthy()
  })
})
