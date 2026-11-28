import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../App'
import { datesEtLieu, resumeParticipants } from './regleFiche'

// SCRUM-168 « Naviguer dans la fiche session » : GET /sessions/<id>/ simulé, compte connecté
const EXCEL = {
  id: 5, formation_intitule: 'Excel avancé', date_debut: '2026-12-03', date_fin: '2026-12-05', modalite: 'PRESENTIEL',
  lieu: 'Lyon', nombre_places: 8, formateurs: [{ id: 1, prenom: 'Nadia', nom: 'Haddad' }],
  entreprises: ['Atelier Leroy', 'Société Durand'],
  nombre_apprenants: 3, nombre_formateurs: 1, nombre_entreprises: 2, nombre_jours: 3,
}
const AGILE = {
  ...EXCEL, id: 6, formation_intitule: 'Gestion de projet agile', date_debut: '2026-12-10', date_fin: '2026-12-10',
  modalite: 'DISTANCIEL', lieu: '', nombre_places: 6, formateurs: [{ id: 2, prenom: 'Paul', nom: 'Durand' }],
  entreprises: [], nombre_apprenants: 2, nombre_entreprises: 0, nombre_jours: 1,
}
const ok = (json, status = 200) => ({ ok: status < 400, status, json: async () => json })

function simulerBackend() {
  const fetchMock = vi.fn(async (url) => {
    if (url.endsWith('/auth/moi')) return ok({ id: 1, email: 'camille@organisme.fr' })
    if (url.endsWith('/sessions/5/')) return ok(EXCEL)
    if (url.endsWith('/sessions/6/')) return ok(AGILE)
    if (url.endsWith('/sessions/99/')) return ok({ code: 'SESSION_INTROUVABLE', detail: 'Session introuvable' }, 404)
    if (url.endsWith('/sessions/7/')) return ok({}, 500)
    if (url.endsWith('/sessions/')) {
      return ok([{ id: 5, formation_intitule: 'Excel avancé', date_debut: '2026-12-03', date_fin: '2026-12-05', modalite: 'PRESENTIEL',
        lieu: 'Lyon', nombre_places: 8, nombre_apprenants: 3, formateurs_noms: [{ id: 1, prenom: 'Nadia', nom: 'Haddad' }] }])
    }
    return ok([])
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers() })

function afficher(adresse) {
  simulerBackend()
  const router = createMemoryRouter(routes, { initialEntries: [adresse] })
  render(<RouterProvider router={router} />)
  return router
}
const onglets = () => screen.getAllByRole('tab').map((t) => t.textContent)
const actif = () => screen.getAllByRole('tab').filter((t) => t.getAttribute('aria-selected') === 'true').map((t) => t.textContent)

describe('Fiche d’une session (SCRUM-168)', () => {
  it('CA1 : un clic sur une ligne de la liste ouvre la fiche, onglet « Aperçu » ouvert', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-28T10:00:00+01:00') }) // session à venir (SCRUM-167)
    const router = afficher('/sessions')
    const cellule = await screen.findByText('Lyon')
    fireEvent.click(cellule)
    await waitFor(() => expect(router.state.location.pathname).toBe('/sessions/5'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Excel avancé' })).toBeTruthy()
    expect(actif()).toEqual(['Aperçu'])
  })

  it('le lien du nom de la formation ouvre aussi la fiche (clavier)', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-28T10:00:00+01:00') })
    const router = afficher('/sessions')
    fireEvent.click(await screen.findByRole('link', { name: 'Excel avancé' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/sessions/5'))
  })

  it('CA2 : en-tête et nombres des onglets (3 apprenants, 1 formateur, 2 entreprises, 3 jours), dans l’ordre', async () => {
    afficher('/sessions/5')
    await screen.findByRole('heading', { level: 1, name: 'Excel avancé' })
    expect(screen.getByText('Du 03/12/2026 au 05/12/2026 · Présentiel · Lyon')).toBeTruthy()
    for (const texte of ['3 / 8 inscrits', 'Formateur : Nadia Haddad', 'Atelier Leroy, Société Durand']) {
      expect(screen.getByText(texte)).toBeTruthy()
    }
    expect(onglets()).toEqual(['Aperçu', 'Apprenants3', 'Formateurs1', 'Entreprises2', 'Planning3 j',
      'Documents', 'Questionnaires', 'Quiz', 'Suivi des envois'])
    expect(screen.getByRole('tabpanel').textContent).toBe('Bientôt disponible')
  })

  it('CA3 : session en distanciel, apprenants sans entreprise : « Distanciel » et rien à la place des entreprises', async () => {
    afficher('/sessions/6')
    await screen.findByRole('heading', { level: 1, name: 'Gestion de projet agile' })
    expect(screen.getByText('Du 10/12/2026 au 10/12/2026 · Distanciel')).toBeTruthy()
    // Aucune entreprise : rien après le formateur (choix de la BA, plus de « — »)
    expect(screen.queryByText('—')).toBeNull()
    expect([...document.querySelectorAll('.fs-infos > span')].map((e) => e.textContent))
      .toEqual(['2 / 6 inscrits', 'Formateur : Paul Durand'])
    expect(within(screen.getByRole('tab', { name: /Entreprises/ })).getByText('0')).toBeTruthy()
    expect(within(screen.getByRole('tab', { name: /Planning/ })).getByText('1 j')).toBeTruthy()
  })

  it('CA4 : un clic sur un onglet le rend actif et affiche « Bientôt disponible », sans recharger la page', async () => {
    afficher('/sessions/5')
    await screen.findByRole('heading', { level: 1, name: 'Excel avancé' })
    const appels = fetch.mock.calls.length
    for (const nom of [/Formateurs/, /Planning/, /Suivi des envois/]) { // Apprenants : contenu SCRUM-179
      const onglet = screen.getByRole('tab', { name: nom })
      fireEvent.click(onglet)
      expect(onglet.getAttribute('aria-selected')).toBe('true')
      expect(onglet.className).toContain('actif')
      expect(screen.getAllByRole('tab').filter((t) => t.getAttribute('aria-selected') === 'true')).toHaveLength(1)
      expect(screen.getByRole('tabpanel').textContent).toBe('Bientôt disponible')
    }
    expect(fetch.mock.calls.length).toBe(appels) // rien n'est rechargé
  })

  it('CA5 : « ‹ Sessions » revient à la liste des sessions', async () => {
    const router = afficher('/sessions/5')
    await screen.findByRole('heading', { level: 1, name: 'Excel avancé' })
    fireEvent.click(screen.getByRole('link', { name: '‹ Sessions' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/sessions'))
  })

  it('CA6 : session inexistante ou d’un autre centre : « Session introuvable », lien de retour, pas d’onglets', async () => {
    afficher('/sessions/99')
    expect(await screen.findByText('Session introuvable')).toBeTruthy()
    expect(screen.getByRole('link', { name: '‹ Sessions' })).toBeTruthy()
    expect(screen.queryByRole('tab')).toBeNull()
  })

  it('CA7 : les onglets Participants et Émargement et la liste des documents de l’ancienne page n’apparaissent plus', async () => {
    afficher('/sessions/5')
    await screen.findByRole('heading', { level: 1, name: 'Excel avancé' })
    expect(screen.queryByRole('tab', { name: 'Participants' })).toBeNull()
    expect(screen.queryByRole('tab', { name: 'Émargement' })).toBeNull()
    expect(screen.queryByRole('table', { name: 'Documents de la session' })).toBeNull()
    expect(screen.queryByText('Modèle utilisé')).toBeNull()
    expect(fetch.mock.calls.some(([u]) => u.includes('/documents/'))).toBe(false)
  })

  it('autre erreur du serveur : message d’erreur de chargement', async () => {
    afficher('/sessions/7')
    await waitFor(() => expect(screen.queryByText('Chargement de la session…')).toBeNull())
    expect(screen.queryByText('Session introuvable')).toBeNull()
    expect(screen.getByRole('link', { name: '‹ Sessions' })).toBeTruthy()
  })
})

describe('Textes de l’en-tête', () => {
  it('mixte avec lieu, sans nombre de places, plusieurs formateurs', () => {
    const s = { ...EXCEL, modalite: 'MIXTE', nombre_places: null, nombre_apprenants: 1,
      formateurs: [{ prenom: 'Nadia', nom: 'Haddad' }, { prenom: 'Paul', nom: 'Durand' }] }
    expect(datesEtLieu(s)).toBe('Du 03/12/2026 au 05/12/2026 · Mixte · Lyon')
    expect(resumeParticipants(s)).toEqual(['1 inscrit', 'Formateurs : Nadia Haddad, Paul Durand', 'Atelier Leroy, Société Durand'])
    expect(resumeParticipants({ ...s, formateurs: [], entreprises: [] })).toEqual(['1 inscrit', 'Formateur : —'])
  })
})
