import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../App'

// SCRUM-19 : cloche de notifications (CA7), profil et son menu (CA5, CA6) ; « Se déconnecter » (SCRUM-17)
const EMAIL = 'camille.martin@organisme.fr'
let fetchMock
let connecte
beforeEach(() => {
  connecte = true
  fetchMock = vi.fn(async (url) => {
    if (url.endsWith('/auth/logout')) { connecte = false; return { ok: true, status: 204, json: async () => null } }
    if (url.endsWith('/auth/moi')) {
      return connecte ? { ok: true, status: 200, json: async () => ({ id: 1, email: EMAIL }) } : { ok: false, status: 401, json: async () => ({ code: 'NON_CONNECTE' }) }
    }
    return { ok: true, status: 200, json: async () => [] }
  })
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

async function afficher(adresse = '/sessions') {
  const router = createMemoryRouter(routes, { initialEntries: [adresse] })
  render(<RouterProvider router={router} />)
  await screen.findByRole('button', { name: 'Profil' })
  return router
}
const cloche = () => screen.getByRole('button', { name: 'Notifications' })
const profil = () => screen.getByRole('button', { name: 'Profil' })

describe('Haut de page : cloche et profil', () => {
  it('CA5 : le profil (initiales seulement) et la cloche sont visibles ; l’e-mail n’apparaît qu’en ouvrant la liste', async () => {
    await afficher()
    expect(cloche()).toBeTruthy()
    expect(profil().textContent).toBe('CM')
    expect(screen.queryByText(EMAIL)).toBeNull()
    fireEvent.click(profil())
    expect(within(screen.getByRole('menu', { name: 'Profil' })).getByText(EMAIL)).toBeTruthy()
  })

  it('CA7 : la cloche ouvre la liste des notifications, « Aucune notification » ; un second clic la ferme', async () => {
    await afficher()
    fireEvent.click(cloche())
    expect(cloche().getAttribute('aria-expanded')).toBe('true')
    expect(within(screen.getByRole('region', { name: 'Notifications' })).getByText('Aucune notification')).toBeTruthy()
    fireEvent.click(cloche())
    expect(screen.queryByText('Aucune notification')).toBeNull()
  })

  it('CA6 : le profil ouvre la liste Mon profil, Paramètres, Se déconnecter ; ouvrir l’un ferme l’autre', async () => {
    await afficher()
    fireEvent.click(cloche())
    fireEvent.click(profil())
    expect(screen.queryByText('Aucune notification')).toBeNull()
    const menu = screen.getByRole('menu', { name: 'Profil' })
    expect(within(menu).getAllByRole('menuitem').map((m) => m.textContent)).toEqual(['Mon profil', 'Paramètres', 'Se déconnecter'])
    expect(within(menu).getByText(EMAIL)).toBeTruthy()
  })

  it('Échap ou un clic à côté referme la liste', async () => {
    await afficher()
    fireEvent.click(profil())
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
    fireEvent.click(cloche())
    fireEvent.mouseDown(screen.getByRole('heading', { level: 1 }))
    expect(screen.queryByText('Aucune notification')).toBeNull()
    // Un clic dans la liste ne la referme pas
    fireEvent.click(cloche())
    fireEvent.mouseDown(screen.getByText('Aucune notification'))
    expect(screen.getByText('Aucune notification')).toBeTruthy()
  })

  it('« Mon profil » et « Paramètres » ouvrent la page « Bientôt disponible »', async () => {
    const router = await afficher()
    for (const [entree, chemin] of [['Mon profil', '/bientot-disponible/mon-profil'], ['Paramètres', '/bientot-disponible/parametres']]) {
      fireEvent.click(profil())
      fireEvent.click(screen.getByRole('menuitem', { name: entree }))
      expect(router.state.location.pathname).toBe(chemin)
      expect(await screen.findByRole('heading', { level: 1, name: entree })).toBeTruthy()
      expect(screen.getByRole('heading', { level: 2, name: 'Bientôt disponible' })).toBeTruthy()
      expect(screen.queryByRole('menu')).toBeNull()
    }
  })

  it('« Se déconnecter » ferme la connexion et ramène à la page de connexion avec un message', async () => {
    const router = await afficher()
    fireEvent.click(profil())
    fireEvent.click(screen.getByRole('menuitem', { name: 'Se déconnecter' }))
    expect(await screen.findByText('Vous êtes déconnecté.')).toBeTruthy()
    expect(router.state.location.pathname).toBe('/se-connecter')
    const appel = fetchMock.mock.calls.find(([url]) => url.endsWith('/auth/logout'))
    expect(appel[1]).toMatchObject({ method: 'POST', credentials: 'include' })
    // Retour arrière : la page quittée a été remplacée, le compte n'est plus connecté
    expect(router.state.historyAction).toBe('REPLACE')
  })

  it('« Se déconnecter » : message si le serveur refuse ou ne répond pas', async () => {
    await afficher()
    fetchMock.mockImplementationOnce(async () => ({ ok: false, status: 500, json: async () => null }))
    fireEvent.click(profil())
    fireEvent.click(screen.getByRole('menuitem', { name: 'Se déconnecter' }))
    expect((await screen.findByRole('alert')).textContent).toBe('La déconnexion a échoué. Réessayez.')
    fetchMock.mockImplementationOnce(async () => { throw new TypeError('réseau') })
    fireEvent.click(screen.getByRole('menuitem', { name: 'Se déconnecter' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Le serveur ne répond pas')
  })

  it('personne n’est connecté : la cloche reste, pas de profil', async () => {
    connecte = false
    render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/tableau-de-bord'] })} />)
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(cloche()).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Profil/ })).toBeNull()
  })
})
