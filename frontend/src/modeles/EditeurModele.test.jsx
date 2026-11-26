import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { routes } from '../App'
import { depuisEditeur, versEditeur } from './editeur/extensions'
import { messageEnregistrement } from './serviceApi'

// SCRUM-213 « Modifier un modèle dans l'éditeur » (RG3, RG6, RG8, RG12) : GET et PUT /modeles/<type> simulés
const CONTENU = '<div class="eh"><span class="logo-ph">LOGO</span><span>{{org_nom}}<br>SIRET {{org_siret}}</span></div>'
  + '<h1>CONVENTION DE FORMATION PROFESSIONNELLE</h1>'
  + '<p style="text-align:center">Articles L6353-1 et suivants du Code du travail</p>'
  + '<p>Entre <b>{{org_nom}}</b> et le client. <em class="cond">Si salarié :</em> texte.</p>'
  + '<h3 style="margin-top:18px">Article 1 – Objet</h3><ul><li>Intitulé : {{formation_intitule}}</li></ul>'
const VARIABLES = [{ code: 'org_nom', libelle: 'Nom de l’organisme' }, { code: 'org_siret', libelle: 'SIRET de l’organisme' },
  { code: 'formation_intitule', libelle: 'Intitulé de la formation' }]
const ok = (json) => ({ ok: true, status: 200, json: async () => json })

function simulerBackend({ contenu = CONTENU, put = (corps) => ok({ type: 'CONVENTION', statut: 'PERSONNALISE', contenu: corps.contenu,
  variables: VARIABLES, nb_formations_utilisant: 4, nb_formations: 4 }) } = {}) {
  const fetchMock = vi.fn(async (url, options = {}) => {
    if (url.endsWith('/auth/moi')) return ok({ id: 1, email: 'camille@organisme.fr' })
    if (url.endsWith('/modeles/CONVENTION') && options.method === 'PUT') return put(JSON.parse(options.body))
    if (url.endsWith('/modeles/convention')) {
      return ok({ type: 'CONVENTION', nom: 'Convention de formation', statut: 'ORIGINE', contenu, variables: VARIABLES })
    }
    if (url.endsWith('/modeles/')) return ok({ modeles: [] })
    return ok([])
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
// jsdom ne calcule pas la position du texte à l'écran (utilisée par l'éditeur pour faire défiler jusqu'au curseur)
beforeAll(() => {
  const vide = () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] })
  Range.prototype.getClientRects ??= vide
  Range.prototype.getBoundingClientRect ??= () => new DOMRect()
})

async function ouvrir() {
  const router = createMemoryRouter(routes, { initialEntries: ['/modeles/generiques/convention'] })
  render(<RouterProvider router={router} />)
  const document = await screen.findByRole('textbox', { name: 'Convention de formation' })
  return { router, document, editeur: document.editor }
}
const puts = (fetchMock) => fetchMock.mock.calls.filter(([, o]) => o?.method === 'PUT')
const bouton = (nom) => within(screen.getByRole('toolbar', { name: 'Mise en forme' })).getByRole('button', { name: nom })
// Sélectionne un texte du document (comme à la souris)
function selectionner(editeur, texte) {
  let debut = null
  editeur.state.doc.descendants((n, pos) => {
    if (debut === null && n.isText && n.text.includes(texte)) debut = pos + n.text.indexOf(texte)
  })
  act(() => { editeur.commands.setTextSelection({ from: debut, to: debut + texte.length }) })
}

