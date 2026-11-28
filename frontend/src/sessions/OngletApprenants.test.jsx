import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../App'
import { inscritVia, resumePlaces } from './regleFiche'

// SCRUM-179 « Gérer les apprenants de la session » : GET /sessions/5/, GET / POST /sessions/5/apprenants/,
// DELETE /sessions/5/apprenants/<id>/ et GET /apprenants/ simulés, compte connecté
const inscrit = (id, prenom, nom, autres = {}) => ({
  id, prenom, nom, email: `${prenom.toLowerCase()}@exemple.fr`, statut: '', entreprise: '', poste: '', ...autres,
})
const SOPHIE = inscrit(1, 'Sophie', 'Leroy', { statut: 'SALARIE', entreprise: 'Atelier Leroy', poste: 'Gérante' })
const CAMILLE = inscrit(2, 'Camille', 'Martin', { statut: 'SALARIE', entreprise: 'Société Durand', poste: 'Cheffe de projet' })
const THOMAS = inscrit(3, 'Thomas', 'Petit', { statut: 'DEMANDEUR_EMPLOI' })
const KARIM = { ...inscrit(4, 'Karim', 'Benali', { statut: 'INDEPENDANT' }), nombre_sessions: 0 }
const HUGO = { ...inscrit(6, 'Hugo', 'Weber', { statut: 'SALARIE', entreprise: 'Société Durand' }), nombre_sessions: 0 }
const INES = { ...inscrit(7, 'Inès', 'Morel', { statut: 'SALARIE', entreprise: 'Société Durand' }), nombre_sessions: 0 }
const LEA = { ...inscrit(8, 'Léa', 'Fontaine', { statut: 'SALARIE', entreprise: 'Atelier Leroy' }), nombre_sessions: 0 }
const NICOLAS = { ...inscrit(9, 'Nicolas', 'Garnier'), nombre_sessions: 0 }
// Apprenants du centre (GET /apprenants/, triés par nom) ; Sophie est déjà inscrite
const CENTRE = [KARIM, LEA, NICOLAS, SOPHIE, INES, HUGO]
const NOUVEAU = { ...inscrit(20, 'Zoé', 'Roux', { statut: 'PARTICULIER' }), nombre_sessions: 0 }
const ok = (json, status = 200) => ({ ok: status < 400, status, json: async () => json })

