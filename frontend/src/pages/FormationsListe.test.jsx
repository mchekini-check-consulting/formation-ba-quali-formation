import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
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

  it('affiche les compteurs des filtres et filtre par statut, sans filtre « Publiées » (RG30, SCRUM-21)', async () => {
    const { container } = await afficherListe()
    expect(filtre('Toutes').textContent).toBe('Toutes9')
    expect(filtre('Brouillons').textContent).toBe('Brouillons2')
    expect(filtre('Validées').textContent).toBe('Validées5')
    expect(within(screen.getByRole('toolbar')).getAllByRole('button').map((b) => b.textContent.replace(/\d+$/, '')))
      .toEqual(['Toutes', 'Brouillons', 'Incomplètes', 'Validées'])
    fireEvent.click(filtre('Brouillons'))
    expect(titres(container).sort()).toEqual(['Anglais professionnel', 'Sauveteur secouriste du travail (SST)'])
  })

  it('cherche par intitulé (RG30)', async () => {
    const { container } = await afficherListe()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Rechercher une formation' }), { target: { value: 'manag' } })
    expect(titres(container)).toHaveLength(2)
    fireEvent.change(screen.getByRole('searchbox', { name: 'Rechercher une formation' }), { target: { value: 'zzz' } })
    expect(screen.getByText('Aucune formation ne correspond à cette recherche.')).toBeTruthy()
  })

  it('bouton principal : « Compléter la formation » pour un brouillon, « Voir la formation » sinon (SCRUM-21)', async () => {
    const { router } = await afficherListe()
    for (const t of ['Sauveteur secouriste du travail (SST)', 'Anglais professionnel']) {
      expect(within(carte(t)).getByRole('button', { name: /Compléter la formation/ })).toBeTruthy()
      expect(within(carte(t)).queryByRole('button', { name: /Voir la formation/ })).toBeNull()
    }
    // Validées et incomplètes
    for (const t of ['Excel avancé', 'Prise de parole en public', "Management d'équipe — niveau 2", 'Gestion de projet agile']) {
      expect(within(carte(t)).getByRole('button', { name: /Voir la formation/ })).toBeTruthy()
    }
    expect(screen.queryByRole('button', { name: /Continuer la saisie|Ouvrir et valider|Compléter les informations/ })).toBeNull()
    fireEvent.click(within(carte("Management d'équipe — niveau 2")).getByRole('button', { name: /Voir la formation/ }))
    expect(router.state.location.pathname).toBe('/formations/1')
  })

  it('un brouillon s’ouvre dans le formulaire, jamais dans la fiche (SCRUM-22)', async () => {
    const { router } = await afficherListe()
    fireEvent.click(within(carte('Anglais professionnel')).getByRole('button', { name: /Compléter la formation/ }))
    expect(router.state.location.pathname).toBe('/formations/6/modifier')
    await router.navigate('/formations')
    await screen.findByRole('toolbar', { name: 'Filtrer par statut' })
    fireEvent.click(screen.getByRole('button', { name: 'Anglais professionnel' }))
    expect(router.state.location.pathname).toBe('/formations/6/modifier')
  })

  it('affiche « Programme non créé » seulement sans programme et ouvre sa création (RG32)', async () => {
    const { router } = await afficherListe()
    expect(within(carte('Excel avancé')).queryByText('Programme non créé')).toBeNull()
    fireEvent.click(within(carte('Sauveteur secouriste du travail (SST)')).getByRole('button', { name: /Programme non créé/ }))
    expect(router.state.location.pathname).toBe('/formations/4/modifier')
    expect(router.state.location.search).toContain('bloc=programme')
  })

  it('les cartes n’affichent plus « Publiée », « À publier » ni les sessions (SCRUM-21)', async () => {
    const { container } = await afficherListe()
    expect(within(container.querySelector('.fgrid')).queryByText(/^(Publiée|À publier)$/)).toBeNull()
    expect(within(container.querySelector('.fgrid')).queryByText('Sessions')).toBeNull()
    expect(within(carte('Excel avancé')).getByText('Durée')).toBeTruthy()
    expect(within(carte('Excel avancé')).getByText('Prix')).toBeTruthy()
  })

  it('menu « ··· » : seulement Modifier, Archiver et Supprimer (grisés, bientôt disponibles) (SCRUM-21)', async () => {
    const { router } = await afficherListe()
    const c = carte('Prise de parole en public')
    fireEvent.click(within(c).getByRole('button', { name: /Plus d’actions/ }))
    const items = within(c).getAllByRole('menuitem')
    expect(items.map((b) => b.textContent)).toEqual(['Modifier', 'ArchiverBientôt disponible', 'SupprimerBientôt disponible'])
    expect(items.map((b) => b.disabled)).toEqual([false, true, true])
    expect(within(c).queryByRole('menuitem', { name: /Publier|Retirer|session/ })).toBeNull()
    fireEvent.click(items[0])
    expect(router.state.location.pathname).toBe('/formations/5/modifier')
  })
})
