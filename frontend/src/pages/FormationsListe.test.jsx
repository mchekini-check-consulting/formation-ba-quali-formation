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
  it('trie de la plus récente à la plus ancienne, sans les archivées dans « Toutes » (RG29, RG30)', async () => {
    const { container } = await afficherListe()
    const t = titres(container)
    expect(t[0]).toBe('Business Analyst — les fondamentaux en contexte agile')
    expect(t).toHaveLength(8)
    expect(t).not.toContain('Bureautique — initiation')
  })

  it('affiche les compteurs des filtres et filtre par statut (RG30)', async () => {
    const { container } = await afficherListe()
    expect(filtre('Toutes').textContent).toBe('Toutes8')
    expect(filtre('Brouillons').textContent).toBe('Brouillons2')
    expect(filtre('Archivées').textContent).toBe('Archivées1')
    fireEvent.click(filtre('Publiées'))
    expect(titres(container).sort()).toEqual(['Gestion de projet agile', "Management d'équipe — niveau 1", 'Prise de parole en public'])
    fireEvent.click(filtre('Archivées'))
    expect(titres(container)).toEqual(['Bureautique — initiation'])
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
    fireEvent.click(filtre('Archivées'))
    expect(within(carte('Bureautique — initiation')).getByRole('button', { name: /Restaurer la formation/ })).toBeTruthy()
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

  it('propose d’archiver une formation qui a des sessions au lieu de la supprimer (RG36)', async () => {
    await afficherListe()
    const c = carte("Management d'équipe — niveau 1")
    fireEvent.click(within(c).getByRole('button', { name: /Plus d’actions/ }))
    fireEvent.click(within(c).getByRole('menuitem', { name: 'Supprimer' }))
    expect(await screen.findByRole('heading', { name: 'Suppression impossible' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Archiver à la place' })).toBeTruthy()
  })

  it('ne supprime qu’après avoir tapé « supprimer » (RG37)', async () => {
    const { container } = await afficherListe()
    const c = carte('Anglais professionnel')
    fireEvent.click(within(c).getByRole('button', { name: /Plus d’actions/ }))
    fireEvent.click(within(c).getByRole('menuitem', { name: 'Supprimer' }))
    const bouton = await screen.findByRole('button', { name: 'Supprimer' })
    expect(bouton.disabled).toBe(true)
    fireEvent.change(screen.getByPlaceholderText('supprimer'), { target: { value: 'supprimer' } })
    expect(bouton.disabled).toBe(false)
    fireEvent.click(bouton)
    await waitFor(() => expect(titres(container)).not.toContain('Anglais professionnel'))
  })

  it('archive après confirmation, puis restaure en brouillon (RG34, RG35)', async () => {
    const { container } = await afficherListe()
    const c = carte('Excel avancé')
    fireEvent.click(within(c).getByRole('button', { name: /Plus d’actions/ }))
    fireEvent.click(within(c).getByRole('menuitem', { name: 'Archiver' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Archiver' }))
    await waitFor(() => expect(titres(container)).not.toContain('Excel avancé'))
    fireEvent.click(filtre('Archivées'))
    fireEvent.click(within(carte('Excel avancé')).getByRole('button', { name: /Restaurer la formation/ }))
    await waitFor(() => expect(titres(container)).not.toContain('Excel avancé'))
    fireEvent.click(filtre('Brouillons'))
    expect(titres(container)).toContain('Excel avancé')
  })
})