describe('Éditeur d’un modèle générique (SCRUM-213)', () => {
  it('en-tête de la maquette : titre, consigne, boutons inactifs des US suivantes, panneau Variables', async () => {
    simulerBackend()
    await ouvrir()
    expect(screen.getByRole('heading', { level: 1, name: 'Convention de formation' })).toBeTruthy()
    expect(screen.getByText(/Modifiez le texte librement/)).toBeTruthy()
    for (const nom of ['Télécharger en Word', 'Voir le modèle d’origine']) {
      expect(screen.getByRole('button', { name: nom }).disabled).toBe(true)
    }
    expect(screen.getByRole('button', { name: 'Utiliser mon propre document Word' }).disabled).toBe(false) // SCRUM-215
    expect(screen.getByRole('button', { name: 'Enregistrer' }).disabled).toBe(false)
    expect(within(screen.getByRole('complementary', { name: 'Variables' })).getByRole('heading', { name: 'Variables' })).toBeTruthy()
    // Barre complète, une info-bulle par bouton
    for (const nom of ['Annuler', 'Rétablir', 'Gras', 'Italique', 'Souligné', 'Barré', 'Aligner à gauche', 'Centrer',
      'Aligner à droite', 'Justifier', 'Liste à puces', 'Liste numérotée', 'Effacer la mise en forme']) {
      expect(bouton(nom).title).toContain(nom)
    }
    expect(bouton('Gras').title).toBe('Gras (Ctrl+B)')
    expect(screen.getByLabelText('Couleur du texte')).toBeTruthy()
    expect([...screen.getByRole('combobox', { name: 'Style du paragraphe' }).options].map((o) => o.text))
      .toEqual(['Texte normal', 'Titre 1', 'Titre 2'])
  })

  it('les variables et l’en-tête du document s’affichent en étiquettes, jamais en {{code}}', async () => {
    simulerBackend()
    const { document } = await ouvrir()
    expect([...document.querySelectorAll('.doc-variable')].map((e) => e.textContent))
      .toEqual(['Nom de l’organisme', 'SIRET de l’organisme', 'Nom de l’organisme', 'Intitulé de la formation'])
    expect(document.textContent).not.toContain('{{')
    expect(document.querySelector('.doc-entete .doc-logo').textContent).toBe('LOGO')
  })

  it('CA1 : texte sélectionné + « Gras » -> texte en gras et bouton mis en évidence', async () => {
    simulerBackend()
    const { document, editeur } = await ouvrir()
    selectionner(editeur, 'le client')
    expect(bouton('Gras').getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(bouton('Gras'))
    expect(document.querySelector('strong:last-of-type')?.textContent).toBe('le client')
    expect(bouton('Gras').getAttribute('aria-pressed')).toBe('true')
    expect(bouton('Gras').className).toContain('on')
  })

  it('CA2 : curseur dans un paragraphe + « Titre 1 » -> le paragraphe devient un titre', async () => {
    simulerBackend()
    const { document, editeur } = await ouvrir()
    selectionner(editeur, 'Articles L6353-1')
    const style = screen.getByRole('combobox', { name: 'Style du paragraphe' })
    expect(style.value).toBe('p')
    fireEvent.change(style, { target: { value: 'h1' } })
    expect([...document.querySelectorAll('h1')].map((h) => h.textContent)).toContain('Articles L6353-1 et suivants du Code du travail')
    expect(style.value).toBe('h1')
    fireEvent.change(style, { target: { value: 'h3' } })
    expect([...document.querySelectorAll('h3')].map((h) => h.textContent)).toContain('Articles L6353-1 et suivants du Code du travail')
  })

  it('autres boutons : italique, souligné, barré, alignement, listes, couleur, effacer, annuler', async () => {
    simulerBackend()
    const { document, editeur } = await ouvrir()
    selectionner(editeur, 'texte')
    for (const [nom, balise] of [['Italique', 'em'], ['Souligné', 'u'], ['Barré', 's']]) {
      fireEvent.click(bouton(nom))
      expect(document.querySelector(`${balise}:not(.cond)`)?.textContent).toBe('texte')
    }
    fireEvent.change(screen.getByLabelText('Couleur du texte'), { target: { value: '#b91c1c' } })
    expect(editeur.getHTML()).toMatch(/color: (#b91c1c|rgb\(185, 28, 28\))/)
    fireEvent.click(bouton('Justifier'))
    expect(bouton('Justifier').getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(bouton('Liste numérotée'))
    expect(document.querySelector('ol')).toBeTruthy()
    fireEvent.click(bouton('Liste à puces'))
    expect(bouton('Liste à puces').getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(bouton('Effacer la mise en forme'))
    expect(bouton('Italique').getAttribute('aria-pressed')).toBe('false')
    expect(bouton('Annuler').disabled).toBe(false)
    fireEvent.click(bouton('Annuler'))
    expect(bouton('Rétablir').disabled).toBe(false)
    fireEvent.click(bouton('Rétablir'))
    selectionner(editeur, 'Articles')
    fireEvent.change(screen.getByRole('combobox', { name: 'Style du paragraphe' }), { target: { value: 'p' } })
    fireEvent.click(bouton('Aligner à gauche'))
    fireEvent.click(bouton('Aligner à droite'))
    fireEvent.click(bouton('Centrer'))
    expect(bouton('Centrer').getAttribute('aria-pressed')).toBe('true')
  })

  it('CA3 (RG6) : « Enregistrer » envoie le document modifié et affiche le nombre de formations', async () => {
    const fetchMock = simulerBackend()
    const { editeur } = await ouvrir()
    selectionner(editeur, 'le client')
    fireEvent.click(bouton('Gras'))
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(await screen.findByText('Modèle générique enregistré. 4 formations sur 4 utilisent automatiquement cette nouvelle version (celles qui n’ont pas adapté ce document).')).toBeTruthy()
    const [[url, options]] = puts(fetchMock)
    expect(url).toBe('/api/modeles/CONVENTION')
    const { contenu } = JSON.parse(options.body)
    expect(contenu).toContain('<strong>le client</strong>')
    expect(contenu).toContain('{{org_nom}}')
    expect(contenu).not.toContain('data-variable')
  })

  it('CA3 : erreur du backend (400) affichée, l’éditeur garde les modifications', async () => {
    simulerBackend({ put: () => ({ ok: false, status: 400, json: async () => ({ code: 'CONTENU_INVALIDE', detail: 'Le document est trop volumineux pour être enregistré.' }) }) })
    const { document } = await ouvrir()
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Le document est trop volumineux pour être enregistré.')
    expect(document.textContent).toContain('CONVENTION DE FORMATION PROFESSIONNELLE')
  })

  it('CA4 (RG8) : modifié puis « ← Retour » sans enregistrer : rien n’est envoyé au serveur', async () => {
    const fetchMock = simulerBackend()
    const { router, editeur } = await ouvrir()
    selectionner(editeur, 'le client')
    fireEvent.click(bouton('Gras'))
    fireEvent.click(screen.getByRole('button', { name: '← Retour' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/modeles/generiques'))
    expect(puts(fetchMock)).toHaveLength(0)
  })

  it('CA5 : la mise en forme est conservée à la réouverture (et enregistrée telle quelle)', async () => {
    const enregistre = '<h1 style="text-align: center">MA CONVENTION</h1><p><strong>Gras</strong> <em>italique</em> <u>souligné</u> '
      + '<s>barré</s> <span style="color: #b91c1c">rouge</span> {{org_nom}}</p><ol><li><p>un</p></li></ol>'
    const fetchMock = simulerBackend({ contenu: enregistre })
    const { document } = await ouvrir()
    expect(document.querySelector('h1').style.textAlign).toBe('center')
    for (const [balise, texte] of [['strong', 'Gras'], ['em', 'italique'], ['u', 'souligné'], ['s', 'barré'], ['ol li', 'un']]) {
      expect(document.querySelector(balise).textContent).toBe(texte)
    }
    expect(document.querySelector('span[style]').style.color).toBe('rgb(185, 28, 28)')
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await screen.findByText(/Modèle générique enregistré/)
    expect(JSON.parse(puts(fetchMock)[0][1].body).contenu).toBe(enregistre)
  })
})

describe('Modèles d’origine : enregistrés sans perdre leur mise en page', () => {
  it('en-tête, texte conditionnel, alignement, marge haute et variables conservés', async () => {
    simulerBackend()
    const { editeur } = await ouvrir()
    // Contenu tel que l'éditeur l'enregistre (même document, relu par l'éditeur)
    expect(depuisEditeur(editeur.getHTML())).toBe('<div class="eh"><span class="logo-ph">LOGO</span><span>{{org_nom}}<br>SIRET {{org_siret}}</span></div>'
      + '<h1>CONVENTION DE FORMATION PROFESSIONNELLE</h1>'
      + '<p style="text-align: center;">Articles L6353-1 et suivants du Code du travail</p>'
      + '<p>Entre <strong>{{org_nom}}</strong> et le client. <em class="cond">Si salarié :</em> texte.</p>'
      + '<h3 style="margin-top: 18px;">Article 1 – Objet</h3><ul><li><p>Intitulé : {{formation_intitule}}</p></li></ul>')
  })

  it('versEditeur / depuisEditeur : {{code}} <-> variable, code invalide laissé en texte', () => {
    expect(versEditeur('<p>A {{ org_nom }} B</p>')).toBe('<p>A <span data-variable="org_nom">{{org_nom}}</span> B</p>')
    expect(depuisEditeur('<p>A <span data-variable="org_nom">{{org_nom}}</span> B</p>')).toBe('<p>A {{org_nom}} B</p>')
    expect(versEditeur('')).toBe('')
    expect(versEditeur('<p>{{ pas valide }}</p>')).toBe('<p>{{ pas valide }}</p>')
  })
})

describe('Message après « Enregistrer » (RG6)', () => {
  it('pluriel, singulier et aucune formation', () => {
    expect(messageEnregistrement({ nb_formations_utilisant: 1, nb_formations: 1 }))
      .toBe('Modèle générique enregistré. 1 formation sur 1 utilise automatiquement cette nouvelle version (celles qui n’ont pas adapté ce document).')
    expect(messageEnregistrement({ nb_formations_utilisant: 0, nb_formations: 0 })).toBe('Modèle générique enregistré.')
  })
})
