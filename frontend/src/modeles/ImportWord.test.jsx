import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { routes } from '../App'
import { BoutonImportWord } from './editeur/BoutonImportWord'
import { TAILLE_MAX_WORD, verifierFichierWord } from './editeur/fichierWord'

// SCRUM-215 « Importer son propre document Word » (RG4, RG8, RG11) : import et enregistrement simulés
const CATALOGUE = [
  { code: 'apprenant_prenom', libelle: 'Prénom', categorie: 'Apprenant', exemple: 'Lucas' },
  { code: 'apprenant_nom', libelle: 'Nom', categorie: 'Apprenant', exemple: 'Martin' },
]
const CONVERTI = '<h1>Convocation à la formation</h1><h3>Informations pratiques</h3>'
  + '<p>Bonjour <strong>Camille</strong> {{apprenant_nom}}, voici votre <em>convocation</em> ; code {{code_inconnu}}.</p>'
  + '<ul><li><p>Lieu : Lyon</p></li></ul>'
const ok = (json) => ({ ok: true, status: 200, json: async () => json })
const MODELE = { type: 'CONVOCATION', nom: 'Convocation', statut: 'ORIGINE', contenu: '<p>Texte d’origine</p>', variables: [] }

function simulerBackend({ modele = MODELE, importer = () => ok({ contenu: CONVERTI, nom_fichier: 'Convocation Camille.docx' }) } = {}) {
  const fetchMock = vi.fn(async (url, options = {}) => {
    if (url.endsWith('/auth/moi')) return ok({ id: 1, email: 'camille@organisme.fr' })
    if (url.endsWith('/variables/')) return ok(CATALOGUE)
    if (url.endsWith('/modeles/CONVOCATION/import')) return importer(options)
    if (url.endsWith('/modeles/CONVOCATION') && options.method === 'PUT') {
      return ok({ type: 'CONVOCATION', statut: 'IMPORTE', nb_formations_utilisant: 0, nb_formations: 0 })
    }
    if (url.endsWith('/modeles/convocation')) return ok(modele)
    return ok([])
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
beforeAll(() => {
  const vide = () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] })
  Range.prototype.getClientRects ??= vide
  Range.prototype.getBoundingClientRect ??= () => new DOMRect()
})

