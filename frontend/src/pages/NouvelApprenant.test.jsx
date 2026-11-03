import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../App'
import { emailValide, verifierApprenant } from '../sessions/regles'
import { installerFauxBackend, repondre } from '../sessions/fauxBackend'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const bouton = (nom) => screen.getByRole('button', { name: nom })
const saisir = (label, valeur) => fireEvent.change(screen.getByLabelText(new RegExp(`^${label}`)), { target: { value: valeur } })
const panneau = () => screen.queryByRole('dialog', { name: 'Nouvel apprenant' })
const postsApprenant = (fetch) => fetch.mock.calls.filter(([url, o]) => url.endsWith('/apprenants/') && o?.method === 'POST')

function afficher() {
  const router = createMemoryRouter(routes, { initialEntries: ['/sessions'] })
  render(<RouterProvider router={router} />)
}
async function ouvrirPanneau() {
  afficher()
  fireEvent.click(await screen.findByRole('button', { name: /Parties prenantes/ }))
  fireEvent.click(screen.getByRole('menuitem', { name: /Nouvel apprenant/ }))
}
function remplir({ prenom = 'Lucas', nom = 'Girard', email = 'lucas.girard@acme.fr' } = {}) {
  saisir('Prénom', prenom)
  saisir('Nom', nom)
  saisir('E-mail', email)
}

