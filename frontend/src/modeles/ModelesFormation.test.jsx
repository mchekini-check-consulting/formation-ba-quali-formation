import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../App'

// SCRUM-219 « Consulter et rétablir les modèles d'une formation » (RG7, RG14, RG18, RG19) : GET /modeles/formations/,
// GET /formations/<id>/modeles/, GET / PUT /formations/<id>/modeles/<type>/ et POST .../reinitialiser simulés
const VARIABLES = [{ code: 'apprenant_nom', libelle: 'Nom' }]
const CATALOGUE = [{ code: 'apprenant_nom', libelle: 'Nom', categorie: 'Apprenant', exemple: 'Martin' }]
const EXCEL = { id: 7, intitule: 'Excel intermédiaire' }
const AGILE = { id: 8, intitule: 'Gestion de projet agile' }
const CONVOCATION = {
  id: 1, formation: EXCEL, type: 'CONVOCATION', nom: 'Convocation', statut: 'FORMATION', nom_fichier_importe: null, identique_generique: false,
  contenu: '<h1>CONVOCATION EXCEL</h1><p>Bonjour {{apprenant_nom}}</p>', variables: VARIABLES,
}
const GENERIQUE = { type: 'CONVOCATION', nom: 'Convocation', statut: 'PERSONNALISE', contenu: '<h1>CONVOCATION GÉNÉRIQUE</h1>', variables: [] }
const AUTRES = [{ type: 'CONVENTION', nom: 'Convention de formation' }, { type: 'CONTRAT', nom: 'Contrat de formation' },
  { type: 'ATTESTATION', nom: 'Attestation de fin de formation' }]
const ok = (json, status = 200) => ({ ok: status < 400, status, json: async () => json })

// RG19 : « Rétablir » renvoie le modèle de la formation avec le contenu du modèle générique actuel
const RETABLI = { ...CONVOCATION, contenu: '<h1>CONVOCATION GÉNÉRIQUE</h1>', variables: [], identique_generique: true }

