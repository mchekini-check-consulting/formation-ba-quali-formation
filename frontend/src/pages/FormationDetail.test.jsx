import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { routes } from '../App'
import * as service from '../formations/service'

beforeEach(() => service.chargerExemples())
afterEach(cleanup)

async function ouvrir(id) {
  const router = createMemoryRouter(routes, { initialEntries: [`/formations/${id}`] })
  render(<RouterProvider router={router} />)
  await screen.findByRole('heading', { level: 2, name: /La formation$/ })
  return router
}
const blocFiche = (titre) => screen.getByRole('heading', { level: 3, name: titre }).closest('section')

describe('Fiche détaillée', () => {
  it('affiche l’en-tête, les 3 parties et « Complet » pour chaque bloc d’une fiche complète (RG39)', async () => {
    await ouvrir(8)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Business Analyst — les fondamentaux en contexte agile')
    expect(screen.getByText('FOR-2026-019')).toBeTruthy()
    expect(screen.getAllByText('Complet')).toHaveLength(13)
    expect(screen.queryByText('Fiche Qualiopi incomplète')).toBeNull()
    expect(document.querySelector('.dt-total').textContent).toBe('5 séquences · 35 h au total')
  })

  it('montre le nombre de blocs complétés sur 13 et la liste de ce qui manque (RG40)', async () => {
    await ouvrir(1)
    expect(screen.getByText('Fiche Qualiopi incomplète')).toBeTruthy()
    expect(screen.getByText('4 blocs à compléter')).toBeTruthy()
    expect(document.querySelector('.ring2').textContent).toBe('9/13')
    fireEvent.click(screen.getByText('Voir ce qui manque'))
    const dialogue = screen.getByRole('dialog')
    expect(within(dialogue).getAllByRole('button', { name: /Remplir/ }).map((b) => b.querySelector('.mi-t').textContent))
      .toEqual(['Méthodes et moyens', 'Accès et inscription', 'Évaluation avant la formation', 'Évaluation des acquis'])
  })

  it('« Compléter » ouvre directement le bloc concerné (RG39)', async () => {
    const router = await ouvrir(1)
    expect(within(blocFiche('Accès et inscription')).getByText('À compléter')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Compléter : Accès et inscription' }))
    expect(await screen.findByRole('heading', { level: 3, name: 'Accès et inscription' })).toBeTruthy()
    expect(router.state.location.pathname).toBe('/formations/1/modifier')
    // Après validation, on revient sur la fiche
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))
    fireEvent.click(screen.getByRole('button', { name: 'Valider' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Valider quand même' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/formations/1'))
  })

  it('un brouillon enregistré depuis la fiche revient à la liste : il n’a pas de fiche (SCRUM-22)', async () => {
    const router = await ouvrir(1)
    fireEvent.click(screen.getByRole('button', { name: 'Modifier' }))
    await screen.findByRole('heading', { name: 'Informations de base' })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer en brouillon' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/formations'))
  })

  it('le bouton « Modifier » de l’en-tête ouvre le formulaire (SCRUM-22)', async () => {
    const router = await ouvrir(8)
    fireEvent.click(within(document.querySelector('.dt-actions')).getByRole('button', { name: 'Modifier' }))
    expect(router.state.location.pathname).toBe('/formations/8/modifier')
    expect(await screen.findByRole('heading', { name: 'Informations de base' })).toBeTruthy()
  })

  it('un brouillon n’a pas de fiche : son adresse ouvre le formulaire (SCRUM-22)', async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/formations/6'] })
    render(<RouterProvider router={router} />)
    expect(await screen.findByRole('heading', { name: 'Informations de base' })).toBeTruthy()
    expect(router.state.location.pathname).toBe('/formations/6/modifier')
  })

  it('une formation archivée ne se modifie pas : ni « Modifier » ni « Compléter » sur sa fiche (SCRUM-23)', async () => {
    await service.archiver(1)
    await ouvrir(1)
    expect(within(document.querySelector('.dt-tags')).getByText('Archivée')).toBeTruthy()
    expect(within(document.querySelector('.dt-actions')).queryByRole('button', { name: 'Modifier' })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Compléter/ })).toBeNull()
    expect(screen.queryByText('Fiche Qualiopi incomplète')).toBeNull()
  })

  it('l’adresse du formulaire d’une formation archivée ramène à sa fiche (SCRUM-23)', async () => {
    await service.archiver(1)
    const router = createMemoryRouter(routes, { initialEntries: ['/formations/1/modifier'] })
    render(<RouterProvider router={router} />)
    await screen.findByRole('heading', { level: 2, name: /La formation$/ })
    expect(router.state.location.pathname).toBe('/formations/1')
  })

  it('signale « Programme non créé » sur la fiche d’une formation sans programme', async () => {
    const f = await service.obtenirFormation(2)
    await service.enregistrerFormation({ ...f, values: { ...f.values, modules: [] } }, 'incomplete')
    await ouvrir(2)
    expect(within(document.querySelector('.dt-tags')).getByText('Programme non créé')).toBeTruthy()
    cleanup()
    await ouvrir(8)
    expect(within(document.querySelector('.dt-tags')).queryByText('Programme non créé')).toBeNull()
  })
})