describe('Nouvel apprenant (SCRUM-27)', () => {
  it('CA1 : « Parties prenantes » puis « Nouvel apprenant » ouvre le panneau', async () => {
    installerFauxBackend()
    afficher()
    const menu = await screen.findByRole('button', { name: /Parties prenantes/ })
    expect(menu.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(menu)
    expect(menu.getAttribute('aria-expanded')).toBe('true')
    // « Nouveau formateur » (SCRUM-26) n'est pas encore disponible
    expect(screen.getByRole('menuitem', { name: /Nouveau formateur/ }).disabled).toBe(true)
    fireEvent.click(screen.getByRole('menuitem', { name: /Nouvel apprenant/ }))
    expect(panneau()).toBeTruthy()
    expect(screen.queryByRole('menu')).toBeNull()
    // La page reste visible derrière
    expect(screen.getByRole('heading', { name: 'Sessions et planning' })).toBeTruthy()
  })

  it('un clic en dehors du menu le referme', async () => {
    installerFauxBackend()
    afficher()
    fireEvent.click(await screen.findByRole('button', { name: /Parties prenantes/ }))
    expect(screen.getByRole('menu')).toBeTruthy()
    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('CA2 : « Annuler », la croix, Échap ou un clic à côté ferment le panneau sans rien créer', async () => {
    const fetch = installerFauxBackend()
    await ouvrirPanneau()
    remplir()
    fireEvent.click(bouton('Annuler'))
    expect(panneau()).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /Parties prenantes/ }))
    fireEvent.click(screen.getByRole('menuitem', { name: /Nouvel apprenant/ }))
    fireEvent.click(bouton('Fermer'))
    expect(panneau()).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /Parties prenantes/ }))
    fireEvent.click(screen.getByRole('menuitem', { name: /Nouvel apprenant/ }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(panneau()).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /Parties prenantes/ }))
    fireEvent.click(screen.getByRole('menuitem', { name: /Nouvel apprenant/ }))
    fireEvent.mouseDown(document.querySelector('.overlay'))
    expect(panneau()).toBeNull()

    expect(postsApprenant(fetch)).toHaveLength(0)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('CA3 : chaque champ obligatoire vide est signalé, rien n’est créé', async () => {
    const fetch = installerFauxBackend()
    await ouvrirPanneau()
    fireEvent.click(bouton('Enregistrer'))
    const p = within(panneau())
    expect(p.getByRole('alert').textContent).toBe('Corrigez les champs indiqués pour enregistrer l’apprenant.')
    expect(p.getByText('Indiquez le prénom.')).toBeTruthy()
    expect(p.getByText('Indiquez le nom.')).toBeTruthy()
    expect(p.getByText("Indiquez l'e-mail.")).toBeTruthy()
    expect(screen.getByLabelText(/^Prénom/).getAttribute('aria-invalid')).toBe('true')
    expect(postsApprenant(fetch)).toHaveLength(0)
    // Saisir un champ retire son erreur
    saisir('Prénom', 'Lucas')
    expect(screen.getByLabelText(/^Prénom/).getAttribute('aria-invalid')).toBeNull()
  })

  it('CA4 : un e-mail invalide affiche « Format d’e-mail invalide » sous le champ', async () => {
    const fetch = installerFauxBackend()
    await ouvrirPanneau()
    remplir({ email: 'lucas.girard' })
    fireEvent.click(bouton('Enregistrer'))
    expect(document.getElementById('pa-email-err').textContent).toBe("Format d'e-mail invalide")
    expect(postsApprenant(fetch)).toHaveLength(0)
  })

  it('CA5 : l’apprenant est enregistré, le panneau se ferme et un message confirme', async () => {
    const fetch = installerFauxBackend()
    await ouvrirPanneau()
    remplir({ prenom: ' Lucas ', email: ' lucas.girard@acme.fr ' })
    fireEvent.click(bouton('Enregistrer'))
    expect((await screen.findByRole('status')).textContent).toBe('L’apprenant « Lucas Girard » a été créé. Vous pouvez maintenant l’ajouter à une session.')
    expect(panneau()).toBeNull()
    expect(JSON.parse(postsApprenant(fetch)[0][1].body)).toEqual({ prenom: 'Lucas', nom: 'Girard', email: 'lucas.girard@acme.fr' })
  })

  it('l’apprenant créé apparaît à l’étape 3 de « Nouvelle session »', async () => {
    installerFauxBackend()
    await ouvrirPanneau()
    remplir()
    fireEvent.click(bouton('Enregistrer'))
    await screen.findByRole('status')
    fireEvent.click(bouton('Nouvelle session'))
    await screen.findByRole('heading', { name: 'Informations de la session' })
    fireEvent.change(screen.getByLabelText(/^Formation/), { target: { value: '2' } })
    saisir('Date de début', '2026-11-18')
    saisir('Date de fin', '2026-11-20')
    saisir('Lieu', 'Lyon')
    fireEvent.click(bouton('Suivant'))
    fireEvent.click(screen.getByRole('checkbox', { name: /Julien Lefèvre/ }))
    fireEvent.click(bouton('Suivant'))
    expect(screen.getByRole('checkbox', { name: /Lucas Girard/ })).toBeTruthy()
  })

  it('affiche les erreurs renvoyées par le serveur', async () => {
    let reponse = repondre(400, { email: ["Format d'e-mail invalide"] })
    installerFauxBackend({ reponseApprenant: () => reponse })
    await ouvrirPanneau()
    remplir()
    fireEvent.click(bouton('Enregistrer'))
    await waitFor(() => expect(document.getElementById('pa-email-err').textContent).toBe("Format d'e-mail invalide"))
    reponse = repondre(500, null)
    fireEvent.click(bouton('Enregistrer'))
    await waitFor(() => expect(within(panneau()).getByRole('alert').textContent).toBe('Certaines informations sont invalides.'))
    expect(panneau()).toBeTruthy()
  })
})

describe('règles du panneau « Nouvel apprenant »', () => {
  it('vérifie le format de l’e-mail', () => {
    for (const ok of ['a@b.fr', 'lucas.girard@acme.fr', 'x+y@sous.domaine.com']) expect(emailValide(ok), ok).toBe(true)
    for (const ko of ['', 'lucas', 'a@b', '@b.fr', 'a@.fr', 'a@b.', 'a@b@c.fr', 'a b@c.fr']) expect(emailValide(ko), ko).toBe(false)
  })

  it('signale les champs vides avant le format', () => {
    expect(verifierApprenant({ prenom: ' ', nom: 'G', email: '' })).toEqual({ prenom: 'Indiquez le prénom.', email: "Indiquez l'e-mail." })
    expect(verifierApprenant({ prenom: 'L', nom: 'G', email: 'l@g.fr' })).toEqual({})
  })
})
