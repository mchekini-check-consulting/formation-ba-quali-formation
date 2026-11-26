import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { routes } from '../App'
import { GLISSER_VARIABLE, PanneauVariables } from './editeur/PanneauVariables'

// SCRUM-214 « Insérer des variables dans un modèle » (RG9, RG10) : GET /variables/ et /modeles/<type> simulés
const RG10 = ['Session', 'Formation', 'Apprenant', 'Client', 'Prix', 'Fin de formation', 'Document', 'Organisme']
const CATALOGUE = [
  { code: 'session_date_debut', libelle: 'Date de début', categorie: 'Session', exemple: '12/01/2027' },
  { code: 'session_lieu', libelle: 'Lieu', categorie: 'Session', exemple: '12 rue des Lilas, 69003 Lyon' },
  { code: 'formation_intitule', libelle: 'Intitulé de la formation', categorie: 'Formation', exemple: 'Management d’équipe' },
  { code: 'apprenant_prenom', libelle: 'Prénom', categorie: 'Apprenant', exemple: 'Lucas' },
  { code: 'client_nom', libelle: 'Raison sociale du client', categorie: 'Client', exemple: 'Atlas SARL' },
  { code: 'prix_ht', libelle: 'Prix HT', categorie: 'Prix', exemple: '1 200 €' },
  { code: 'fin_resultats', libelle: 'Résultats de l’évaluation', categorie: 'Fin de formation', exemple: 'Acquis' },
  { code: 'numero_document', libelle: 'Numéro du document', categorie: 'Document', exemple: 'CONV-2027-0012' },
  { code: 'org_nom', libelle: 'Nom de l’organisme', categorie: 'Organisme', exemple: 'Cap Compétences' },
]
const CONTENU = '<div class="eh"><span class="logo-ph">LOGO</span><span>{{org_nom}}</span></div>'
  + '<h1>CONVOCATION</h1><p>Bonjour le stagiaire, rendez-vous à la formation {{formation_intitule}}.</p>'
const ok = (json) => ({ ok: true, status: 200, json: async () => json })

