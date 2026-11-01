import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { routes } from '../App'
import * as service from '../formations/service'

beforeEach(() => service.chargerExemples())
afterEach(cleanup)

async function afficherListe() {
  const router = createMemoryRouter(routes, { initialEntries: ['/formations'] })
  const vue = render(<RouterProvider router={router} />)
  await screen.findByRole('toolbar', { name: 'Filtrer par statut' })
  return { router, ...vue }
}
const titres = (container) => Array.from(container.querySelectorAll('.fc-t')).map((b) => b.textContent)
const carte = (titre) => screen.getByRole('button', { name: titre }).closest('article')
const filtre = (nom) => within(screen.getByRole('toolbar')).getByRole('button', { name: new RegExp(`^${nom}`) })

describe('Liste des formations', () => {
  it('trie de la plus récente à la plus ancienne (RG29, RG30)', async () => {
    const { container } = await afficherListe()
    const t = titres(container)
    expect(t[0]).toBe('Business Analyst — les fondamentaux en contexte agile')
    expect(t).toHaveLength(9)
    expect(t[8]).toBe('Bureautique — initiation')
  })

  it('affiche les compteurs des filtres et filtre par statut (RG30)', async () => {
    const { container } = await afficherListe()
    expect(filtre('Toutes').textContent).toBe('Toutes9')
    expect(filtre('Brouillons').textContent).toBe('Brouillons2')
    expect(filtre('Validées').textContent).toBe('Validées5')
    expect(within(screen.getByRole('toolbar')).getAllByRole('button')).toHaveLength(5)
    fireEvent.click(filtre('Publiées'))
    expect(titres(container).sort()).toEqual(['Gestion de projet agile', "Management d'équipe — niveau 1", 'Prise de parole en public'])
  })

  it('cherche par intitulé (RG30)', async () => {
    const { container } = await afficherListe()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Rechercher une formation' }), { target: { value: 'manag' } })
    expect(titres(container)).toHaveLength(2)
    fireEvent.change(screen.getByRole('searchbox', { name: 'Rechercher une formation' }), { target: { value: 'zzz' } })
    expect(screen.getByText('Aucune formation ne correspond à cette recherche.')).toBeTruthy()
  })

  it('choisit le bouton principal selon le statut (RG33)', async () => {
    await afficherListe()
    expect(within(carte('Sauveteur secouriste du travail (SST)')).getByRole('button', { name: /Continuer la saisie/ })).toBeTruthy()
    expect(within(carte('Anglais professionnel')).getByRole('button', { name: /Ouvrir et valider/ })).toBeTruthy()
    expect(within(carte("Management d'équipe — niveau 2")).getByRole('button', { name: /Compléter les informations/ })).toBeTruthy()
    expect(within(carte('Excel avancé')).getByRole('button', { name: /Voir la formation/ })).toBeTruthy()
    // Une formation publiée ouvre aussi sa fiche (et non plus la liste des sessions)
    expect(within(carte('Prise de parole en public')).getByRole('button', { name: /Voir la formation/ })).toBeTruthy()
    expect(within(carte('Gestion de projet agile')).getByRole('button', { name: /Compléter les informations/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Sessions \(/ })).toBeNull()
  })

  it('affiche « Programme non créé » seulement sans programme et ouvre sa création (RG32)', async () => {
    const { router } = await afficherListe()
    expect(within(carte('Excel avancé')).queryByText('Programme non créé')).toBeNull()
    fireEvent.click(within(carte('Sauveteur secouriste du travail (SST)')).getByRole('button', { name: /Programme non créé/ }))
    expect(router.state.location.pathname).toBe('/formations/4/modifier')
    expect(router.state.location.search).toContain('bloc=programme')
  })

  it('n’affiche l’état de publication que pour les formations validées ou incomplètes (RG24, RG31)', async () => {
    await afficherListe()
    expect(within(carte('Excel avancé')).getByText('À publier')).toBeTruthy()
    expect(within(carte('Prise de parole en public')).getByText('Publiée')).toBeTruthy()
    expect(within(carte('Anglais professionnel')).queryByText(/publier|Publiée/)).toBeNull()
  })

  it('refuse de publier sans programme et propose de le créer (RG26)', async () => {
    await service.enregistrerFormation({ ...(await service.obtenirFormation(4)), values: { modules: [] } }, 'incomplete')
    await afficherListe()
    const c = carte('Sauveteur secouriste du travail (SST)')
    fireEvent.click(within(c).getByRole('button', { name: /Plus d’actions/ }))
    fireEvent.click(within(c).getByRole('menuitem', { name: 'Publier' }))
    expect(await screen.findByRole('heading', { name: 'Programme requis pour publier' })).toBeTruthy()
  })

  it('demande confirmation pour publier une formation incomplète (RG27)', async () => {
    await afficherListe()
    const c = carte("Management d'équipe — niveau 2")
    fireEvent.click(within(c).getByRole('button', { name: /Plus d’actions/ }))
    fireEvent.click(within(c).getByRole('menuitem', { name: 'Publier' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Publier quand même' }))
    await waitFor(() => expect(within(carte("Management d'équipe — niveau 2")).getByText('Publiée')).toBeTruthy())
  })

  it('ajoute une session depuis le menu « ··· » (RG38)', async () => {
    await afficherListe()
    const c = carte('Excel avancé')
    fireEvent.click(within(c).getByRole('button', { name: /Plus d’actions/ }))
    fireEvent.click(within(c).getByRole('menuitem', { name: 'Ajouter une session' }))
    fireEvent.change(screen.getByLabelText('Date de début'), { target: { value: '2027-03-01' } })
    fireEvent.change(screen.getByLabelText('Date de fin'), { target: { value: '2027-02-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter la session' }))
    expect(screen.getByText('Indiquez une date de début et une date de fin (la fin après le début).')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Date de fin'), { target: { value: '2027-03-02' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter la session' }))
    await waitFor(() => expect(within(carte('Excel avancé')).getByText('Sessions').nextSibling.textContent).toBe('1'))
  })
})