function simulerBackend({ modele = CONVOCATION, retablir = () => ok(RETABLI), enregistrer } = {}) {
  const fetchMock = vi.fn(async (url, options = {}) => {
    if (url.endsWith('/auth/moi')) return ok({ id: 1, email: 'camille@organisme.fr' })
    if (url.endsWith('/variables/')) return ok(CATALOGUE)
    if (url.endsWith('/modeles/formations/')) {
      return ok({ formations: [{ ...EXCEL, nb_modeles: 1 }, { ...AGILE, nb_modeles: 0 }, { id: 9, intitule: 'Bureautique', nb_modeles: 2 }] })
    }
    if (url.endsWith('/formations/7/modeles/')) return ok({ formation: EXCEL, modeles: [modele], generiques_appliques: AUTRES })
    if (url.endsWith('/formations/8/modeles/')) return ok({ formation: AGILE, modeles: [], generiques_appliques: [...AUTRES, { type: 'CONVOCATION', nom: 'Convocation' }] })
    if (url.endsWith('/formations/99/modeles/')) return ok({ code: 'FORMATION_INTROUVABLE', detail: 'Formation introuvable' }, 404)
    if (url.endsWith('/formations/7/modeles/CONVOCATION/reinitialiser') && options.method === 'POST') return retablir()
    if (url.endsWith('/formations/7/modeles/CONVOCATION/')) {
      if (options.method === 'PUT') return enregistrer ? enregistrer() : ok({ ...modele, contenu: JSON.parse(options.body).contenu })
      return ok(modele)
    }
    if (url.endsWith('/formations/7/modeles/convocation/')) return ok(modele)
    if (url.endsWith('/modeles/CONVOCATION')) return ok(GENERIQUE)
    return ok([])
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}
const ecritures = (fetchMock) => fetchMock.mock.calls.filter(([, o]) => ['PUT', 'POST', 'DELETE'].includes(o?.method))

let telecharges
beforeAll(() => {
  const vide = () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] })
  Range.prototype.getClientRects ??= vide
  Range.prototype.getBoundingClientRect ??= () => new DOMRect()
})
beforeEach(() => {
  telecharges = []
  URL.createObjectURL = vi.fn(() => 'blob:word')
  URL.revokeObjectURL = vi.fn()
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function clic() { telecharges.push(this.download) })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

function afficher(adresse) {
  const router = createMemoryRouter(routes, { initialEntries: [adresse] })
  render(<RouterProvider router={router} />)
  return router
}
async function ouvrirDossier(options) {
  const fetchMock = simulerBackend(options)
  const router = afficher('/modeles/formations/7')
  const carte = await screen.findByRole('article', { name: 'Convocation' })
  return { fetchMock, router, carte }
}
async function ouvrirEditeur(options) {
  const fetchMock = simulerBackend(options)
  const router = afficher('/modeles/formations/7/convocation')
  await screen.findByRole('textbox', { name: 'Convocation' })
  return { fetchMock, router }
}
const editeur = () => screen.getByRole('textbox', { name: 'Convocation' })

describe('Modèles par formation (SCRUM-219)', () => {
  it('CA3 : une carte par formation : « 1 modèle de la formation », « 2 modèles… » ou « Modèles génériques appliqués »', async () => {
    simulerBackend()
    afficher('/modeles/formations')
    const excel = await screen.findByRole('link', { name: /Excel intermédiaire/ })
    expect(within(excel).getByText('1 modèle de la formation').className).toBe('mod-carte-en-avant')
    expect(within(screen.getByRole('link', { name: /Bureautique/ })).getByText('2 modèles de la formation')).toBeTruthy()
    const agile = screen.getByRole('link', { name: /Gestion de projet agile/ })
    expect(within(agile).getByText('Modèles génériques appliqués').className).toBe('')
    expect(excel.getAttribute('href')).toBe('/modeles/formations/7')
    expect(screen.getByRole('navigation', { name: 'Fil d\'Ariane' }).textContent).toBe('Modèles › Modèles par formation')
  })

  it('aucune formation : message', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => (url.endsWith('/auth/moi') ? ok({ id: 1, email: 'camille@organisme.fr' }) : ok({ formations: [] }))))
    afficher('/modeles/formations')
    expect(await screen.findByText('Aucune formation pour le moment.')).toBeTruthy()
  })

  it('CA1 : formation sans modèle : « Aucun modèle de la formation » et « Aller aux modèles génériques »', async () => {
    simulerBackend()
    const router = afficher('/modeles/formations/8')
    expect(await screen.findByRole('heading', { name: 'Aucun modèle de la formation' })).toBeTruthy()
    expect(screen.getByText('Les modèles génériques sont appliqués. Pour créer un modèle propre à cette formation, cliquez sur « Dupliquer » dans Modèles génériques.')).toBeTruthy()
    expect(screen.getByRole('navigation', { name: 'Fil d\'Ariane' }).textContent).toBe('Modèles › Modèles par formation › Gestion de projet agile')
    fireEvent.click(screen.getByRole('button', { name: 'Aller aux modèles génériques' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/modeles/generiques'))
  })

  it('RG18 bis : modèle différent du modèle générique : mention « Différent du modèle générique » et lien « Rétablir »', async () => {
    const { carte } = await ouvrirDossier()
    expect(within(carte).getByText('Différent du modèle générique').className).toContain('mod-mention-different')
    expect(within(carte).queryByText('Identique au modèle générique')).toBeNull()
    expect(within(carte).getByRole('button', { name: 'Rétablir le modèle générique' })).toBeTruthy()
  })

  it('RG18 bis : modèle identique au modèle générique : mention « Identique au modèle générique », pas de lien « Rétablir »', async () => {
    const { carte } = await ouvrirDossier({ modele: { ...CONVOCATION, identique_generique: true } })
    expect(within(carte).getByText('Modèle de la formation')).toBeTruthy()
    expect(within(carte).getByText('Identique au modèle générique')).toBeTruthy()
    expect(within(carte).queryByText('Différent du modèle générique')).toBeNull()
    expect(within(carte).queryByRole('button', { name: 'Rétablir le modèle générique' })).toBeNull()
  })

  it('CA2 / RG18 : carte « Modèle de la formation » et phrase avec les 3 autres documents ; pas de « Dupliquer » (RG14)', async () => {
    const { carte } = await ouvrirDossier()
    expect(within(carte).getByText('Modèle de la formation').className).toContain('mod-statut-formation')
    expect(within(carte).getByText('CONVOCATION EXCEL')).toBeTruthy() // miniature du vrai document
    expect(within(carte).getByRole('button', { name: 'Rétablir le modèle générique' })).toBeTruthy()
    expect(screen.getByText('Modèle générique appliqué : Convention de formation, Contrat de formation, Attestation de fin de formation.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Dupliquer' })).toBeNull()
  })

  it('RG7 : un clic sur le modèle de la formation l’ouvre directement dans l’éditeur', async () => {
    const { router, carte } = await ouvrirDossier()
    fireEvent.click(within(carte).getByRole('link', { name: 'Convocation' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/modeles/formations/7/convocation'))
    expect(await screen.findByRole('textbox', { name: 'Convocation' })).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('CA4 / RG19 : « Rétablir le modèle générique » + confirmation : la carte reste, avec le contenu du modèle générique actuel', async () => {
    const { fetchMock, carte } = await ouvrirDossier()
    fireEvent.click(within(carte).getByRole('button', { name: 'Rétablir le modèle générique' }))
    const fenetre = await screen.findByRole('dialog', { name: 'Rétablir le modèle générique ?' })
    expect(within(fenetre).getByText('Le contenu du modèle de la formation « Excel intermédiaire » (convocation) sera remplacé par le modèle générique actuel. Le modèle reste dans le dossier de la formation. Les documents déjà générés ne sont pas modifiés.')).toBeTruthy()
    expect(within(fenetre).getByRole('button', { name: 'Annuler' })).toBeTruthy()
    fireEvent.click(within(fenetre).getByRole('button', { name: 'Rétablir le modèle générique' }))
    expect(await screen.findByText('Modèle générique rétabli pour la formation « Excel intermédiaire ».')).toBeTruthy()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    // La carte reste « Modèle de la formation », sa miniature montre le modèle générique
    const apres = screen.getByRole('article', { name: 'Convocation' })
    expect(within(apres).getByText('Modèle de la formation')).toBeTruthy()
    expect(within(apres).getByText('CONVOCATION GÉNÉRIQUE')).toBeTruthy()
    expect(within(apres).queryByText('CONVOCATION EXCEL')).toBeNull()
    // RG18 bis : maintenant identique au modèle générique, le lien « Rétablir » disparaît
    expect(within(apres).getByText('Identique au modèle générique').className).toContain('mod-mention-identique')
    expect(within(apres).queryByRole('button', { name: 'Rétablir le modèle générique' })).toBeNull()
    expect(screen.getByText('Modèle générique appliqué : Convention de formation, Contrat de formation, Attestation de fin de formation.')).toBeTruthy()
    const [[adresse, options]] = ecritures(fetchMock)
    expect(adresse).toMatch(/\/formations\/7\/modeles\/CONVOCATION\/reinitialiser$/)
    expect(options.method).toBe('POST')
  })

  it('CA4 : avec d’autres modèles, seul le document rétabli change', async () => {
    const fetchMock = simulerBackend()
    const contrat = { ...CONVOCATION, id: 2, type: 'CONTRAT', nom: 'Contrat de formation', contenu: '<h1>CONTRAT EXCEL</h1>' }
    fetchMock.mockImplementation(async (url, options = {}) => {
      if (url.endsWith('/auth/moi')) return ok({ id: 1, email: 'camille@organisme.fr' })
      if (url.endsWith('/formations/7/modeles/')) {
        return ok({ formation: EXCEL, modeles: [contrat, CONVOCATION], generiques_appliques: [AUTRES[0], AUTRES[2]] })
      }
      if (options.method === 'POST') return ok(RETABLI)
      return ok([])
    })
    afficher('/modeles/formations/7')
    const carte = await screen.findByRole('article', { name: 'Convocation' })
    fireEvent.click(within(carte).getByRole('button', { name: 'Rétablir le modèle générique' }))
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Rétablir le modèle générique' }))
    await waitFor(() => expect(within(screen.getByRole('article', { name: 'Convocation' })).getByText('CONVOCATION GÉNÉRIQUE')).toBeTruthy())
    expect(within(screen.getByRole('article', { name: 'Contrat de formation' })).getByText('CONTRAT EXCEL')).toBeTruthy()
    expect(screen.getByText('Modèle générique appliqué : Convention de formation, Attestation de fin de formation.')).toBeTruthy()
  })

  it('CA5 : « Annuler » ne modifie rien', async () => {
    const { fetchMock, carte } = await ouvrirDossier()
    fireEvent.click(within(carte).getByRole('button', { name: 'Rétablir le modèle générique' }))
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Annuler' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByRole('article', { name: 'Convocation' })).toBeTruthy()
    expect(ecritures(fetchMock)).toHaveLength(0)
  })

  it('échec du rétablissement : message dans la fenêtre, la carte reste', async () => {
    const { carte } = await ouvrirDossier({ retablir: () => ok({ code: 'ERREUR', detail: 'Le modèle n’a pas pu être rétabli.' }, 500) })
    fireEvent.click(within(carte).getByRole('button', { name: 'Rétablir le modèle générique' }))
    const fenetre = await screen.findByRole('dialog')
    fireEvent.click(within(fenetre).getByRole('button', { name: 'Rétablir le modèle générique' }))
    expect((await within(fenetre).findByRole('alert')).textContent).toBe('Le modèle n’a pas pu être rétabli.')
    expect(within(screen.getByRole('article', { name: 'Convocation' })).getByText('CONVOCATION EXCEL')).toBeTruthy()
  })

  it('formation d’un autre organisme (404) : message', async () => {
    simulerBackend()
    afficher('/modeles/formations/99')
    expect(await screen.findByText(/Formation introuvable/)).toBeTruthy()
  })
})

describe('Éditeur d’un modèle de la formation (SCRUM-219)', () => {
  it('RG7 : en-tête de la formation, « Voir le modèle générique » à la place de « Voir le modèle d’origine », pas de bandeau', async () => {
    await ouvrirEditeur()
    expect(editeur().textContent).toContain('CONVOCATION EXCEL')
    expect(screen.getByText('Modèle de la formation « Excel intermédiaire ». Il remplace le modèle générique pour toutes les sessions de cette formation.')).toBeTruthy()
    expect(screen.getByRole('navigation', { name: 'Fil d\'Ariane' }).textContent).toBe('Modèles › Modèles par formation › Excel intermédiaire › Convocation')
    expect(screen.queryByRole('button', { name: 'Voir le modèle d’origine' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Voir le modèle générique' })).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByRole('complementary', { name: 'Variables' })).toBeTruthy()
  })

  it('« Voir le modèle générique » : le modèle générique en lecture seule, « Fermer » ne change rien', async () => {
    const { fetchMock } = await ouvrirEditeur()
    fireEvent.click(screen.getByRole('button', { name: 'Voir le modèle générique' }))
    const fenetre = await screen.findByRole('dialog', { name: 'Convocation · Modèle générique' })
    expect(within(fenetre).getByText('Lecture seule. Rien n’est modifié.')).toBeTruthy()
    const document = await within(fenetre).findByRole('article', { name: 'Convocation · Modèle générique' })
    expect(document.textContent).toContain('CONVOCATION GÉNÉRIQUE')
    expect(document.querySelector('[contenteditable="true"]')).toBeNull()
    fireEvent.click(within(fenetre).getAllByRole('button', { name: 'Fermer' })[1])
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(ecritures(fetchMock)).toHaveLength(0)
  })

  it('« Enregistrer » : PUT du modèle de la formation, message, on reste dans l’éditeur', async () => {
    const { fetchMock, router } = await ouvrirEditeur()
    act(() => { editeur().editor.commands.insertContent(' MODIFIÉ') })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(await screen.findByText('Document enregistré pour la formation « Excel intermédiaire ».')).toBeTruthy()
    const [[adresse, options]] = ecritures(fetchMock)
    expect(adresse).toMatch(/\/formations\/7\/modeles\/CONVOCATION\/$/)
    expect(options.method).toBe('PUT')
    expect(JSON.parse(options.body).contenu).toContain('MODIFIÉ')
    expect(router.state.location.pathname).toBe('/modeles/formations/7/convocation')
  })

  it('échec de l’enregistrement : message', async () => {
    await ouvrirEditeur({ enregistrer: () => ok({ code: 'CONTENU_INVALIDE', detail: 'Le document envoyé est vide ou illisible.' }, 400) })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Le document envoyé est vide ou illisible.')
  })

  it('« ← Retour » sans enregistrer : retour au dossier de la formation, rien n’est envoyé', async () => {
    const { fetchMock, router } = await ouvrirEditeur()
    act(() => { editeur().editor.commands.insertContent(' AJOUT') })
    fireEvent.click(screen.getByRole('button', { name: '← Retour' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/modeles/formations/7'))
    expect(ecritures(fetchMock)).toHaveLength(0)
  })

  it('« Télécharger en Word » : le modèle de la formation enregistré', async () => {
    const fetchMock = simulerBackend()
    fetchMock.mockImplementation(async (url) => {
      if (url.endsWith('/auth/moi')) return ok({ id: 1, email: 'camille@organisme.fr' })
      if (url.endsWith('/variables/')) return ok(CATALOGUE)
      if (url.endsWith('/export.docx')) return { ok: true, status: 200, blob: async () => new Blob(['PK']) }
      return ok(CONVOCATION)
    })
    afficher('/modeles/formations/7/convocation')
    await screen.findByRole('textbox', { name: 'Convocation' })
    fireEvent.click(screen.getByRole('button', { name: 'Télécharger en Word' }))
    await waitFor(() => expect(telecharges).toEqual(['Modèle - Convocation.docx']))
    expect(fetchMock.mock.calls.some(([u]) => /\/formations\/7\/modeles\/CONVOCATION\/export\.docx$/.test(u))).toBe(true)
  })

  it('modèle de la formation venu d’un Word : encadré « Document importé »', async () => {
    await ouvrirEditeur({ modele: { ...CONVOCATION, nom_fichier_importe: 'Convocation Excel.docx' } })
    expect(screen.getByText('Document importé')).toBeTruthy()
    expect(screen.getByText('Convocation Excel.docx')).toBeTruthy()
  })
})
