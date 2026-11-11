import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import ErreurChargement, { PageEnChargement } from './ErreurChargement'

afterEach(cleanup)

const afficher = (erreur) => render(<MemoryRouter><ErreurChargement erreur={erreur} /></MemoryRouter>)

describe('Erreur de chargement', () => {
  it('personne n’est connecté : le message et le lien « Se connecter »', () => {
    afficher({ code: 'NON_CONNECTE', message: "Vous n'êtes pas connecté." })
    expect(screen.getByRole('alert').textContent).toContain("Vous n'êtes pas connecté.")
    expect(screen.getByRole('link', { name: 'Se connecter' }).getAttribute('href')).toBe('/se-connecter')
  })

  it('formation introuvable : le lien « Retour aux formations »', () => {
    afficher({ code: 'INTROUVABLE', message: 'Formation introuvable.' })
    expect(screen.getByRole('link', { name: 'Retour aux formations' }).getAttribute('href')).toBe('/formations')
  })

  it('autre erreur : le message seul', () => {
    afficher({ code: 'RESEAU', message: 'Le serveur ne répond pas.' })
    expect(screen.getByRole('alert').textContent).toBe('Le serveur ne répond pas.')
    expect(screen.queryByRole('link')).toBeNull()
  })
})

describe('Page en chargement', () => {
  it('pendant le chargement : le message d’attente', () => {
    render(<MemoryRouter><PageEnChargement erreur={null} texte="Chargement de la formation…" /></MemoryRouter>)
    expect(screen.getByText('Chargement de la formation…')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('chargement en échec : l’erreur à la place du message d’attente', () => {
    render(<MemoryRouter><PageEnChargement erreur={{ code: 'INTROUVABLE', message: 'Formation introuvable.' }} texte="Chargement de la formation…" /></MemoryRouter>)
    expect(screen.getByRole('alert').textContent).toContain('Formation introuvable.')
    expect(screen.queryByText('Chargement de la formation…')).toBeNull()
  })
})
