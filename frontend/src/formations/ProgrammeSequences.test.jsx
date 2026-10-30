import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { routes } from '../App'
import * as service from './service'

beforeEach(() => service.chargerExemples())
afterEach(cleanup)

// Ouvre le programme d'une formation depuis la carte (« Programme non créé ») : /formations/:id/modifier?bloc=programme
async function ouvrirProgramme(id) {
  const router = createMemoryRouter(routes, { initialEntries: [`/formations/${id}/modifier?bloc=programme`] })
  render(<RouterProvider router={router} />)
  await screen.findByRole('heading', { name: 'Créer un programme' })
  return router
}
const champ = (seq, nom) => document.querySelector(`#seq-${seq} [data-mf="${nom}"]`)
const remplir = (seq, valeurs) => Object.entries(valeurs).forEach(([k, v]) => fireEvent.change(champ(seq, k), { target: { value: v } }))

describe('Programme et séquences', () => {
  it('propose la modalité selon celle de la formation et les objectifs du bloc Objectifs (RG19, RG20)', async () => {
    await ouvrirProgramme(6) // Anglais professionnel : distanciel, programme existant
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter une séquence' }))
    expect(champ(3, 'modalite').value).toBe('Distanciel synchrone (classe virtuelle)')
    const options = Array.from(champ(3, 'objectif').options).map((o) => o.textContent)
    expect(options).toEqual(['Choisir un objectif…', 'Fixer des objectifs SMART', 'Déléguer une tâche', 'Conduire un entretien individuel'])
  })

  it('avertit sans bloquer quand le total des heures diffère de la durée (RG21)', async () => {
    await ouvrirProgramme(6) // 14 h de séquences pour 30 h prévues
    expect(screen.getByText('Le total ne correspond pas à la durée de la formation')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))
    expect(screen.queryByRole('heading', { name: 'Créer un programme' })).toBeNull()
  })

  it('liste les champs manquants par séquence et les passe en rouge avec « Compléter » (RG18, RG22)', async () => {
    await ouvrirProgramme(4) // SST : pas de programme
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter une séquence' }))
    remplir(0, { seq: 'Les gestes qui sauvent' })
    fireEvent.click(screen.getByRole('button', { name: 'Suivant →' }))
    expect(await screen.findByRole('heading', { name: 'Le programme n’est pas complet' })).toBeTruthy()
    expect(screen.getByText('Objectif visé · Contenu abordé · Durée · Méthodes et activités')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Compléter le programme' }))
    await waitFor(() => expect(champ(0, 'duree').classList.contains('err')).toBe(true))
    expect(champ(0, 'seq').classList.contains('err')).toBe(false)
    expect(champ(0, 'supports')).toBeNull() // facultatif : jamais en rouge
  })

  it('« Quitter sans enregistrer le programme » ne garde pas les séquences incomplètes (RG22)', async () => {
    await ouvrirProgramme(4)
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter une séquence' }))
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Quitter sans enregistrer le programme' }))
    expect(screen.getByRole('button', { name: /Créer un programme/ }).textContent).toContain('Le déroulé de la formation')
  })

  it('une séquence complète rend le programme complet et la formation peut être enregistrée sans programme (RG16)', async () => {
    const router = await ouvrirProgramme(4)
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter une séquence' }))
    remplir(0, { seq: 'Les gestes qui sauvent', duree: '14', objectif: 'Porter secours', modalite: 'Présentiel', contenu: 'Alerter, protéger, secourir', activites: 'Mises en situation' })
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))
    expect(screen.getByRole('button', { name: /Créer un programme/ }).textContent).toContain('1 séquence · 14 h')
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer en brouillon' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/formations'))
    expect((await service.obtenirFormation(4)).values.modules).toHaveLength(1)
  })
})
