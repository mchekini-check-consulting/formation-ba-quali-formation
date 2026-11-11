import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../App'

// SCRUM-19 : menu latéral (CA2, CA3) et page « Bientôt disponible » (CA4)
// GET /auth/moi : personne n'est connecté (401) ; autres appels : listes vides
beforeEach(() => vi.stubGlobal('fetch', vi.fn(async (url) => (url.endsWith('/auth/moi')
  ? { ok: false, status: 401, json: async () => ({ code: 'NON_CONNECTE' }) }
  : { ok: true, status: 200, json: async () => [] }))))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

function afficher(adresse = '/tableau-de-bord') {
  const router = createMemoryRouter(routes, { initialEntries: [adresse] })
  render(<RouterProvider router={router} />)
  return router
}
const menu = () => screen.getByRole('navigation', { name: 'Menu principal' })

describe('Menu latéral', () => {
  it('CA2 : toutes les fonctionnalités de l’US apparaissent, dans l’ordre, toutes cliquables', () => {
    afficher()
    const liens = [...menu().querySelectorAll('a')]
    expect(liens.map((a) => a.textContent)).toEqual([
      'Tableau de bord', 'Formations et programmes', 'Sessions et planning', 'Documents', 'Émargement',
      'E-learning', 'Évaluations et satisfaction', 'Signature électronique', 'Qualiopi',
    ])
    expect(menu().querySelector('[aria-disabled]')).toBeNull()
  })

  it('CA3 : un élément développé ouvre sa page', async () => {
    const router = afficher()
    fireEvent.click(screen.getByRole('link', { name: 'Sessions et planning' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Sessions et planning' })).toBeTruthy()
    expect(router.state.location.pathname).toBe('/sessions')
    expect(screen.getByRole('link', { name: 'Sessions et planning' }).getAttribute('aria-current')).toBe('page')
  })

  it('CA4 : une fonctionnalité pas encore développée ouvre la page « Bientôt disponible »', async () => {
    const router = afficher()
    for (const [titre, code] of [['Documents', 'documents'], ['Évaluations et satisfaction', 'evaluations'], ['Qualiopi', 'qualiopi']]) {
      fireEvent.click(screen.getByRole('link', { name: titre }))
      expect(router.state.location.pathname).toBe(`/bientot-disponible/${code}`)
      expect(await screen.findByRole('heading', { level: 1, name: titre })).toBeTruthy()
      expect(screen.getByRole('heading', { level: 2, name: 'Bientôt disponible' })).toBeTruthy()
    }
  })

  it('« Retour à Sessions et planning » quitte la page « Bientôt disponible »', async () => {
    const router = afficher('/bientot-disponible/emargement')
    fireEvent.click(screen.getByRole('link', { name: 'Retour à Sessions et planning' }))
    expect(router.state.location.pathname).toBe('/sessions')
  })

  it('adresse inconnue : titre générique', () => {
    afficher('/bientot-disponible/inconnue')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Bientôt disponible')
  })
})
