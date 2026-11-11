import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../App'
import { installerFauxBackend, repondre } from '../sessions/fauxBackend'
import { MSG_DATES } from '../sessions/regles'
import { MSG_CORRIGER } from './ModifierSession'

// SCRUM-36 : « Modifier la session », sur une seule page, pré-remplie
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

async function ouvrir(options) {
  const fetch = installerFauxBackend(options)
  const router = createMemoryRouter(routes, { initialEntries: ['/sessions/1/modifier'] })
  render(<RouterProvider router={router} />)
  await screen.findByRole('heading', { name: 'Informations de la session' })
  return { router, fetch }
}
const champ = (label) => screen.getByLabelText(new RegExp(`^${label}`))
const saisir = (label, valeur) => fireEvent.change(champ(label), { target: { value: valeur } })
const cocher = (nom) => fireEvent.click(screen.getByRole('checkbox', { name: new RegExp(nom) }))
const enregistrer = () => fireEvent.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }))
const puts = (fetch) => fetch.mock.calls.filter(([, o]) => o?.method === 'PUT')

describe('Modifier la session', () => {
  it('CA1 : affiche les données actuelles de la session, sur une seule page', async () => {
    await ouvrir()
    expect(screen.getByRole('heading', { level: 1, name: 'Modifier la session' })).toBeTruthy()
    expect(champ('Formation').value).toBe('1')
    expect([champ('Date de début').value, champ('Date de fin').value]).toEqual(['2026-11-18', '2026-11-19'])
    expect([champ('Heure de début').value, champ('Heure de fin').value]).toEqual(['09:00', '17:00'])
    expect([champ('Durée').value, champ('Nombre de places').value, champ('Lieu').value]).toEqual(['14', '8', 'Lyon'])
    expect(screen.getByRole('radio', { name: 'Présentiel' }).checked).toBe(true)
    // Formateurs et apprenants déjà rattachés : cochés
    expect(screen.getByRole('checkbox', { name: /Sarah Dubois/ }).checked).toBe(true)
    expect(screen.getByRole('checkbox', { name: /Julien Lefèvre/ }).checked).toBe(false)
    expect(screen.getByRole('checkbox', { name: /Camille Martin/ }).checked).toBe(true)
    expect(screen.getByText('2 apprenants sélectionnés')).toBeTruthy()
  })

  it('CA2 : « Annuler » revient à la fiche sans rien enregistrer', async () => {
    const { router, fetch } = await ouvrir()
    expect(screen.getByRole('link', { name: /Retour à la session/ }).getAttribute('href')).toBe('/sessions/1')
    saisir('Lieu', 'Paris')
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(router.state.location.pathname).toBe('/sessions/1')
    expect(puts(fetch)).toHaveLength(0)
    expect(await screen.findByText('Lyon')).toBeTruthy()
  })

  it('CA3 : champ vide ou date de fin antérieure : rien n’est modifié, chaque champ est signalé', async () => {
    const { fetch } = await ouvrir()
    saisir('Date de fin', '2026-11-17')
    saisir('Lieu', ' ')
    enregistrer()
    expect(screen.getByText(MSG_CORRIGER)).toBeTruthy()
    expect(document.getElementById('ns-fin-err').textContent).toBe(MSG_DATES)
    expect(champ('Lieu').getAttribute('aria-invalid')).toBe('true')
    expect(puts(fetch)).toHaveLength(0)
    // La correction d'un champ efface son erreur
    saisir('Lieu', 'Paris')
    expect(champ('Lieu').getAttribute('aria-invalid')).toBeNull()
  })

  it('CA4 : aucun formateur ou aucun apprenant : message dédié, rien n’est modifié', async () => {
    const { fetch } = await ouvrir()
    cocher('Sarah Dubois')
    cocher('Camille Martin')
    cocher('Hugo Bernard')
    enregistrer()
    const alertes = screen.getAllByRole('alert').map((a) => a.textContent)
    expect(alertes).toEqual(['Une session doit avoir au moins un formateur', 'Une session doit avoir au moins un apprenant'])
    expect(screen.queryByText(MSG_CORRIGER)).toBeNull()
    expect(puts(fetch)).toHaveLength(0)
    // Cocher une personne efface le message de sa liste
    cocher('Julien Lefèvre')
    expect(screen.getAllByRole('alert')).toHaveLength(1)
  })

  it('CA5 : enregistre et revient à la fiche avec la confirmation et les nouvelles informations', async () => {
    const { router, fetch } = await ouvrir()
    saisir('Lieu', ' Salle Horizon, Lyon ')
    cocher('Julien Lefèvre')
    cocher('Hugo Bernard')
    enregistrer()
    expect((await screen.findByRole('status')).textContent).toContain('Les modifications de la session « Excel avancé » ont été enregistrées.')
    expect(router.state.location.pathname).toBe('/sessions/1')
    const [url, options] = puts(fetch)[0]
    expect(url).toBe('/api/sessions/1/')
    expect(JSON.parse(options.body)).toMatchObject({ lieu: 'Salle Horizon, Lyon', formateurs: [1, 4], apprenants: [1], duree_heures: '14', nombre_places: 8 })
    expect(await screen.findByText('Salle Horizon, Lyon')).toBeTruthy()
    expect(screen.getByText('Julien Lefèvre')).toBeTruthy()
  })

  it('choisir une autre formation reprend sa durée ; passer en classe virtuelle demande le lien', async () => {
    const { fetch } = await ouvrir()
    saisir('Formation', '2')
    expect(champ('Durée').value).toBe('21')
    fireEvent.click(screen.getByRole('radio', { name: 'Classe virtuelle' }))
    enregistrer()
    expect(champ('Lien de la classe virtuelle').getAttribute('aria-invalid')).toBe('true')
    saisir('Lien de la classe virtuelle', 'https://visio.exemple.fr/abc')
    enregistrer()
    await screen.findByRole('status')
    expect(JSON.parse(puts(fetch)[0][1].body)).toMatchObject({ formation: 2, modalite: 'CLASSE_VIRTUELLE', lieu: '', lien_classe_virtuelle: 'https://visio.exemple.fr/abc' })
  })

  it('refus du serveur : formateur ou apprenant manquant, champ refusé, autre erreur', async () => {
    const cas = [
      [repondre(400, { code: 'FORMATEUR_REQUIS', detail: 'Une session doit avoir au moins un formateur' }), 'Une session doit avoir au moins un formateur'],
      [repondre(400, { code: 'APPRENANT_REQUIS', detail: 'Une session doit avoir au moins un apprenant' }), 'Une session doit avoir au moins un apprenant'],
      [repondre(400, { code: 'DATES_INVALIDES', detail: MSG_DATES }), MSG_CORRIGER],
      [repondre(404, { code: 'SESSION_INTROUVABLE', detail: 'Session introuvable' }), 'Session introuvable'],
    ]
    for (const [reponse, attendu] of cas) {
      cleanup()
      await ouvrir({ reponsePut: () => reponse })
      enregistrer()
      expect((await screen.findByRole('alert')).textContent).toBe(attendu)
      expect(screen.getByRole('button', { name: 'Enregistrer les modifications' }).disabled).toBe(false)
    }
  })

  it('session introuvable au chargement : message et retour aux sessions', async () => {
    installerFauxBackend()
    render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/sessions/42/modifier'] })} />)
    expect((await screen.findByRole('alert')).textContent).toContain('Session introuvable')
    expect(screen.getByRole('link', { name: 'Retour aux sessions' })).toBeTruthy()
  })
})
