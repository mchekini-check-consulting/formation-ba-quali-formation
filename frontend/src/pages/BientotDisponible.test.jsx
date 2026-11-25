import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../App'

// SCRUM-209 : menu latéral rangé par sections (évolution de SCRUM-19) et page « Bientôt disponible »
// GET /auth/moi : compte connecté ou personne (401) ; autres appels : listes vides
let connecte = false
beforeEach(() => {
  connecte = false
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    if (!url.endsWith('/auth/moi')) return { ok: true, status: 200, json: async () => [] }
    return connecte
      ? { ok: true, status: 200, json: async () => ({ id: 1, email: 'marie.arnaud@hitech.fr', prenom: 'Marie', nom: 'Arnaud',
        role: 'GESTIONNAIRE', organisme: { id: 1, raison_sociale: 'HiTech Formation' } }) }
      : { ok: false, status: 401, json: async () => ({ code: 'NON_CONNECTE' }) }
  }))
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

function afficher(adresse = '/tableau-de-bord') {
  const router = createMemoryRouter(routes, { initialEntries: [adresse] })
  render(<RouterProvider router={router} />)
  return router
}
const menu = () => screen.getByRole('navigation', { name: 'Menu principal' })
const textes = (elements) => [...elements].map((e) => e.textContent)

describe('Menu latéral (SCRUM-209)', () => {
  it('CA1 : sections et entrées de la maquette, dans l’ordre', () => {
    afficher()
    expect(textes(menu().querySelectorAll('.nav-titre'))).toEqual(['Organiser', 'Documents', 'Qualité'])
    expect(textes(menu().querySelectorAll('a, .nav-bientot'))).toEqual([
      'Tableau de bord', 'Formations et programmes', 'Sessions et planning', 'Parties prenantes', 'E-learningBientôt',
      'Modèles', 'Signature électroniqueBientôt', 'QualiopiBientôt',
    ])
    // Retirés du menu
    for (const retire of ['Documents', 'Émargement', 'Évaluations et satisfaction']) {
      expect(within(menu()).queryByRole('link', { name: retire })).toBeNull()
    }
  })

  it('CA1 : Paramètres puis le compte connecté en bas du menu : initiales et raison sociale (SCRUM-221 CA6), sans l’e-mail (SCRUM-19)', async () => {
    connecte = true
    afficher()
    const bas = document.querySelector('.nav-bas')
    expect(within(bas).getByRole('link', { name: 'Paramètres' })).toBeTruthy()
    expect(await within(bas).findByText('MA')).toBeTruthy()
    const centre = within(bas).getByText('HiTech Formation')
    expect(centre.getAttribute('title')).toBe('HiTech Formation') // texte complet si coupé avec « … »
    expect(bas.textContent).not.toContain('marie.arnaud@hitech.fr')
  })

  it('CA1 : personne n’est connecté, pas de compte en bas du menu', () => {
    afficher()
    expect(document.querySelector('.nav-compte')).toBeNull()
  })

  it('CA2 : une entrée « Bientôt » est grisée et un clic n’ouvre aucune page', () => {
    const router = afficher()
    for (const titre of ['E-learning', 'Signature électronique', 'Qualiopi']) {
      const entree = within(menu()).getByText(titre)
      expect(entree.closest('a')).toBeNull()
      expect(entree.getAttribute('aria-disabled')).toBe('true')
      fireEvent.click(entree)
      expect(router.state.location.pathname).toBe('/tableau-de-bord')
    }
  })

  it('CA3 : un élément développé ouvre sa page, mise en évidence dans le menu', async () => {
    const router = afficher()
    fireEvent.click(screen.getByRole('link', { name: 'Sessions et planning' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Sessions et planning' })).toBeTruthy()
    expect(router.state.location.pathname).toBe('/sessions')
    expect(screen.getByRole('link', { name: 'Sessions et planning' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('link', { name: 'Tableau de bord' }).getAttribute('aria-current')).toBeNull()
  })

  it('CA3 : sur une sous-page (nouvelle formation), son entrée reste mise en évidence', () => {
    afficher('/formations/nouvelle')
    expect(screen.getByRole('link', { name: 'Formations et programmes' }).getAttribute('aria-current')).toBe('page')
  })

  it('Paramètres ouvre la page « Bientôt disponible »', async () => {
    const router = afficher()
    fireEvent.click(within(document.querySelector('.nav-bas')).getByRole('link', { name: 'Paramètres' }))
    expect(router.state.location.pathname).toBe('/bientot-disponible/parametres')
    expect(await screen.findByRole('heading', { level: 1, name: 'Paramètres' })).toBeTruthy()
  })

  it('« Retour à Sessions et planning » quitte la page « Bientôt disponible »', async () => {
    const router = afficher('/bientot-disponible/qualiopi')
    expect(screen.getByRole('heading', { level: 1, name: 'Qualiopi' })).toBeTruthy()
    fireEvent.click(screen.getByRole('link', { name: 'Retour à Sessions et planning' }))
    expect(router.state.location.pathname).toBe('/sessions')
  })

  it('adresse inconnue : titre générique', () => {
    afficher('/bientot-disponible/inconnue')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Bientôt disponible')
  })
})