function simulerBackend(contenu = CONTENU) {
  const fetchMock = vi.fn(async (url, options = {}) => {
    if (url.endsWith('/auth/moi')) return ok({ id: 1, email: 'camille@organisme.fr' })
    if (url.endsWith('/variables/')) return ok(CATALOGUE)
    if (url.endsWith('/modeles/CONVOCATION') && options.method === 'PUT') {
      return ok({ type: 'CONVOCATION', statut: 'PERSONNALISE', nb_formations_utilisant: 0, nb_formations: 0 })
    }
    if (url.endsWith('/modeles/convocation')) {
      return ok({ type: 'CONVOCATION', nom: 'Convocation', statut: 'ORIGINE', contenu,
        variables: [{ code: 'org_nom', libelle: 'Nom de l’organisme' }, { code: 'formation_intitule', libelle: 'Intitulé de la formation' }] })
    }
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

async function ouvrir(contenu) {
  const fetchMock = simulerBackend(contenu)
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/modeles/generiques/convocation'] })} />)
  const document = await screen.findByRole('textbox', { name: 'Convocation' })
  return { fetchMock, document, editeur: document.editor, panneau: screen.getByRole('complementary', { name: 'Variables' }) }
}
const etiquettes = (racine) => [...racine.querySelectorAll('.doc-variable')].map((e) => e.textContent)
const contenuEnvoye = (fetchMock) => JSON.parse(fetchMock.mock.calls.find(([, o]) => o?.method === 'PUT')[1].body).contenu
function placerCurseur(editeur, texte) {
  let position = null
  editeur.state.doc.descendants((n, pos) => {
    if (position === null && n.isText && n.text.includes(texte)) position = pos + n.text.indexOf(texte) + texte.length
  })
  act(() => { editeur.commands.setTextSelection(position) })
}

describe('Panneau Variables (SCRUM-214)', () => {
  it('CA1 (RG10) : catégories dans l’ordre reçu du backend, libellés de la maquette', async () => {
    const { panneau } = await ouvrir()
    expect(within(panneau).getByRole('heading', { level: 2, name: 'Variables' })).toBeTruthy()
    expect(within(panneau).getByText('Glissez une variable dans le document, ou cliquez dessus pour l’insérer à l’endroit du curseur.')).toBeTruthy()
    expect(within(panneau).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(RG10)
    const session = within(panneau).getByRole('group', { name: 'Session' })
    expect(within(session).getAllByRole('button').map((b) => b.textContent)).toEqual(['Date de début', 'Lieu'])
    expect(within(session).getByRole('button', { name: 'Date de début' }).title).toBe('{{session_date_debut}}')
  })

  it('CA3 : curseur dans le texte + clic sur une variable -> étiquette insérée à l’endroit du curseur', async () => {
    const { document, editeur, panneau } = await ouvrir()
    placerCurseur(editeur, 'Bonjour')
    fireEvent.click(within(panneau).getByRole('button', { name: 'Prénom' }))
    const paragraphe = document.querySelector('p')
    expect(paragraphe.textContent.startsWith('BonjourPrénom le stagiaire')).toBe(true)
    expect(paragraphe.querySelector('.doc-variable').textContent).toBe('Prénom')
    expect(paragraphe.querySelector('.doc-variable').getAttribute('contenteditable')).toBe('false')
  })

  it('CA2 : variable glissée puis lâchée dans le texte -> étiquette à l’endroit du lâcher', async () => {
    const { document, editeur } = await ouvrir()
    let cible = null
    editeur.state.doc.descendants((n, pos) => { if (cible === null && n.isText && n.text.startsWith('Bonjour')) cible = pos + 'Bonjour '.length })
    editeur.view.posAtCoords = () => ({ pos: cible, inside: -1 }) // jsdom ne calcule pas de position à l'écran
    const donnees = { [GLISSER_VARIABLE]: 'session_lieu' }
    fireEvent.drop(document, { clientX: 10, clientY: 10, dataTransfer: { getData: (t) => donnees[t] || '', types: Object.keys(donnees), files: [] } })
    expect(document.querySelector('p').textContent.startsWith('Bonjour Lieule stagiaire')).toBe(true)
  })

  it('glisser autre chose qu’une variable : l’éditeur garde son comportement normal', async () => {
    const { document, editeur } = await ouvrir()
    editeur.view.posAtCoords = () => null
    fireEvent.drop(document, { dataTransfer: { getData: () => '', types: [], files: [] } })
    expect(etiquettes(document)).toEqual(['Nom de l’organisme', 'Intitulé de la formation'])
  })

  it('CA4 : aperçu coché -> valeurs d’exemple, document non modifiable ; décoché -> étiquettes', async () => {
    const { document, panneau } = await ouvrir()
    const apercu = screen.getByRole('checkbox', { name: 'Aperçu avec des données d’exemple' })
    fireEvent.click(apercu)
    const exemple = screen.getByRole('article', { name: 'Convocation (aperçu)' })
    expect(etiquettes(exemple)).toEqual(['Cap Compétences', 'Management d’équipe'])
    expect(exemple.closest('.edt-apercu')).toBeTruthy()
    expect(document.closest('.edt-zone').hidden).toBe(true)
    expect(screen.getByRole('button', { name: 'Gras' }).closest('fieldset').disabled).toBe(true)
    expect(within(panneau).getByRole('button', { name: 'Prénom' }).disabled).toBe(true)
    fireEvent.click(apercu)
    expect(screen.queryByRole('article', { name: 'Convocation (aperçu)' })).toBeNull()
    expect(document.closest('.edt-zone').hidden).toBe(false)
    expect(etiquettes(document)).toEqual(['Nom de l’organisme', 'Intitulé de la formation'])
  })

  it('CA5 (RG9) : enregistré sous {{code}}, jamais sous la valeur d’exemple (même pendant l’aperçu)', async () => {
    const { fetchMock, editeur, panneau } = await ouvrir()
    placerCurseur(editeur, 'Bonjour')
    fireEvent.click(within(panneau).getByRole('button', { name: 'Date de début' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Aperçu avec des données d’exemple' }))
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await screen.findByText('Modèle générique enregistré.')
    const contenu = contenuEnvoye(fetchMock)
    expect(contenu).toContain('<p>Bonjour{{session_date_debut}} le stagiaire')
    expect(contenu).toContain('{{org_nom}}')
    for (const exemple of ['12/01/2027', 'Cap Compétences', 'Management d’équipe']) expect(contenu).not.toContain(exemple)
  })

  it('variable inconnue du dictionnaire : étiquette avec son code, sans planter (et gardée à l’enregistrement)', async () => {
    const { fetchMock, document } = await ouvrir('<p>Code client : {{code_client_externe}} et {{org_nom}}</p>')
    expect(etiquettes(document)).toEqual(['code_client_externe', 'Nom de l’organisme'])
    fireEvent.click(screen.getByRole('checkbox', { name: 'Aperçu avec des données d’exemple' }))
    expect(etiquettes(screen.getByRole('article', { name: 'Convocation (aperçu)' }))).toEqual(['code_client_externe', 'Cap Compétences'])
    fireEvent.click(screen.getByRole('checkbox', { name: 'Aperçu avec des données d’exemple' }))
    act(() => { document.editor.commands.insertContent(' ') })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await screen.findByText('Modèle générique enregistré.')
    expect(contenuEnvoye(fetchMock)).toContain('{{code_client_externe}}')
  })
})

describe('PanneauVariables seul (réutilisable, SCRUM-219)', () => {
  it('annonce la variable cliquée et prépare le glisser-déposer', () => {
    const onInserer = vi.fn()
    render(<PanneauVariables variables={CATALOGUE.slice(0, 2)} onInserer={onInserer} />)
    const lieu = screen.getByRole('button', { name: 'Lieu' })
    fireEvent.click(lieu)
    expect(onInserer).toHaveBeenCalledWith('session_lieu')
    const donnees = {}
    fireEvent.dragStart(lieu, { dataTransfer: { setData: (t, v) => { donnees[t] = v }, effectAllowed: '' } })
    expect(donnees).toEqual({ [GLISSER_VARIABLE]: 'session_lieu' })
    expect(lieu.getAttribute('draggable')).toBe('true')
  })
})
