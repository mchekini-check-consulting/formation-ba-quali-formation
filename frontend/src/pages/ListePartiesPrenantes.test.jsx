import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../App'
import { installerFauxBackend, repondre } from '../sessions/fauxBackend'

// SCRUM-209 : page « Parties prenantes » ouverte depuis le menu latéral
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

function afficher() {
  const router = createMemoryRouter(routes, { initialEntries: ['/parties-prenantes'] })
  render(<RouterProvider router={router} />)
  return router
}
const liste = (nom) => screen.findByRole('list', { name: nom })
const saisir = (label, valeur) => fireEvent.change(screen.getByLabelText(new RegExp(`^${label}`)), { target: { value: valeur } })

describe('Page Parties prenantes', () => {
  it('liste les formateurs puis les apprenants (nom, entreprise, e-mail) ; l’entrée du menu est mise en évidence', async () => {
    installerFauxBackend()
    afficher()
    expect(screen.getByRole('heading', { level: 1, name: 'Parties prenantes' })).toBeTruthy()
    const formateurs = within(await liste('Formateurs')).getAllByRole('listitem')
    expect(formateurs.map((l) => l.textContent)).toEqual([
      'SDSarah Dubois—sarah.dubois@exemple.fr', 'JLJulien LefèvreCap Conseiljulien.lefevre@exemple.fr',
    ])
    expect(within(await liste('Apprenants')).getAllByRole('listitem')).toHaveLength(4)
    expect(screen.getByRole('heading', { level: 2, name: 'Formateurs 2' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: 'Apprenants 4' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Parties prenantes' }).getAttribute('aria-current')).toBe('page')
  })

  it('aucune personne : message dans chaque groupe', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => (url.endsWith('/auth/moi') ? repondre(401, {}) : repondre(200, []))))
    afficher()
    expect(await screen.findByText('Aucun formateur pour l’instant.')).toBeTruthy()
    expect(screen.getByText('Aucun apprenant pour l’instant.')).toBeTruthy()
  })

  it('le chargement échoue : message d’erreur', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => repondre(401, { code: 'NON_CONNECTE', message: 'Vous n’êtes pas connecté.' })))
    afficher()
    expect((await screen.findByRole('alert')).textContent).toContain('Se connecter')
  })

  it('« Nouvel apprenant » crée l’apprenant, confirme et l’ajoute à la liste', async () => {
    installerFauxBackend()
    afficher()
    await liste('Apprenants')
    fireEvent.click(screen.getByRole('button', { name: 'Nouvel apprenant' }))
    saisir('Prénom', 'Zoé')
    saisir('Nom', 'Roux')
    saisir('E-mail', 'zoe.roux@exemple.fr')
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect((await screen.findByRole('status')).textContent).toContain('L’apprenant « Zoé Roux » a été créé.')
    expect(await within(await liste('Apprenants')).findByText('Zoé Roux')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Fermer le message' }))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('« Nouveau formateur » ouvre le panneau ; « Annuler » le ferme', async () => {
    installerFauxBackend()
    afficher()
    await liste('Formateurs')
    fireEvent.click(screen.getByRole('button', { name: 'Nouveau formateur' }))
    expect(screen.getByRole('dialog', { name: 'Nouveau formateur' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
