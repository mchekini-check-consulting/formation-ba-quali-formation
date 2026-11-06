import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiBase } from './api'
import { routes } from './App'

// Compte connecté renvoyé par GET /auth/moi : personne par défaut (401)
let fetchMock
beforeEach(() => {
  fetchMock = vi.fn(async () => ({ ok: false, status: 401, json: async () => ({ code: 'NON_CONNECTE' }) }))
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
const connecte = (email) => fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 7, email }) })

const afficher = (adresse = '/tableau-de-bord') => render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [adresse] })} />)

describe('App', () => {
  it('personne n’est connecté : pas d’avatar', async () => {
    const { container } = afficher()
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/auth\/moi$/)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Bienvenue dans Quali-formation')
    expect(container.querySelector('.avatar')).toBeNull()
    expect(container.textContent).not.toContain('Nassiba')
  })

  it('le titre ne change pas selon le compte ; l’avatar montre ses initiales (e-mail au survol)', async () => {
    connecte('prenom.nom@organisme.fr')
    const { container } = afficher()
    await vi.waitFor(() => expect(container.querySelector('.avatar')).not.toBeNull())
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Bienvenue dans Quali-formation')
    const avatar = container.querySelector('.avatar')
    expect(avatar.textContent).toBe('PN')
    expect(avatar.getAttribute('title')).toBe('prenom.nom@organisme.fr')
    expect(container.textContent).not.toContain('Nassiba')
  })

  it('l’avatar suit le compte connecté sur les autres pages', async () => {
    connecte('autre.compte@organisme.fr')
    const { container } = afficher('/formations')
    await vi.waitFor(() => expect(container.querySelector('.avatar')?.textContent).toBe('AC'))
  })

  it('le tableau de bord est vide pour l’instant (titre seulement)', () => {
    const { container } = afficher()
    expect(container.querySelector('.contenu').textContent).not.toContain('Conformité Qualiopi')
    expect(container.querySelectorAll('.module, .kpi, .carte')).toHaveLength(0)
  })

  it('la barre du haut n’a plus de champ « Rechercher… »', () => {
    afficher()
    expect(screen.queryByPlaceholderText('Rechercher…')).toBeNull()
  })

  it('ouvre et ferme le menu au clic', () => {
    const { container } = afficher()
    const sidebar = container.querySelector('.sidebar')
    const button = screen.getByRole('button', { name: /ouvrir le menu/i })
    fireEvent.click(button)
    expect(sidebar.classList.contains('ouverte')).toBe(true)
    fireEvent.click(button)
    expect(sidebar.classList.contains('ouverte')).toBe(false)
  })

  it('le logo Quali-formation de la barre latérale ramène à la landing page', async () => {
    afficher('/tableau-de-bord')
    fireEvent.click(screen.getByRole('link', { name: 'Quali-formation' }))
    expect(await screen.findByRole('link', { name: 'Se connecter' })).toBeTruthy()
    expect(screen.queryByRole('heading', { level: 1, name: 'Bienvenue dans Quali-formation' })).toBeNull()
  })

  it('le lien « Formations » de la barre latérale ouvre la liste des formations', async () => {
    afficher()
    const menu = screen.getByRole('navigation', { name: 'Menu principal' })
    fireEvent.click(Array.from(menu.querySelectorAll('a')).find((a) => a.textContent === 'Formations'))
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe('Formations')
  })
})

describe('Landing page', () => {
  it("est la première page du site (CA1)", () => {
    afficher('/')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Simplifiez la gestion de vos')
    expect(screen.queryByRole('navigation', { name: 'Menu principal' })).toBeNull()
  })

  it('une adresse inconnue ramène à la landing page', () => {
    afficher('/page-inconnue')
    expect(screen.getByRole('navigation', { name: 'Navigation principale' })).toBeTruthy()
  })

  it('« Se connecter » ouvre le pop-up de connexion (SCRUM-16)', async () => {
    afficher('/')
    fireEvent.click(screen.getByRole('link', { name: 'Se connecter' }))
    expect(await screen.findByRole('dialog', { name: 'Se connecter' })).toBeTruthy()
  })
})

describe('apiBase', () => {
  it("pointe la passerelle de l'environnement du frontend", () => {
    expect(apiBase('frontend.formation-ba-projet.qualif.check-consulting.net')).toBe(
      'https://gateway.formation-ba-projet.qualif.check-consulting.net/backend',
    )
  })

  it('utilise le proxy du serveur de dev en local', () => {
    expect(apiBase('localhost')).toBe('/api')
  })
})