async function ouvrir(options) {
  const fetchMock = simulerBackend(options)
  const router = createMemoryRouter(routes, { initialEntries: ['/modeles/generiques/convocation'] })
  render(<RouterProvider router={router} />)
  await screen.findByRole('textbox', { name: 'Convocation' })
  return { fetchMock, router }
}
const docx = (nom = 'Convocation Camille.docx', taille = 1000) => {
  const fichier = new File(['x'], nom, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
  Object.defineProperty(fichier, 'size', { value: taille })
  return fichier
}
const choisir = (libelle, fichier) => fireEvent.change(screen.getByLabelText(libelle), { target: { files: [fichier] } })
const document = () => screen.getByRole('textbox', { name: 'Convocation' })
const appels = (fetchMock, fin, methode) => fetchMock.mock.calls.filter(([u, o]) => u.endsWith(fin) && (!methode || o?.method === methode))

async function importer(fetchMock) {
  choisir('Utiliser mon propre document Word', docx())
  await screen.findByRole('heading', { name: /Votre document est importé/ })
  return appels(fetchMock, '/modeles/CONVOCATION/import', 'POST')
}

describe('Importer son propre document Word (SCRUM-215)', () => {
  it('CA1 : .docx choisi -> le texte s’affiche avec sa mise en forme principale', async () => {
    const { fetchMock } = await ouvrir()
    const [[, options]] = await importer(fetchMock)
    expect(options.body.get('fichier').name).toBe('Convocation Camille.docx')
    const doc = document()
    expect(doc.querySelector('h1').textContent).toBe('Convocation à la formation')
    expect(doc.querySelector('h3').textContent).toBe('Informations pratiques')
    expect(doc.querySelector('strong').textContent).toBe('Camille')
    expect(doc.querySelector('em').textContent).toBe('convocation')
    expect(doc.querySelector('ul li').textContent).toBe('Lieu : Lyon')
    expect(doc.textContent).not.toContain('Texte d’origine')
  })

  it('{{code}} du Word -> étiquettes ; code inconnu -> étiquette avec son code', async () => {
    const { fetchMock } = await ouvrir()
    await importer(fetchMock)
    expect([...document().querySelectorAll('.doc-variable')].map((e) => e.textContent)).toEqual(['Nom', 'code_inconnu'])
  })

  it('CA2 : guide en 3 étapes (fermé par « J’ai compris ») et encadré « Document importé »', async () => {
    const { fetchMock } = await ouvrir()
    await importer(fetchMock)
    const guide = screen.getByRole('region', { name: /Votre document est importé/ })
    expect(within(guide).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Sélectionnez une information dans le document, par exemple « Camille ».',
      'Cliquez sur la variable correspondante à droite, par exemple « Prénom ».',
      'Vérifiez avec l’aperçu, puis enregistrez.',
    ])
    const panneau = screen.getByRole('complementary', { name: 'Variables' })
    expect(within(panneau).getByText('Document importé')).toBeTruthy()
    expect(within(panneau).getByText('Convocation Camille.docx')).toBeTruthy()
    expect(within(panneau).getByRole('button', { name: 'Remplacer le fichier' })).toBeTruthy()
    expect(within(panneau).queryByRole('button', { name: 'Utiliser mon propre document Word' })).toBeNull()
    fireEvent.click(within(guide).getByRole('button', { name: 'J’ai compris' }))
    expect(screen.queryByRole('region', { name: /Votre document est importé/ })).toBeNull()
  })

  it('CA3 : texte sélectionné + clic sur une variable -> le texte est remplacé par l’étiquette', async () => {
    const { fetchMock } = await ouvrir()
    await importer(fetchMock)
    const editeur = document().editor
    let debut = null
    editeur.state.doc.descendants((n, pos) => { if (debut === null && n.isText && n.text === 'Camille') debut = pos })
    act(() => { editeur.commands.setTextSelection({ from: debut, to: debut + 'Camille'.length }) })
    fireEvent.click(within(screen.getByRole('complementary', { name: 'Variables' })).getByRole('button', { name: 'Prénom' }))
    expect(document().textContent).not.toContain('Camille')
    expect([...document().querySelectorAll('.doc-variable')].map((e) => e.textContent)).toEqual(['Prénom', 'Nom', 'code_inconnu'])
  })

  it('CA4 (RG11) : fichier qui n’est pas un .docx -> message, rien n’est envoyé', async () => {
    const { fetchMock } = await ouvrir()
    for (const nom of ['convocation.pdf', 'convocation.doc']) {
      choisir('Utiliser mon propre document Word', docx(nom))
      expect((await screen.findByRole('alert')).textContent).toBe('Seuls les fichiers Word (.docx) sont acceptés.')
    }
    expect(appels(fetchMock, '/import')).toHaveLength(0)
    expect(document().textContent).toBe('Texte d’origine')
  })

  it('RG11 : plus de 10 Mo -> message, rien n’est envoyé', async () => {
    const { fetchMock } = await ouvrir()
    choisir('Utiliser mon propre document Word', docx('lourd.docx', TAILLE_MAX_WORD + 1))
    expect((await screen.findByRole('alert')).textContent).toBe('Le fichier dépasse 10 Mo : choisissez un document plus léger.')
    expect(appels(fetchMock, '/import')).toHaveLength(0)
  })

  it('refus du backend (fichier illisible) ou 413 d’un proxy : message clair', async () => {
    let reponse = { ok: false, status: 400, json: async () => ({ code: 'FICHIER_ILLISIBLE', detail: 'Ce fichier Word n’a pas pu être lu. Vérifiez qu’il s’ouvre dans Word.' }) }
    await ouvrir({ importer: () => reponse })
    choisir('Utiliser mon propre document Word', docx())
    expect((await screen.findByRole('alert')).textContent).toBe('Ce fichier Word n’a pas pu être lu. Vérifiez qu’il s’ouvre dans Word.')
    reponse = { ok: false, status: 413, json: async () => { throw new SyntaxError('HTML') } }
    choisir('Utiliser mon propre document Word', docx())
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Le fichier est trop volumineux pour être envoyé (10 Mo maximum).'))
    expect(document().textContent).toBe('Texte d’origine')
  })

  it('RG8 : importé puis « ← Retour » sans enregistrer -> rien n’est enregistré', async () => {
    const { fetchMock, router } = await ouvrir()
    await importer(fetchMock)
    fireEvent.click(screen.getByRole('button', { name: '← Retour' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/modeles/generiques'))
    expect(appels(fetchMock, '/modeles/CONVOCATION', 'PUT')).toHaveLength(0)
  })

  it('CA5 (RG4) : importé puis « Enregistrer » -> contenu et nom du fichier envoyés (statut « Mon document »)', async () => {
    const { fetchMock } = await ouvrir()
    await importer(fetchMock)
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await screen.findByText('Modèle générique enregistré.')
    const [[, premier]] = appels(fetchMock, '/modeles/CONVOCATION', 'PUT')
    const corps = JSON.parse(premier.body)
    expect(corps.nom_fichier_importe).toBe('Convocation Camille.docx')
    expect(corps.contenu).toContain('{{apprenant_nom}}')
    expect(corps.contenu).toContain('<strong>Camille</strong>')
    // Deuxième « Enregistrer » sans nouvel import : plus de nom de fichier (le backend garde « Mon document »)
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(appels(fetchMock, '/modeles/CONVOCATION', 'PUT')).toHaveLength(2))
    expect(JSON.parse(appels(fetchMock, '/modeles/CONVOCATION', 'PUT')[1][1].body).nom_fichier_importe).toBeUndefined()
  })

  it('modèle déjà « Mon document » : encadré avec le nom du fichier dès l’ouverture, « Remplacer le fichier »', async () => {
    const { fetchMock } = await ouvrir({ modele: { ...MODELE, statut: 'IMPORTE', nom_fichier_importe: 'ancien.docx' } })
    const panneau = screen.getByRole('complementary', { name: 'Variables' })
    expect(within(panneau).getByText('ancien.docx')).toBeTruthy()
    choisir('Remplacer le fichier', docx('nouveau.docx'))
    await screen.findByRole('heading', { name: /Votre document est importé/ })
    // L'éditeur est rouvert avec le document importé : le panneau aussi
    expect(within(screen.getByRole('complementary', { name: 'Variables' })).getByText('Convocation Camille.docx')).toBeTruthy()
    expect(appels(fetchMock, '/import', 'POST')).toHaveLength(1)
  })
})

describe('BoutonImportWord seul (réutilisable, SCRUM-219)', () => {
  it('appelle la fonction d’import reçue et annonce le résultat', async () => {
    const importerFichier = vi.fn(async () => ({ contenu: '<p>ok</p>' }))
    const onImporte = vi.fn()
    const onErreur = vi.fn()
    render(<BoutonImportWord libelle="Importer" importer={importerFichier} onImporte={onImporte} onErreur={onErreur} />)
    choisir('Importer', docx('a.docx'))
    await waitFor(() => expect(onImporte).toHaveBeenCalledWith({ contenu: '<p>ok</p>', nomFichier: 'a.docx' }))
    expect(onErreur).toHaveBeenCalledWith(null)
    fireEvent.change(screen.getByLabelText('Importer'), { target: { files: [] } })
    expect(importerFichier).toHaveBeenCalledTimes(1)
  })

  it('verifierFichierWord : extension en majuscules acceptée', () => {
    expect(verifierFichierWord(docx('CONVOCATION.DOCX'))).toBeNull()
  })
})
