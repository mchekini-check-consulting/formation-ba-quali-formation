import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../App'
import { resumeModeles } from './serviceApi'

// SCRUM-210 « Accéder aux modèles par dossiers » : GET /modeles/resume simulé, compte connecté (GET /auth/moi)
function simulerBackend(resume = { ok: true, status: 200, json: async () => ({ nb_modeles: 4, nb_formations: 3 }) }) {
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    if (url.endsWith('/auth/moi')) return { ok: true, status: 200, json: async () => ({ id: 1, email: 'camille@organisme.fr' }) }
    if (url.endsWith('/modeles/resume')) return typeof resume === 'function' ? resume() : resume
    return { ok: true, status: 200, json: async () => [] }
  }))
}
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

function afficher(adresse) {
  const router = createMemoryRouter(routes, { initialEntries: [adresse] })
  render(<RouterProvider router={router} />)
  return router
}
const filAriane = () => screen.getByRole('navigation', { name: "Fil d'Ariane" })

describe('Modèles par dossiers', () => {
  it('CA1 : un clic sur « Modèles » dans le menu affiche les deux cartes avec leur compteur', async () => {
    simulerBackend()
    const router = afficher('/tableau-de-bord')
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Menu principal' })).getByRole('link', { name: 'Modèles' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Modèles' })).toBeTruthy()
    expect(router.state.location.pathname).toBe('/modeles')
    const generiques = await screen.findByRole('link', { name: /Modèles génériques/ })
    expect(generiques.textContent).toContain('4 modèles')
    expect(screen.getByRole('link', { name: /Modèles par formation/ }).textContent).toContain('3 formations')
  })

  it('CA2 : un clic sur une carte ouvre le dossier et le fil d’Ariane indique où il se trouve', async () => {
    simulerBackend()
    for (const [carte, adresse] of [['Modèles génériques', '/modeles/generiques'], ['Modèles par formation', '/modeles/formations']]) {
      const router = afficher('/modeles')
      fireEvent.click(await screen.findByRole('link', { name: new RegExp(carte) }))
      expect(router.state.location.pathname).toBe(adresse)
      expect(filAriane().textContent).toBe(`Modèles › ${carte}`)
      expect(screen.getByRole('heading', { level: 1, name: 'Modèles' })).toBeTruthy()
      cleanup()
    }
  })

  it('CA3 : « ← Retour » et « Modèles » du fil d’Ariane ramènent aux deux dossiers', async () => {
    simulerBackend()
    let router = afficher('/modeles/generiques')
    fireEvent.click(screen.getByRole('button', { name: '← Retour' }))
    expect(router.state.location.pathname).toBe('/modeles')
    expect(await screen.findByRole('link', { name: /Modèles par formation/ })).toBeTruthy()
    cleanup()

    router = afficher('/modeles/formations')
    fireEvent.click(within(filAriane()).getByRole('link', { name: 'Modèles' }))
    expect(router.state.location.pathname).toBe('/modeles')
    expect(await screen.findByRole('link', { name: /Modèles génériques/ })).toBeTruthy()
  })

  it('une seule formation : compteur au singulier', async () => {
    simulerBackend({ ok: true, status: 200, json: async () => ({ nb_modeles: 4, nb_formations: 1 }) })
    afficher('/modeles')
    expect((await screen.findByRole('link', { name: /Modèles par formation/ })).textContent).toContain('1 formation')
  })

  it('sans connexion : message et lien « Se connecter », pas de cartes', async () => {
    simulerBackend({ ok: false, status: 401, json: async () => ({ code: 'NON_CONNECTE', detail: "Vous n'êtes pas connecté." }) })
    afficher('/modeles')
    const alerte = await screen.findByRole('alert')
    expect(alerte.textContent).toContain("Vous n'êtes pas connecté.")
    expect(within(alerte).getByRole('link', { name: 'Se connecter' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: /Modèles génériques/ })).toBeNull()
  })
})

describe('resumeModeles', () => {
  it('serveur injoignable : message compréhensible', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    await expect(resumeModeles()).rejects.toMatchObject({ code: 'RESEAU', message: expect.stringContaining('Le serveur ne répond pas') })
  })

  it('autre erreur sans détail : message par défaut', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, json: async () => { throw new SyntaxError('pas du JSON') } })))
    await expect(resumeModeles()).rejects.toMatchObject({ code: 'ERREUR', message: 'Les modèles n’ont pas pu être chargés. Réessayez.' })
  })
})
