import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { apiBase } from './api'
import { routes } from './App'

afterEach(cleanup)

const afficher = (adresse = '/') => render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [adresse] })} />)

describe('App', () => {
  it('affiche le titre', () => {
    afficher()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Bonjour Nassiba')
  })

  it('le tableau de bord est vide pour l’instant (titre seulement)', () => {
    const { container } = afficher()
    expect(container.querySelector('.contenu').textContent).not.toContain('Conformité Qualiopi')
    expect(container.querySelectorAll('.module, .kpi, .carte')).toHaveLength(0)
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

  it('le lien « Formations » de la barre latérale ouvre la liste des formations', async () => {
    afficher()
    const menu = screen.getByRole('navigation', { name: 'Menu principal' })
    fireEvent.click(Array.from(menu.querySelectorAll('a')).find((a) => a.textContent === 'Formations'))
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe('Formations')
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
