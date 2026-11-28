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
const HUGO = { ...inscrit(6, 'Hugo', 'Weber', { entreprise: 'Société Durand' }), nombre_sessions: 0 }
const ok = (json, status = 200) => ({ ok: status < 400, status, json: async () => json })

function simulerBackend({ inscrits = [SOPHIE, CAMILLE, THOMAS], places = 8 } = {}) {
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
      actuels = [...actuels, ...[KARIM, HUGO].filter((p) => ids.includes(p.id))]
      return ok({ nombre_places: places, apprenants: actuels }, 201)
    }
    const retrait = url.match(/\/sessions\/5\/apprenants\/(\d+)\/$/)
    if (retrait && options.method === 'DELETE') {
      actuels = actuels.filter((a) => a.id !== Number(retrait[1]))
      return liste()
    }
    if (url.endsWith('/sessions/5/apprenants/')) return liste()
    if (url.endsWith('/apprenants/')) return ok([SOPHIE, KARIM, HUGO]) // apprenants du centre (Sophie : déjà inscrite)
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

  it('CA2 : ajout de 2 apprenants : ils apparaissent, le nombre de l’onglet et les inscrits de l’en-tête sont mis à jour', async () => {
    const fetchMock = await ouvrirOnglet()
    fireEvent.click(screen.getByRole('button', { name: /Ajouter des apprenants/ }))
    const panneau = await screen.findByRole('dialog', { name: 'Ajouter des apprenants' })
    expect(within(panneau).getByText('Excel avancé · 5 places restantes')).toBeTruthy()
    // Sophie est déjà inscrite : seuls Karim et Hugo sont proposés
    const choix = await within(panneau).findAllByRole('checkbox')
    expect(choix).toHaveLength(2)
    expect(within(panneau).getByText('Individuel · karim@exemple.fr')).toBeTruthy()
    const ajouter = within(panneau).getByRole('button', { name: 'Ajouter' })
    expect(ajouter.disabled).toBe(true)
    choix.forEach((c) => fireEvent.click(c))
    expect(within(panneau).getByText('2 sélectionnés')).toBeTruthy()
    fireEvent.click(ajouter)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    const [, options] = fetchMock.mock.calls.find(([u, o]) => u.endsWith('/sessions/5/apprenants/') && o?.method === 'POST')
    expect(JSON.parse(options.body)).toEqual({ apprenants: [4, 6] })
    expect(lignes()).toHaveLength(5)
    expect(titre()).toBe('Apprenants · 5 / 8 · 3 places restantes')
    await waitFor(() => expect(nombreOnglet()).toBe('5'))
    expect(screen.getByText('5 / 8 inscrits')).toBeTruthy()
  })

  it('CA3 : plus d’apprenants cochés que de places restantes : ajout bloqué avec un message', async () => {
    const fetchMock = await ouvrirOnglet({ places: 4 })
    expect(titre()).toBe('Apprenants · 3 / 4 · 1 place restante')
    fireEvent.click(screen.getByRole('button', { name: /Ajouter des apprenants/ }))
    const panneau = await screen.findByRole('dialog', { name: 'Ajouter des apprenants' })
    ;(await within(panneau).findAllByRole('checkbox')).forEach((c) => fireEvent.click(c))
    fireEvent.click(within(panneau).getByRole('button', { name: 'Ajouter' }))
    expect(within(panneau).getByRole('alert').textContent).toBe('Trop d’apprenants : 2 cochés pour 1 place restante.')
    expect(fetchMock.mock.calls.some(([, o]) => o?.method === 'POST')).toBe(false)
    expect(lignes()).toHaveLength(3)
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

describe('Textes de l’onglet Apprenants', () => {
  it('places restantes, session sans nombre de places, « Inscrit via » sans statut', () => {
    expect(resumePlaces({ nombre_places: null, apprenants: [SOPHIE] })).toBe('1 inscrit')
    expect(resumePlaces({ nombre_places: 2, apprenants: [SOPHIE, THOMAS] })).toBe('2 / 2 · 0 place restante')
    expect(inscritVia(inscrit(9, 'Eva', 'Blanc'))).toEqual({ titre: 'Individuel', detail: '' })
    expect(inscritVia(inscrit(9, 'Eva', 'Blanc', { entreprise: 'Ancienne SARL' }))).toEqual({ titre: 'Ancienne SARL', detail: '' })
  })
})
