import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { routes } from '../App'
import { today } from '../formations/catalogue'
import * as service from '../formations/service'

beforeEach(() => service.chargerExemples())
afterEach(cleanup)

async function ouvrir(adresse) {
  const router = createMemoryRouter(routes, { initialEntries: [adresse] })
  render(<RouterProvider router={router} />)
  await screen.findByRole('heading', { name: 'Informations de base' })
  return router
}
const saisir = (label, valeur) => fireEvent.change(screen.getByLabelText(label, { exact: false }), { target: { value: valeur } })
const derniere = async () => (await service.listerFormations()).find((f) => f.title === 'Excel débutant')

describe('Formulaire de création / modification', () => {
  it('enregistre un brouillon avec le seul intitulé, référence FOR-AAAA-NNN et version 1 (RG02, RG03, RG04)', async () => {
    const router = await ouvrir('/formations/nouvelle')
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer en brouillon' }))
    expect(screen.getByText('Ce champ est obligatoire.')).toBeTruthy()
    saisir('Intitulé de la formation', 'Excel débutant')
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer en brouillon' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/formations'))
    const f = await derniere()
    expect(f.statut).toBe('brouillon')
    expect(f.version).toBe(1)
    expect(f.ref).toBe(`FOR-${today().slice(0, 4)}-${today().startsWith('2026') ? '020' : '001'}`)
  })

  it('refuse de valider sans durée supérieure à 0 (RG01)', async () => {
    await ouvrir('/formations/nouvelle')
    saisir('Intitulé de la formation', 'Excel débutant')
    fireEvent.click(screen.getByRole('button', { name: 'Valider' }))
    expect(screen.getByText('Indiquez une durée supérieure à 0.')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toContain('Impossible de valider.')
  })

  it('liste les blocs manquants et enregistre « Incomplète » avec « Valider quand même » (RG14, RG15)', async () => {
    const router = await ouvrir('/formations/nouvelle')
    saisir('Intitulé de la formation', 'Excel débutant')
    saisir('Durée (en heures)', '7')
    fireEvent.click(screen.getByRole('button', { name: 'Valider' }))
    expect(await screen.findByRole('heading', { name: 'Votre formation n’est pas complète' })).toBeTruthy()
    expect(screen.getByText('13 blocs ne sont pas remplis.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Valider quand même' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/formations'))
    expect((await derniere()).statut).toBe('incomplete')
  })

  it('valide une formation complète et augmente sa version (RG04, RG13)', async () => {
    await service.enregistrerFormation({ ...(await service.obtenirFormation(6)) }, 'brouillon') // version 2
    await ouvrir('/formations/6/modifier')
    fireEvent.click(screen.getByRole('button', { name: 'Valider' }))
    await waitFor(async () => expect((await service.obtenirFormation(6)).statut).toBe('validee'))
    expect((await service.obtenirFormation(6)).version).toBe(3)
  })

  it('prévient que les changements s’appliqueront aux prochaines sessions (RG06)', async () => {
    await ouvrir('/formations/3/modifier')
    expect(screen.getByText('Cette formation a 3 sessions.')).toBeTruthy()
  })

  it('demande confirmation en quittant avec des modifications non enregistrées (RG05)', async () => {
    const router = await ouvrir('/formations/2/modifier')
    fireEvent.click(screen.getByRole('button', { name: 'Quitter sans sauvegarder' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/formations'))
    await router.navigate('/formations/2/modifier')
    await screen.findByRole('heading', { name: 'Informations de base' })
    saisir('Intitulé de la formation', 'Excel avancé — 2027')
    fireEvent.click(screen.getByRole('button', { name: 'Quitter sans sauvegarder' }))
    expect(await screen.findByRole('heading', { name: 'Quitter sans sauvegarder ?' })).toBeTruthy()
    // Même protection en cliquant sur un lien du menu
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Menu principal' })).getByText('Tableau de bord'))
    expect(await screen.findByRole('heading', { name: 'Quitter sans sauvegarder ?' })).toBeTruthy()
  })

  it('n’affiche l’assistance à distance que hors présentiel (RG10)', async () => {
    await ouvrir('/formations/nouvelle')
    fireEvent.click(screen.getByRole('button', { name: 'Formateurs : à remplir' }))
    expect(screen.queryByText(/Assistance à distance/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))
    fireEvent.click(screen.getByLabelText('Mixte'))
    fireEvent.click(screen.getByRole('button', { name: 'Formateurs : à remplir' }))
    expect(screen.getByText(/Assistance à distance/)).toBeTruthy()
  })

  it('accepte plusieurs choix et une réponse « Autre » libre (RG11)', async () => {
    await ouvrir('/formations/nouvelle')
    fireEvent.click(screen.getByRole('button', { name: 'Satisfaction : à remplir' }))
    const liste = screen.getByRole('button', { name: "Comment recueillez-vous l'avis ?" })
    expect(liste.textContent).toBe('Choisir dans la liste')
    fireEvent.click(liste)
    fireEvent.click(screen.getByRole('option', { name: 'À chaud (fin de formation)' }))
    fireEvent.click(screen.getByRole('option', { name: 'À froid (3 mois après)' }))
    fireEvent.click(screen.getByRole('button', { name: 'Autre (précisez)…' }))
    fireEvent.change(screen.getByLabelText('Autre : précisez votre réponse'), { target: { value: 'Entretien téléphonique' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }))
    expect(liste.textContent).toBe('3 choix sélectionnés')
    expect(screen.getByDisplayValue('Entretien téléphonique')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))
    expect(screen.getByRole('button', { name: 'Satisfaction : complété' })).toBeTruthy()
  })

  it('exige un titre pour une autre information (RG12)', async () => {
    await ouvrir('/formations/nouvelle')
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter une autre information' }))
    expect(screen.getByLabelText('Titre de l\'information').required).toBe(true)
    saisir('Titre de l\'information', 'Matériel à apporter')
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }))
    expect(screen.getByText('Matériel à apporter')).toBeTruthy()
  })

  it('pagine les 12 blocs du contenu sans passer par le programme', async () => {
    await ouvrir('/formations/nouvelle')
    fireEvent.click(screen.getByRole('button', { name: 'Public et prérequis : à remplir' }))
    expect(screen.getByText('Champ 1 sur 12')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '← Précédent' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Suivant →' }))
    expect(screen.getByRole('heading', { level: 3, name: 'Objectifs' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Suivant →' }))
    expect(screen.getByRole('heading', { level: 3, name: 'Méthodes et moyens' })).toBeTruthy()
    expect(screen.getByText('Champ 3 sur 12')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '← Précédent' }))
    expect(screen.getByRole('heading', { level: 3, name: 'Objectifs' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Évaluation et suivi/ }))
    expect(screen.getByText('Champ 8 sur 12')).toBeTruthy()
    for (let i = 0; i < 4; i++) fireEvent.click(screen.getByRole('button', { name: 'Suivant →' }))
    expect(screen.getByRole('heading', { level: 3, name: 'Indicateurs de résultats' })).toBeTruthy()
    expect(screen.getByText('Champ 12 sur 12')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Suivant →' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Terminer' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
