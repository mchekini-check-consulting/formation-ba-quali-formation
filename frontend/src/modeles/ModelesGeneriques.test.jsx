import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../App'

// SCRUM-212 « Consulter les modèles génériques » (RG4, RG7, RG13) : GET /modeles/ simulé, compte connecté
const contenu = (titre) => `<div class="eh"><span class="logo-ph">LOGO</span><span>{{org_nom}}</span></div><h1>${titre}</h1>`
const VARIABLES = [{ code: 'org_nom', libelle: 'Nom de l’organisme' }]
const modele = (type, nom, statut = 'ORIGINE') => ({
  type, nom, statut, contenu: contenu(nom.toUpperCase()), variables: VARIABLES,
  date_maj: statut === 'ORIGINE' ? null : '2026-11-24T10:00:00Z',
})
const MODELES = [
  modele('CONVENTION', 'Convention de formation'),
  modele('CONTRAT', 'Contrat de formation'),
  modele('CONVOCATION', 'Convocation'),
  modele('ATTESTATION', 'Attestation de fin de formation'),
]
const NOMS = MODELES.map((m) => m.nom)
const ok = (json) => ({ ok: true, status: 200, json: async () => json })

function simulerBackend({ modeles = MODELES } = {}) {
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    if (url.endsWith('/auth/moi')) return ok({ id: 1, email: 'camille@organisme.fr' })
    if (url.endsWith('/modeles/')) return ok({ modeles })
    return ok([])
  }))
}
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

function afficher() {
  const router = createMemoryRouter(routes, { initialEntries: ['/modeles/generiques'] })
  render(<RouterProvider router={router} />)
  return router
}
const carte = (nom) => screen.findByRole('article', { name: nom })

describe('Modèles génériques (SCRUM-212)', () => {
  it('CA1 : 4 cartes avec miniature, nom, statut et bouton « Dupliquer » (inactif : SCRUM-218)', async () => {
    simulerBackend()
    afficher()
    for (const nom of NOMS) {
      const c = await carte(nom)
      // Miniature : le vrai document, variables en étiquettes
      const miniature = within(c).getByRole('link', { name: `Ouvrir ${nom}` })
      expect(miniature.querySelector('.doc-feuille h1').textContent).toBe(nom.toUpperCase())
      expect(miniature.querySelector('.doc-variable').textContent).toBe('Nom de l’organisme')
      expect(miniature.textContent).toContain('Ouvrir')
      expect(within(c).getByRole('link', { name: nom })).toBeTruthy()
      expect(within(c).getByText('Modèle d’origine')).toBeTruthy()
      expect(within(c).getByRole('button', { name: 'Dupliquer' }).disabled).toBe(true)
    }
    expect(document.querySelectorAll('.mod-modele')).toHaveLength(4)
  })

  it('CA2 : modèle modifié dans l’éditeur ou Word importé : « Personnalisé » / « Mon document » et lien « Rétablir »', async () => {
    simulerBackend({ modeles: [modele('CONVENTION', 'Convention de formation', 'PERSONNALISE'),
      modele('CONVOCATION', 'Convocation', 'IMPORTE'), modele('ATTESTATION', 'Attestation de fin de formation')] })
    afficher()
    const convention = await carte('Convention de formation')
    expect(within(convention).getByText('Personnalisé').className).toContain('mod-statut-personnalise')
    const convocation = await carte('Convocation')
    expect(within(convocation).getByText('Mon document').className).toContain('mod-statut-importe')
    for (const c of [convention, convocation]) {
      // Visible, inactif tant que SCRUM-217 n'est pas faite
      expect(within(c).getByRole('button', { name: 'Rétablir le modèle d’origine' }).disabled).toBe(true)
    }
  })

  it('CA3 : modèle jamais modifié : « Modèle d’origine », sans lien « Rétablir »', async () => {
    simulerBackend()
    afficher()
    const c = await carte('Contrat de formation')
    expect(within(c).getByText('Modèle d’origine').className).toContain('mod-statut-origine')
    expect(within(c).queryByRole('button', { name: /Rétablir/ })).toBeNull()
  })

  it('CA4 (RG7) : un clic sur la miniature ou le nom ouvre directement le modèle', async () => {
    simulerBackend()
    let router = afficher()
    fireEvent.click(within(await carte('Convocation')).getByRole('link', { name: 'Ouvrir Convocation' }))
    expect(router.state.location.pathname).toBe('/modeles/generiques/convocation')
    cleanup()
    router = afficher()
    fireEvent.click(within(await carte('Attestation de fin de formation')).getByRole('link', { name: 'Attestation de fin de formation' }))
    expect(router.state.location.pathname).toBe('/modeles/generiques/attestation')
  })

  it('RG13 retirée : plus de message orange « Pensez à remplir… » (informations saisies à la première connexion)', async () => {
    simulerBackend()
    afficher()
    await carte('Convention de formation')
    expect(screen.queryByText(/Pensez à remplir/)).toBeNull()
  })

  it('serveur indisponible : message d’erreur à la place des cartes', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (url.endsWith('/auth/moi')) return ok({ id: 1, email: 'camille@organisme.fr' })
      throw new TypeError('Failed to fetch')
    }))
    afficher()
    expect((await screen.findByRole('alert')).textContent).toContain('Le serveur ne répond pas')
    expect(screen.queryByText(/Pensez à remplir/)).toBeNull()
  })
})
