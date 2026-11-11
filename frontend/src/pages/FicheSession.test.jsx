import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../App'
import { installerFauxBackend, repondre, SESSION_EXCEL } from '../sessions/fauxBackend'

// SCRUM-36 : fiche d'une session, ouverte depuis Sessions et planning
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

function afficher(adresse, state) {
  const router = createMemoryRouter(routes, { initialEntries: [state ? { pathname: adresse, state } : adresse] })
  render(<RouterProvider router={router} />)
  return router
}

describe('Fiche d’une session', () => {
  it('s’ouvre en cliquant sur une session de la liste', async () => {
    installerFauxBackend()
    const router = afficher('/sessions')
    fireEvent.click(await screen.findByRole('link', { name: /Excel avancé/ }))
    expect(router.state.location.pathname).toBe('/sessions/1')
    expect(await screen.findByRole('heading', { level: 1, name: 'Excel avancé' })).toBeTruthy()
  })

  it('affiche les informations, les apprenants et les formateurs rattachés', async () => {
    installerFauxBackend()
    afficher('/sessions/1')
    await screen.findByRole('heading', { level: 1, name: 'Excel avancé' })
    expect(screen.getByText('Prévue')).toBeTruthy()
    const infos = Object.fromEntries([...document.querySelectorAll('.fs-infos > div')].map((d) => [d.querySelector('dt').textContent, d.querySelector('dd').textContent]))
    expect(infos).toEqual({ Dates: '18/11/2026 →19/11/2026', Horaires: '09 h – 17 h', Durée: '14 h', Lieu: 'Lyon', Places: '3 / 8' })
    const apprenants = screen.getByRole('list', { name: 'Apprenants · 2' })
    expect(within(apprenants).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'CMCamille Martincamille.martin@acme.fr', 'HBHugo Bernardhugo.bernard@acme.fr',
    ])
    expect(within(screen.getByRole('list', { name: 'Formateur(s)' })).getByText('Sarah Dubois')).toBeTruthy()
  })

  it('montre le lien en classe virtuelle et des tirets pour les valeurs absentes', async () => {
    installerFauxBackend({ sessions: [{ ...SESSION_EXCEL, modalite: 'CLASSE_VIRTUELLE', lien_classe_virtuelle: 'https://visio.exemple.fr/abc',
      heure_debut: null, heure_fin: null, duree_heures: null, nombre_places: null, formateurs: [], apprenants: [], nombre_apprenants: 0 }] })
    afficher('/sessions/1')
    const lien = await screen.findByRole('link', { name: 'Classe virtuelle' })
    expect(lien.getAttribute('href')).toBe('https://visio.exemple.fr/abc')
    expect(screen.getAllByText('—')).toHaveLength(2)
    expect(screen.getAllByText('Aucune personne rattachée.')).toHaveLength(2)
  })

  it('le bouton « Modifier » ouvre la page « Modifier la session »', async () => {
    installerFauxBackend()
    const router = afficher('/sessions/1')
    fireEvent.click(await screen.findByRole('button', { name: 'Modifier' }))
    expect(router.state.location.pathname).toBe('/sessions/1/modifier')
  })

  it('affiche le message de confirmation transmis après une modification, et le referme', async () => {
    installerFauxBackend()
    afficher('/sessions/1', { message: 'Les modifications de la session « Excel avancé » ont été enregistrées.' })
    expect((await screen.findByRole('status')).textContent).toContain('ont été enregistrées')
    fireEvent.click(screen.getByRole('button', { name: 'Fermer le message' }))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('session introuvable : message et retour aux sessions', async () => {
    installerFauxBackend()
    afficher('/sessions/42')
    expect((await screen.findByRole('alert')).textContent).toContain('Session introuvable')
    expect(screen.getByRole('link', { name: 'Retour aux sessions' }).getAttribute('href')).toBe('/sessions')
  })

  it('non connecté : propose de se connecter', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => repondre(401, { code: 'NON_CONNECTE', detail: 'Connectez-vous.' })))
    afficher('/sessions/1')
    await screen.findByRole('alert')
    expect(screen.getByRole('link', { name: 'Se connecter' })).toBeTruthy()
  })
})