function simulerBackend({ inscrits = [SOPHIE, CAMILLE, THOMAS], places = 8, inscriptionRefusee = false } = {}) {
  let actuels = inscrits
  const fiche = () => ({
    id: 5, formation_intitule: 'Excel avancé', date_debut: '2026-12-03', date_fin: '2026-12-05', modalite: 'PRESENTIEL',
    lieu: 'Lyon', nombre_places: places, formateurs: [{ id: 1, prenom: 'Nadia', nom: 'Haddad' }], entreprises: [],
    nombre_apprenants: actuels.length, nombre_formateurs: 1, nombre_entreprises: 0, nombre_jours: 3,
  })
  const liste = () => ok({ nombre_places: places, apprenants: actuels })
  const fetchMock = vi.fn(async (url, options = {}) => {
    if (url.endsWith('/auth/moi')) return ok({ id: 1, email: 'camille@organisme.fr' })
    if (url.endsWith('/sessions/5/')) return ok(fiche())
    if (url.endsWith('/apprenants/') && url.includes('/sessions/5/') && options.method === 'POST') {
      const ids = JSON.parse(options.body).apprenants
      if (inscriptionRefusee) return ok({ code: 'TROP_APPRENANTS', detail: 'Trop d’apprenants : 1 cochés pour 0 place restante.' }, 400)
      actuels = [...actuels, ...[...CENTRE, NOUVEAU].filter((p) => ids.includes(p.id))]
      return ok({ nombre_places: places, apprenants: actuels }, 201)
    }
    const retrait = url.match(/\/sessions\/5\/apprenants\/(\d+)\/$/)
    if (retrait && options.method === 'DELETE') {
      actuels = actuels.filter((a) => a.id !== Number(retrait[1]))
      return liste()
    }
    if (url.endsWith('/sessions/5/apprenants/')) return liste()
    if (url.endsWith('/apprenants/') && options.method === 'POST') return ok(NOUVEAU, 201) // « Nouvel apprenant » (SCRUM-112)
    if (url.endsWith('/apprenants/')) return ok(CENTRE)
    return ok([])
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

async function ouvrirOnglet(options) {
  const fetchMock = simulerBackend(options)
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/sessions/5'] })} />)
  await screen.findByRole('heading', { level: 1, name: 'Excel avancé' })
  fireEvent.click(screen.getByRole('tab', { name: /Apprenants/ }))
  await screen.findByRole('heading', { level: 2, name: /Apprenants/ })
  return fetchMock
}
const lignes = () => within(screen.getByRole('table')).getAllByRole('row').slice(1)
const texteLignes = () => lignes().map((r) => r.textContent)
const titre = () => screen.getByRole('heading', { level: 2, name: /Apprenants/ }).textContent
const nombreOnglet = () => within(screen.getByRole('tab', { name: /Apprenants/ })).getByText(/\d/).textContent
const ouvrirMenu = (nom) => fireEvent.click(screen.getByRole('button', { name: `Actions pour ${nom}` }))

describe('Onglet Apprenants de la fiche session (SCRUM-179)', () => {
  it('CA1 : les 3 inscrits avec leur entreprise (« Salarié · poste ») ou « Individuel »', async () => {
    await ouvrirOnglet()
    expect(titre()).toBe('Apprenants · 3 / 8 · 5 places restantes')
    expect(within(screen.getByRole('table')).getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['', 'Nom', 'Inscrit via', ''])
    expect(texteLignes()).toEqual([
      'SLSophie Leroysophie@exemple.frAtelier LeroySalarié · Gérante',
      'CMCamille Martincamille@exemple.frSociété DurandSalarié · Cheffe de projet',
      'TPThomas Petitthomas@exemple.frIndividuelDemandeur d’emploi',
    ])
  })

  it('CA4 : retrait confirmé : l’apprenant disparaît de la liste', async () => {
    const fetchMock = await ouvrirOnglet()
    ouvrirMenu('Sophie Leroy')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Retirer de la session' }))
    const fenetre = screen.getByRole('dialog', { name: 'Retirer Sophie Leroy de la session ?' })
    expect(within(fenetre).getByText('Sophie Leroy ne fera plus partie de cette session.')).toBeTruthy()
    fireEvent.click(within(fenetre).getByRole('button', { name: 'Retirer' }))
    await waitFor(() => expect(lignes()).toHaveLength(2))
    expect(screen.queryByText('Sophie Leroy')).toBeNull()
    expect(fetchMock.mock.calls.find(([, o]) => o?.method === 'DELETE')[0]).toMatch(/\/sessions\/5\/apprenants\/1\/$/)
    await waitFor(() => expect(nombreOnglet()).toBe('2'))
  })

  it('« Annuler » le retrait : rien ne change', async () => {
    const fetchMock = await ouvrirOnglet()
    ouvrirMenu('Thomas Petit')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Retirer de la session' }))
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(lignes()).toHaveLength(3)
    expect(fetchMock.mock.calls.some(([, o]) => o?.method === 'DELETE')).toBe(false)
  })

  it('CA5 : un seul apprenant : un message empêche de le retirer', async () => {
    const fetchMock = await ouvrirOnglet({ inscrits: [THOMAS] })
    ouvrirMenu('Thomas Petit')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Retirer de la session' }))
    expect(screen.getByRole('alert').textContent)
      .toBe('Impossible de retirer le dernier apprenant : une session doit garder au moins un apprenant.')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(fetchMock.mock.calls.some(([, o]) => o?.method === 'DELETE')).toBe(false)
  })

  it('le menu ⋯ se ferme au clic ailleurs et avec Échap', async () => {
    await ouvrirOnglet()
    ouvrirMenu('Sophie Leroy')
    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('menu')).toBeNull()
    ouvrirMenu('Sophie Leroy')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
  })
})

async function ouvrirPanneau(options) {
  const fetchMock = await ouvrirOnglet(options)
  fireEvent.click(screen.getByRole('button', { name: /Ajouter des apprenants/ }))
  const panneau = await screen.findByRole('dialog', { name: 'Ajouter des apprenants' })
  await within(panneau).findAllByRole('checkbox')
  return { fetchMock, panneau }
}
const nomsPanneau = (panneau) => within(panneau).getAllByRole('listitem').map((li) => li.querySelector('b')?.textContent)
const cocher = (panneau, nom) => fireEvent.click(within(within(panneau).getByText(nom).closest('li')).getByRole('checkbox'))
const rechercher = (panneau, texte) =>
  fireEvent.change(within(panneau).getByRole('searchbox', { name: 'Rechercher un apprenant ou une entreprise' }), { target: { value: texte } })

describe('Panneau « Ajouter des apprenants » (SCRUM-179, maquettes 04 à 06)', () => {
  it('liste à l’ouverture : apprenants du centre non inscrits, triés par nom, avec « Entreprise · Statut · e-mail » ou « Individuel »', async () => {
    const { panneau } = await ouvrirPanneau()
    expect(within(panneau).getByText('Excel avancé · 5 places restantes')).toBeTruthy()
    expect(nomsPanneau(panneau)).toEqual(['Karim Benali', 'Léa Fontaine', 'Nicolas Garnier', 'Inès Morel', 'Hugo Weber'])
    for (const texte of ['Individuel · Indépendant · karim@exemple.fr', 'Atelier Leroy · Salarié · léa@exemple.fr',
      'Individuel · nicolas@exemple.fr', 'Société Durand · Salarié · hugo@exemple.fr']) {
      expect(within(panneau).getByText(texte)).toBeTruthy()
    }
    expect(within(panneau).getByText('0 sélectionné')).toBeTruthy()
    expect(within(panneau).getByRole('button', { name: 'Ajouter' }).disabled).toBe(true)
    expect(within(panneau).getByText('Un apprenant absent de la liste ?')).toBeTruthy()
    expect(within(panneau).getByRole('button', { name: /Créer un apprenant/ })).toBeTruthy()
  })

  it('tous les apprenants du centre déjà inscrits : message exact', async () => {
    const { panneau } = await ouvrirPanneau({ inscrits: [SOPHIE, KARIM, LEA, NICOLAS, INES, HUGO], places: 10 })
      .catch(() => ({ panneau: screen.getByRole('dialog', { name: 'Ajouter des apprenants' }) }))
    expect(await within(panneau).findByText('Tous les apprenants du centre sont déjà inscrits à cette session.')).toBeTruthy()
  })

  it('filtre sans appel serveur, sans accents ni casse, sur le prénom, le nom ou l’entreprise ; croix ; aucun résultat', async () => {
    const { fetchMock, panneau } = await ouvrirPanneau()
    const appels = fetchMock.mock.calls.length
    rechercher(panneau, 'INES')
    expect(nomsPanneau(panneau)).toEqual(['Inès Morel'])
    rechercher(panneau, 'lea')
    expect(nomsPanneau(panneau)).toEqual(['Léa Fontaine'])
    rechercher(panneau, 'durand')
    expect(nomsPanneau(panneau)).toEqual(['Inès Morel', 'Hugo Weber'])
    rechercher(panneau, 'exemple.fr') // l'e-mail n'est pas cherché
    expect(within(panneau).getByText('Aucun apprenant ne correspond à « exemple.fr ».')).toBeTruthy()
    fireEvent.click(within(panneau).getByRole('button', { name: 'Effacer la recherche' }))
    expect(nomsPanneau(panneau)).toHaveLength(5)
    expect(fetchMock.mock.calls.length).toBe(appels)
  })

  it('les cases cochées le restent quand la recherche change ; « Ajouter (N) » ; ajout puis mise à jour', async () => {
    const { fetchMock, panneau } = await ouvrirPanneau()
    rechercher(panneau, 'Durand')
    cocher(panneau, 'Hugo Weber')
    expect(within(panneau).getByText('1 sélectionné')).toBeTruthy()
    rechercher(panneau, 'Karim')
    cocher(panneau, 'Karim Benali')
    rechercher(panneau, '')
    const coches = within(panneau).getAllByRole('checkbox').filter((c) => c.checked)
    expect(coches.map((c) => c.closest('li').querySelector('b').textContent)).toEqual(['Karim Benali', 'Hugo Weber'])
    expect(within(panneau).getByText('2 sélectionnés')).toBeTruthy()
    fireEvent.click(within(panneau).getByRole('button', { name: 'Ajouter (2)' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    const [, options] = fetchMock.mock.calls.find(([u, o]) => u.endsWith('/sessions/5/apprenants/') && o?.method === 'POST')
    expect(JSON.parse(options.body)).toEqual({ apprenants: [6, 4] })
    expect(lignes()).toHaveLength(5)
    expect(titre()).toBe('Apprenants · 5 / 8 · 3 places restantes')
    await waitFor(() => expect(nombreOnglet()).toBe('5'))
    expect(screen.getByText('5 / 8 inscrits')).toBeTruthy()
  })

  it('dépassement des places restantes : message et bouton désactivé, sans appel', async () => {
    const { fetchMock, panneau } = await ouvrirPanneau({ places: 4 })
    cocher(panneau, 'Karim Benali')
    expect(within(panneau).queryByRole('alert')).toBeNull()
    cocher(panneau, 'Hugo Weber')
    expect(within(panneau).getByRole('alert').textContent).toBe('Trop d’apprenants : 2 cochés pour 1 place restante.')
    expect(within(panneau).getByRole('button', { name: 'Ajouter (2)' }).disabled).toBe(true)
    cocher(panneau, 'Hugo Weber')
    expect(within(panneau).queryByRole('alert')).toBeNull()
    expect(within(panneau).getByRole('button', { name: 'Ajouter (1)' }).disabled).toBe(false)
    expect(fetchMock.mock.calls.some(([, o]) => o?.method === 'POST')).toBe(false)
  })

  it('« Créer un apprenant » : formulaire de la SCRUM-112 présenté comme la maquette 06 ; « ‹ Retour à la liste » garde les cases', async () => {
    const { panneau } = await ouvrirPanneau()
    cocher(panneau, 'Karim Benali')
    fireEvent.click(within(panneau).getByRole('button', { name: /Créer un apprenant/ }))
    const fenetre = screen.getByRole('dialog', { name: 'Créer un apprenant' })
    expect(within(fenetre).getByText('Il sera ajouté à la session « Excel avancé » après enregistrement')).toBeTruthy()
    expect(within(fenetre).getAllByRole('button').map((b) => b.textContent)).toEqual(['', '‹ Retour à la liste', 'Annuler', 'Enregistrer et ajouter'])
    expect(screen.queryByRole('dialog', { name: 'Ajouter des apprenants' })).toBeNull()
    fireEvent.click(within(fenetre).getByRole('button', { name: '‹ Retour à la liste' }))
    const retour = await screen.findByRole('dialog', { name: 'Ajouter des apprenants' })
    expect(within(retour).getByText('1 sélectionné')).toBeTruthy()
    expect(within(within(retour).getByText('Karim Benali').closest('li')).getByRole('checkbox').checked).toBe(true)
  })

  it('« Annuler » dans « Créer un apprenant » ferme le panneau', async () => {
    const { panneau } = await ouvrirPanneau()
    fireEvent.click(within(panneau).getByRole('button', { name: /Créer un apprenant/ }))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Créer un apprenant' })).getByRole('button', { name: 'Annuler' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  async function creerZoe(options) {
    const ouvert = await ouvrirPanneau(options)
    fireEvent.click(within(ouvert.panneau).getByRole('button', { name: /Créer un apprenant/ }))
    const fenetre = screen.getByRole('dialog', { name: 'Créer un apprenant' })
    fireEvent.change(within(fenetre).getByLabelText(/Prénom/), { target: { value: 'Zoé' } })
    fireEvent.change(within(fenetre).getByLabelText(/^Nom/), { target: { value: 'Roux' } })
    fireEvent.change(within(fenetre).getByLabelText(/E-mail/), { target: { value: 'zoe@exemple.fr' } })
    fireEvent.change(within(fenetre).getByLabelText(/Statut/), { target: { value: 'PARTICULIER' } })
    fireEvent.click(within(fenetre).getByRole('button', { name: 'Enregistrer et ajouter' }))
    return ouvert.fetchMock
  }

  it('création puis inscription : POST /apprenants/ puis POST /sessions/5/apprenants/, onglet et en-tête mis à jour', async () => {
    const fetchMock = await creerZoe()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    const posts = fetchMock.mock.calls.filter(([, o]) => o?.method === 'POST').map(([u, o]) => [u.replace(/^.*\/api/, ''), JSON.parse(o.body)])
    expect(posts[0][0]).toMatch(/\/apprenants\/$/)
    expect(posts[0][1]).toMatchObject({ prenom: 'Zoé', nom: 'Roux', email: 'zoe@exemple.fr', statut: 'PARTICULIER' })
    expect(posts[1]).toEqual([expect.stringMatching(/\/sessions\/5\/apprenants\/$/), { apprenants: [20] }])
    await waitFor(() => expect(lignes()).toHaveLength(4))
    expect(screen.getByText('Zoé Roux')).toBeTruthy()
    await waitFor(() => expect(nombreOnglet()).toBe('4'))
    expect(screen.getByText('4 / 8 inscrits')).toBeTruthy()
  })

  it('inscription refusée après la création : l’apprenant reste créé et un message l’indique', async () => {
    await creerZoe({ inscriptionRefusee: true })
    const retour = await screen.findByRole('dialog', { name: 'Ajouter des apprenants' })
    expect(within(retour).getByRole('alert').textContent).toBe(
      'L’apprenant « Zoé Roux » a été créé, mais n’a pas pu être ajouté à la session : Trop d’apprenants : 1 cochés pour 0 place restante.')
    expect(within(retour).getByText('Zoé Roux')).toBeTruthy()
    expect(lignes()).toHaveLength(3)
  })
})

describe('Textes de l’onglet Apprenants', () => {
  it('places restantes, session sans nombre de places, « Inscrit via » sans statut', () => {
    expect(resumePlaces({ nombre_places: null, apprenants: [SOPHIE] })).toBe('1 inscrit')
    expect(resumePlaces({ nombre_places: 2, apprenants: [SOPHIE, THOMAS] })).toBe('2 / 2 · 0 place restante')
    expect(inscritVia(inscrit(9, 'Eva', 'Blanc'))).toEqual({ titre: 'Individuel', detail: '' })
    expect(inscritVia(inscrit(9, 'Eva', 'Blanc', { entreprise: 'Ancienne SARL' }))).toEqual({ titre: 'Ancienne SARL', detail: '' })
  })
})
