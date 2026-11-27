import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { routes } from '../App'

// SCRUM-218 « Dupliquer un modèle générique pour une formation » (RG8, RG14, RG16, RG17) :
// GET /modeles/<type>/formations et POST /formations/<id>/modeles/<type>/ simulés, compte connecté
const VARIABLES = [{ code: 'apprenant_nom', libelle: 'Nom' }]
const CATALOGUE = [{ code: 'apprenant_nom', libelle: 'Nom', categorie: 'Apprenant', exemple: 'Martin' }]
const CONVOCATION = {
  type: 'CONVOCATION', nom: 'Convocation', statut: 'PERSONNALISE', contenu: '<h1>MA CONVOCATION</h1><p>Bonjour {{apprenant_nom}}</p>',
  variables: VARIABLES, date_maj: '2026-11-24T10:00:00Z', nom_fichier_importe: null,
}
const MANAGEMENT = { id: 7, intitule: 'Management d’équipe' }
const EXCEL = { id: 8, intitule: 'Excel intermédiaire' }
const MESSAGE = 'Modèle de la formation « Management d’équipe » créé. Il remplace le modèle générique pour les sessions de cette formation.'
const ok = (json, status = 200) => ({ ok: status < 400, status, json: async () => json })

function simulerBackend({ modele = CONVOCATION, formations = { disponibles: [MANAGEMENT, EXCEL], deja_crees: [] }, creer } = {}) {
  const fetchMock = vi.fn(async (url, options = {}) => {
    if (url.endsWith('/auth/moi')) return ok({ id: 1, email: 'camille@organisme.fr' })
    if (url.endsWith('/variables/')) return ok(CATALOGUE)
    if (url.endsWith('/modeles/CONVOCATION/formations') || url.endsWith('/modeles/convocation/formations')) return ok(formations)
    if (/\/formations\/\d+\/modeles\/CONVOCATION\/$/.test(url) && options.method === 'POST') {
      return creer ? creer(url, options) : ok({ ...modele, statut: 'FORMATION', formation: MANAGEMENT }, 201)
    }
    if (url.endsWith('/formations/7/modeles/')) {
      return ok({ formation: MANAGEMENT, modeles: [{ ...modele, statut: 'FORMATION', formation: MANAGEMENT }], generiques_appliques: [] })
    }
    if (url.endsWith('/modeles/')) return ok({ modeles: [modele] })
    if (url.endsWith('/modeles/convocation')) return ok(modele)
    return ok([])
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}
const creations = (fetchMock) => fetchMock.mock.calls.filter(([, o]) => o?.method === 'POST')

beforeAll(() => {
  const vide = () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] })
  Range.prototype.getClientRects ??= vide
  Range.prototype.getBoundingClientRect ??= () => new DOMRect()
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

function afficher(adresse = '/modeles/generiques') {
  const router = createMemoryRouter(routes, { initialEntries: [adresse] })
  render(<RouterProvider router={router} />)
  return router
}
async function ouvrirFenetre(options) {
  const fetchMock = simulerBackend(options)
  const router = afficher()
  const carte = await screen.findByRole('article', { name: 'Convocation' })
  fireEvent.click(within(carte).getByRole('button', { name: 'Dupliquer' }))
  const fenetre = await screen.findByRole('dialog', { name: 'Dupliquer « Convocation »' })
  return { fetchMock, router, fenetre }
}
async function ouvrirEditeur(options) {
  const { fetchMock, router, fenetre } = await ouvrirFenetre(options)
  await within(fenetre).findByRole('combobox', { name: 'Formation' })
  fireEvent.click(within(fenetre).getByRole('button', { name: 'Créer le modèle de la formation' }))
  await screen.findByRole('textbox', { name: 'Convocation' })
  return { fetchMock, router }
}
const editeur = () => screen.getByRole('textbox', { name: 'Convocation' })

describe('Dupliquer un modèle générique pour une formation (SCRUM-218)', () => {
  it('CA1 : « Dupliquer » ouvre la fenêtre avec seulement les formations sans modèle pour ce document', async () => {
    const { fenetre } = await ouvrirFenetre()
    expect(within(fenetre).getByText('Créer un modèle propre à une formation, à partir de ce modèle générique. Le modèle générique ne change pas.')).toBeTruthy()
    const liste = await within(fenetre).findByRole('combobox', { name: 'Formation' })
    expect(within(liste).getAllByRole('option').map((o) => o.textContent)).toEqual(['Management d’équipe', 'Excel intermédiaire'])
    expect(within(fenetre).getByRole('button', { name: 'Annuler' })).toBeTruthy()
    expect(within(fenetre).getByRole('button', { name: 'Créer le modèle de la formation' }).disabled).toBe(false)
  })

  it('CA5 / RG16 : une formation qui a déjà son modèle n’est pas proposée, mais elle est citée', async () => {
    const { fenetre } = await ouvrirFenetre({ formations: { disponibles: [EXCEL], deja_crees: [MANAGEMENT] } })
    const liste = await within(fenetre).findByRole('combobox', { name: 'Formation' })
    expect(within(liste).getAllByRole('option').map((o) => o.textContent)).toEqual(['Excel intermédiaire'])
    expect(within(fenetre).getByText(/Modèle de la formation déjà créé pour : Management d’équipe\./)).toBeTruthy()
  })

  it('CA5 : toutes les formations ont déjà leur modèle : message et création impossible', async () => {
    const { fenetre } = await ouvrirFenetre({ formations: { disponibles: [], deja_crees: [MANAGEMENT, EXCEL] } })
    expect(await within(fenetre).findByText(/Toutes les formations ont déjà leur modèle pour ce document\./)).toBeTruthy()
    expect(within(fenetre).queryByRole('combobox')).toBeNull()
    expect(within(fenetre).getByRole('button', { name: 'Créer le modèle de la formation' }).disabled).toBe(true)
  })

  it('aucune formation : message et création impossible', async () => {
    const { fenetre } = await ouvrirFenetre({ formations: { disponibles: [], deja_crees: [] } })
    expect(await within(fenetre).findByText(/Aucune formation/)).toBeTruthy()
    expect(within(fenetre).getByRole('button', { name: 'Créer le modèle de la formation' }).disabled).toBe(true)
  })

  it('« Annuler » ferme la fenêtre sans rien créer', async () => {
    const { fetchMock, fenetre } = await ouvrirFenetre()
    await within(fenetre).findByRole('combobox')
    fireEvent.click(within(fenetre).getByRole('button', { name: 'Annuler' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(creations(fetchMock)).toHaveLength(0)
  })

  it('liste des formations indisponible : message dans la fenêtre', async () => {
    simulerBackend()
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (url.endsWith('/auth/moi')) return ok({ id: 1, email: 'camille@organisme.fr' })
      if (url.endsWith('/formations')) return ok({ code: 'ERREUR', detail: 'Les formations n’ont pas pu être chargées.' }, 500)
      if (url.endsWith('/modeles/')) return ok({ modeles: [CONVOCATION] })
      return ok([])
    }))
    afficher()
    fireEvent.click(within(await screen.findByRole('article', { name: 'Convocation' })).getByRole('button', { name: 'Dupliquer' }))
    const fenetre = await screen.findByRole('dialog')
    expect((await within(fenetre).findByRole('alert')).textContent).toBe('Les formations n’ont pas pu être chargées.')
  })

  it('CA2 : « Créer le modèle de la formation » ouvre l’éditeur sur le modèle générique, avec le bandeau, sans rien créer', async () => {
    const { fetchMock, router } = await ouvrirEditeur()
    expect(router.state.location.pathname).toBe('/modeles/formations/7/convocation/nouveau')
    expect(editeur().textContent).toContain('MA CONVOCATION')
    const titre = document.querySelector('.mod-entete h1')
    expect(titre.firstChild.textContent).toBe('Convocation')
    expect(within(titre).getByText('Management d’équipe').className).toBe('mod-formation-pastille')
    expect(screen.getByText('Nouveau modèle de la formation « Management d’équipe ».')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toBe('Nouveau modèle de la formation « Management d’équipe », créé à partir du modèle générique. Il sera enregistré quand vous cliquerez sur Enregistrer. Si vous quittez sans enregistrer, rien n’est créé.')
    const fil = screen.getByRole('navigation', { name: 'Fil d\'Ariane' })
    expect(fil.textContent).toBe('Modèles › Modèles par formation › Management d’équipe › Convocation')
    expect(screen.queryByRole('button', { name: 'Voir le modèle d’origine' })).toBeNull()
    expect(creations(fetchMock)).toHaveLength(0) // RG8
  })

  it('CA3 / RG8 : « ← Retour » sans enregistrer ne crée rien', async () => {
    const { fetchMock, router } = await ouvrirEditeur()
    act(() => { editeur().editor.commands.insertContent(' AJOUT') })
    fireEvent.click(screen.getByRole('button', { name: '← Retour' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/modeles/generiques'))
    expect(creations(fetchMock)).toHaveLength(0)
  })

  it('CA4 : « Enregistrer » crée le modèle de la formation avec le document affiché, message, dossier de la formation (SCRUM-219)', async () => {
    const { fetchMock, router } = await ouvrirEditeur()
    act(() => { editeur().editor.commands.insertContent(' PROPRE À LA FORMATION') })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(await screen.findByText(MESSAGE)).toBeTruthy()
    await waitFor(() => expect(router.state.location.pathname).toBe('/modeles/formations/7'))
    const [[adresse, options]] = creations(fetchMock)
    expect(adresse).toMatch(/\/formations\/7\/modeles\/CONVOCATION\/$/)
    const corps = JSON.parse(options.body)
    expect(corps.contenu).toContain('MA CONVOCATION')
    expect(corps.contenu).toContain('PROPRE À LA FORMATION')
    expect(corps.nom_fichier_importe).toBeUndefined()
  })

  it('RG17 : modèle générique « Mon document » : le nom du fichier importé est repris', async () => {
    const importe = { ...CONVOCATION, statut: 'IMPORTE', nom_fichier_importe: 'Convocation maison.docx' }
    const { fetchMock } = await ouvrirEditeur({ modele: importe })
    expect(screen.getByText('Convocation maison.docx')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await screen.findByText(MESSAGE)
    expect(JSON.parse(creations(fetchMock)[0][1].body).nom_fichier_importe).toBe('Convocation maison.docx')
  })

  it('409 : la formation a déjà son modèle (créé entre-temps) : message, on reste dans l’éditeur', async () => {
    const { router } = await ouvrirEditeur({
      creer: () => ok({ code: 'MODELE_FORMATION_EXISTANT', detail: 'Cette formation a déjà son modèle pour ce document.' }, 409),
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Cette formation a déjà son modèle pour ce document.')
    expect(router.state.location.pathname).toBe('/modeles/formations/7/convocation/nouveau')
  })

  it('adresse d’une formation qui a déjà son modèle : message, pas d’éditeur', async () => {
    simulerBackend({ formations: { disponibles: [EXCEL], deja_crees: [MANAGEMENT] } })
    afficher('/modeles/formations/7/convocation/nouveau')
    expect(await screen.findByText('Cette formation a déjà son modèle pour ce document.')).toBeTruthy()
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('adresse d’une formation inconnue (autre organisme) : message, pas d’éditeur', async () => {
    simulerBackend()
    afficher('/modeles/formations/999/convocation/nouveau')
    expect(await screen.findByText('Formation introuvable.')).toBeTruthy()
    expect(screen.queryByRole('textbox')).toBeNull()
  })
})
