import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
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
      .toEqual(['Toutes', 'Brouillons', 'Incomplètes', 'Validées', 'Archivées'])
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

  it('les cartes n’affichent plus « Publiée » ni « À publier » (SCRUM-21)', async () => {
    const { container } = await afficherListe()
    expect(within(container.querySelector('.fgrid')).queryByText(/^(Publiée|À publier)$/)).toBeNull()
    expect(within(carte('Excel avancé')).getByText('Durée')).toBeTruthy()
    expect(within(carte('Excel avancé')).getByText('Prix')).toBeTruthy()
  })

  it('à côté du prix, le bouton « Sessions » donne le total et déroule la liste des sessions', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-08T12:00:00Z'))
    onTestFinished(() => vi.useRealTimers())
    // Sessions aux dates fixes (indépendantes du fuseau horaire), dans le désordre : 1 passée, 1 en cours, 2 à venir
    for (const s of [['2027-03-14', '2027-03-14', 'Teams', ''], ['2026-10-01', '2026-10-02', 'Lyon', '10'],
      ['2027-01-11', '2027-01-12', 'Lyon', '12'], ['2026-11-07', '2026-11-09', 'Paris', '8']]) {
      await service.ajouterSession(2, { debut: s[0], fin: s[1], lieu: s[2], places: s[3] })
    }
    await afficherListe()
    const libelles = (c) => Array.from(c.querySelectorAll('dt')).map((x) => x.textContent)
    expect(libelles(carte('Excel avancé'))).toEqual(['Durée', 'Prix', 'Sessions'])
    // Aucune session : « 0 », rien à dérouler (le mot « Sessions » n'est écrit qu'une fois, dans le titre)
    const aucune = within(carte('Anglais professionnel')).getByRole('button', { name: '0 session pour Anglais professionnel' })
    expect(aucune.textContent).toBe('0')
    expect(aucune.disabled).toBe(true)
    // Le total ne compte que les sessions en cours et à venir
    const c = carte('Excel avancé')
    const bouton = within(c).getByRole('button', { name: '3 sessions pour Excel avancé' })
    expect(bouton.textContent).toBe('3')
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(bouton)
    // Une pop-up avec un tableau : seulement les sessions en cours et à venir, dans l'ordre des dates
    const dialogue = screen.getByRole('dialog', { name: 'Sessions en cours et à venir' })
    expect(within(dialogue).getByText('« Excel avancé » · 3 sessions')).toBeTruthy()
    const lignes = within(dialogue).getAllByRole('row').slice(1).map((tr) => Array.from(tr.cells).map((td) => td.textContent))
    expect(lignes).toEqual([
      ['En cours', 'du 07/11/2026au 09/11/2026', '3 jours', 'Paris', '8'],
      ['À venir', 'du 11/01/2027au 12/01/2027', '2 jours', 'Lyon', '12'],
      ['À venir', '14/03/2027', '1 jour', 'Teams', '—'],
    ])
    expect(within(dialogue).queryByText(/01\/10\/2026/)).toBeNull()
    // « Fermer » referme la pop-up
    fireEvent.click(within(dialogue).getByRole('button', { name: 'Fermer' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('menu « ··· » : Modifier, Archiver et Supprimer ; Modifier ouvre le formulaire (SCRUM-21, SCRUM-23)', async () => {
    const { router } = await afficherListe()
    const c = carte('Prise de parole en public')
    fireEvent.click(within(c).getByRole('button', { name: /Plus d’actions/ }))
    const items = within(c).getAllByRole('menuitem')
    expect(items.map((b) => b.textContent)).toEqual(['Modifier', 'Archiver', 'Supprimer'])
    expect(items.some((b) => b.disabled)).toBe(false)
    expect(within(c).queryByRole('menuitem', { name: /Publier|Retirer|session/ })).toBeNull()
    fireEvent.click(items[0])
    expect(router.state.location.pathname).toBe('/formations/5/modifier')
  })
})

// SCRUM-23 : archiver, restaurer, supprimer
const menu = (titre, action) => {
  const c = carte(titre)
  fireEvent.click(within(c).getByRole('button', { name: /Plus d’actions/ }))
  fireEvent.click(within(c).getByRole('menuitem', { name: action }))
}

describe('Archiver, restaurer, supprimer (SCRUM-23)', () => {
  it('archiver : confirmation, puis la formation quitte « Toutes » pour « Archivées »', async () => {
    const { container } = await afficherListe()
    menu('Excel avancé', 'Archiver')
    fireEvent.click(await screen.findByRole('button', { name: 'Archiver' }))
    await waitFor(() => expect(titres(container)).not.toContain('Excel avancé'))
    expect(filtre('Toutes').textContent).toBe('Toutes8')
    expect(filtre('Archivées').textContent).toBe('Archivées1')
    fireEvent.click(filtre('Archivées'))
    expect(titres(container)).toEqual(['Excel avancé'])
    expect(within(carte('Excel avancé')).getByText('Archivée')).toBeTruthy()
    expect((await service.obtenirFormation(2)).statut).toBe('archivee')
  })

  it('une formation archivée a le bouton « Restaurer » et pas « Modifier » ; restaurer la remet en brouillon', async () => {
    await service.archiver(2)
    const { container } = await afficherListe()
    fireEvent.click(filtre('Archivées'))
    const c = carte('Excel avancé')
    fireEvent.click(within(c).getByRole('button', { name: /Plus d’actions/ }))
    expect(within(c).getAllByRole('menuitem').map((b) => b.textContent)).toEqual(['Restaurer', 'Supprimer'])
    fireEvent.click(within(c).getByRole('button', { name: /^Restaurer$/ }))
    await waitFor(() => expect(titres(container)).toEqual([]))
    expect((await service.obtenirFormation(2)).statut).toBe('brouillon')
    fireEvent.click(filtre('Brouillons'))
    expect(titres(container)).toContain('Excel avancé')
  })

  it('supprimer : le bouton ne s’active qu’en tapant « supprimer », puis la formation disparaît', async () => {
    const { container } = await afficherListe()
    menu('Excel avancé', 'Supprimer')
    const dialogue = await screen.findByRole('dialog')
    expect(within(dialogue).getByText('Cette action est définitive. La formation et toutes ses informations seront supprimées et ne pourront pas être récupérées.')).toBeTruthy()
    const bouton = within(dialogue).getByRole('button', { name: 'Supprimer' })
    expect(bouton.disabled).toBe(true)
    fireEvent.change(within(dialogue).getByLabelText(/Pour confirmer la suppression/), { target: { value: 'oui' } })
    expect(bouton.disabled).toBe(true)
    fireEvent.change(within(dialogue).getByLabelText(/Pour confirmer la suppression/), { target: { value: ' Supprimer ' } })
    expect(bouton.disabled).toBe(false)
    fireEvent.click(bouton)
    await waitFor(() => expect(titres(container)).not.toContain('Excel avancé'))
    await expect(service.obtenirFormation(2)).rejects.toMatchObject({ code: 'INTROUVABLE' })
  })

  it('« Annuler » ne supprime rien', async () => {
    await afficherListe()
    menu('Excel avancé', 'Supprimer')
    fireEvent.click(await screen.findByRole('button', { name: 'Annuler' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect((await service.obtenirFormation(2)).title).toBe('Excel avancé')
  })

  it('une formation avec des sessions doit d’abord être archivée : message et proposition d’archiver', async () => {
    const { container } = await afficherListe()
    menu('Prise de parole en public', 'Supprimer')
    expect(await screen.findByRole('heading', { name: 'Suppression impossible' })).toBeTruthy()
    expect(screen.getByText(/a 1 session : elle doit d'abord être archivée/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Archiver la formation' }))
    await waitFor(() => expect(titres(container)).not.toContain('Prise de parole en public'))
    // Archivée, elle peut être supprimée
    fireEvent.click(filtre('Archivées'))
    menu('Prise de parole en public', 'Supprimer')
    expect(await screen.findByLabelText(/Pour confirmer la suppression/)).toBeTruthy()
  })
})

describe('Liste : erreur de chargement', () => {
  it('personne n’est connecté : le message et le lien « Se connecter »', async () => {
    const espion = vi.spyOn(service, 'listerFormations').mockRejectedValue(new service.ErreurMetier('NON_CONNECTE', "Vous n'êtes pas connecté."))
    onTestFinished(() => espion.mockRestore())
    render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/formations'] })} />)
    expect((await screen.findByRole('alert')).textContent).toBe("Vous n'êtes pas connecté. Se connecter")
    expect(screen.getByRole('link', { name: 'Se connecter' }).getAttribute('href')).toBe('/se-connecter')
  })
})
