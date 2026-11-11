import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../App'
import { installerFauxBackend, repondre } from '../sessions/fauxBackend'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

function afficher(adresse = '/sessions') {
  const router = createMemoryRouter(routes, { initialEntries: [adresse] })
  render(<RouterProvider router={router} />)
  return router
}
const bouton = (nom) => screen.getByRole('button', { name: nom })
const saisir = (label, valeur) => fireEvent.change(screen.getByLabelText(new RegExp(`^${label}`)), { target: { value: valeur } })
const titreEtape = () => screen.getByRole('heading', { level: 2 }).textContent

async function ouvrirFormulaire() {
  const router = afficher('/sessions/nouvelle')
  await screen.findByRole('heading', { name: 'Informations de la session' })
  return router
}
function remplirEtape1() {
  fireEvent.change(screen.getByLabelText(/^Formation/), { target: { value: '2' } })
  saisir('Date de début', '2026-11-18')
  saisir('Date de fin', '2026-11-20')
  saisir('Lieu', 'Lyon, salle 2')
}
async function allerEtape3() {
  await ouvrirFormulaire()
  remplirEtape1()
  fireEvent.click(bouton('Suivant'))
  fireEvent.click(screen.getByRole('checkbox', { name: /Julien Lefèvre/ }))
  fireEvent.click(bouton('Suivant'))
}

describe('Page Sessions et planning', () => {
  it('liste les sessions avec leur statut', async () => {
    installerFauxBackend()
    afficher()
    const ligne = (await screen.findByText('Excel avancé')).closest('li')
    expect(ligne.textContent).toContain('Du 18/11/2026 au 19/11/2026 · 09 h – 17 h')
    expect(within(ligne).getByText('3 / 8 apprenants')).toBeTruthy()
    expect(within(ligne).getByText('Prévue')).toBeTruthy()
    expect(within(ligne).getByText('NOV.')).toBeTruthy()
  })

  it('indique quand il n’y a aucune session', async () => {
    installerFauxBackend({ sessions: [] })
    afficher()
    expect(await screen.findByText("Aucune session pour l'instant")).toBeTruthy()
  })

  it('signale un backend injoignable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('réseau') }))
    afficher()
    expect((await screen.findByRole('alert')).textContent).toContain('Le serveur ne répond pas')
  })

  it('est accessible depuis le menu', async () => {
    installerFauxBackend()
    afficher('/tableau-de-bord')
    fireEvent.click(screen.getByRole('link', { name: 'Sessions et planning' }))
    expect(await screen.findByRole('heading', { name: 'Sessions et planning' })).toBeTruthy()
  })
})

describe('Nouvelle session (SCRUM-25)', () => {
  it('CA1 : « Nouvelle session » ouvre l’étape 1', async () => {
    installerFauxBackend()
    const router = afficher()
    fireEvent.click(await screen.findByRole('button', { name: 'Nouvelle session' }))
    expect(await screen.findByRole('heading', { name: 'Informations de la session' })).toBeTruthy()
    expect(router.state.location.pathname).toBe('/sessions/nouvelle')
    expect(screen.getByRole('option', { name: 'Management d’équipe — les fondamentaux' })).toBeTruthy()
  })

  it('CA2 : un champ obligatoire vide reste sur l’étape 1 et chaque champ manquant est signalé', async () => {
    installerFauxBackend()
    await ouvrirFormulaire()
    saisir('Nombre de places', '')
    fireEvent.click(bouton('Suivant'))
    expect(titreEtape()).toBe('Informations de la session')
    for (const label of ['Formation', 'Date de début', 'Date de fin', 'Durée', 'Nombre de places', 'Lieu']) {
      expect(screen.getByLabelText(new RegExp(`^${label}`)).getAttribute('aria-invalid'), label).toBe('true')
    }
    expect(screen.getAllByText('Ce champ est obligatoire.')).toHaveLength(6)
    // Corriger un champ retire son erreur
    saisir('Lieu', 'Lyon')
    expect(screen.getByLabelText(/^Lieu/).getAttribute('aria-invalid')).toBeNull()
  })

  it('CA3 : une date de fin avant le début affiche un message d’erreur', async () => {
    installerFauxBackend()
    await ouvrirFormulaire()
    remplirEtape1()
    saisir('Date de fin', '2026-11-17')
    fireEvent.click(bouton('Suivant'))
    expect(screen.getByText('La date de fin doit être postérieure ou égale à la date de début.')).toBeTruthy()
    expect(titreEtape()).toBe('Informations de la session')
  })

  it('reprend la durée de la formation choisie, modifiable', async () => {
    installerFauxBackend()
    await ouvrirFormulaire()
    fireEvent.change(screen.getByLabelText(/^Formation/), { target: { value: '1' } })
    expect(screen.getByLabelText(/^Durée/).value).toBe('14')
    saisir('Durée', '12')
    expect(screen.getByLabelText(/^Durée/).value).toBe('12')
  })

  it('demande le lien pour une classe virtuelle', async () => {
    installerFauxBackend()
    await ouvrirFormulaire()
    fireEvent.click(screen.getByRole('radio', { name: 'Classe virtuelle' }))
    expect(screen.queryByLabelText(/^Lieu/)).toBeNull()
    fireEvent.click(bouton('Suivant'))
    expect(screen.getByLabelText(/^Lien de la classe virtuelle/).getAttribute('aria-invalid')).toBe('true')
  })

  it('CA4 + CA6 : étape 2, au moins un formateur', async () => {
    installerFauxBackend()
    await ouvrirFormulaire()
    remplirEtape1()
    fireEvent.click(bouton('Suivant'))
    expect(titreEtape()).toBe('Formateur(s) *')
    expect(screen.getByText(/Du 18\/11\/2026 au 20\/11\/2026 · 09 h – 17 h/)).toBeTruthy()
    fireEvent.click(bouton('Suivant'))
    expect(screen.getByRole('alert').textContent).toBe('Une session doit avoir au moins un formateur')
    expect(titreEtape()).toBe('Formateur(s) *')
    // « Précédent » revient à l'étape 1 sans perdre la saisie
    fireEvent.click(bouton('Précédent'))
    expect(screen.getByLabelText(/^Lieu/).value).toBe('Lyon, salle 2')
  })

  it('CA5 : un formateur sélectionné ouvre l’étape 3', async () => {
    installerFauxBackend()
    await allerEtape3()
    expect(titreEtape()).toBe('Apprenant(s) *')
    expect(screen.getByText('0 apprenant sélectionné')).toBeTruthy()
  })

  it('CA7 : sans apprenant, la session n’est pas créée', async () => {
    const fetch = installerFauxBackend()
    await allerEtape3()
    fireEvent.click(bouton('Créer la session'))
    expect(screen.getByRole('alert').textContent).toBe('Une session doit avoir au moins un apprenant')
    expect(fetch.mock.calls.some(([, o]) => o?.method === 'POST')).toBe(false)
  })

  it('CA8 : la session est créée « Prévue », retour à la liste avec confirmation', async () => {
    const fetch = installerFauxBackend()
    await allerEtape3()
    fireEvent.click(screen.getByRole('checkbox', { name: /Camille Martin/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: /Hugo Bernard/ }))
    expect(screen.getByText('2 apprenants sélectionnés')).toBeTruthy()
    fireEvent.click(bouton('Créer la session'))
    const message = await screen.findByRole('status')
    expect(message.textContent).toBe('La session « Management d’équipe — les fondamentaux » du 18/11/2026 a été créée avec le statut « Prévue ».')
    const post = fetch.mock.calls.find(([, o]) => o?.method === 'POST')
    expect(JSON.parse(post[1].body)).toMatchObject({ formation: 2, formateurs: [4], apprenants: [1, 2], duree_heures: '21' })
    const ligne = (await screen.findByText('Management d’équipe — les fondamentaux')).closest('li')
    expect(ligne.classList.contains('nouvelle')).toBe(true)
    expect(within(ligne).getByText('2 / 10 apprenants')).toBeTruthy()
    fireEvent.click(bouton('Fermer le message'))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('« Annuler » ramène à la page Sessions et planning, à chaque étape', async () => {
    installerFauxBackend()
    const router = await ouvrirFormulaire()
    fireEvent.click(bouton('Annuler'))
    expect(await screen.findByRole('heading', { name: 'Sessions et planning' })).toBeTruthy()
    expect(router.state.location.pathname).toBe('/sessions')
    cleanup()
    await allerEtape3()
    fireEvent.click(bouton('Annuler'))
    expect(await screen.findByRole('heading', { name: 'Sessions et planning' })).toBeTruthy()
  })

  it('erreurs du serveur : retour à l’étape concernée', async () => {
    let reponse = repondre(400, { code: 'FORMATEUR_REQUIS', detail: 'Une session doit avoir au moins un formateur' })
    installerFauxBackend({ reponsePost: () => reponse })
    await allerEtape3()
    fireEvent.click(screen.getByRole('checkbox', { name: /Camille Martin/ }))
    fireEvent.click(bouton('Créer la session'))
    await waitFor(() => expect(titreEtape()).toBe('Formateur(s) *'))
    expect(screen.getByRole('alert').textContent).toBe('Une session doit avoir au moins un formateur')

    fireEvent.click(bouton('Suivant'))
    reponse = repondre(400, { code: 'APPRENANT_REQUIS', detail: 'Une session doit avoir au moins un apprenant' })
    fireEvent.click(bouton('Créer la session'))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Une session doit avoir au moins un apprenant'))

    reponse = repondre(400, { code: 'DATES_INVALIDES', detail: 'La date de fin doit être postérieure ou égale à la date de début.' })
    fireEvent.click(bouton('Créer la session'))
    await waitFor(() => expect(titreEtape()).toBe('Informations de la session'))
    expect(screen.getByText('La date de fin doit être postérieure ou égale à la date de début.')).toBeTruthy()

    reponse = repondre(400, { lieu: ['Ce champ est obligatoire.'], autre: ['ignoré'] })
    fireEvent.click(bouton('Suivant'))
    fireEvent.click(bouton('Suivant'))
    fireEvent.click(bouton('Créer la session'))
    await waitFor(() => expect(titreEtape()).toBe('Informations de la session'))
    expect(screen.getByLabelText(/^Lieu/).getAttribute('aria-invalid')).toBe('true')

    reponse = repondre(500, { inconnu: 1 })
    fireEvent.click(bouton('Suivant'))
    fireEvent.click(bouton('Suivant'))
    fireEvent.click(bouton('Créer la session'))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Certaines informations sont invalides.'))
  })

  it('signale si les listes ne se chargent pas', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('réseau') }))
    afficher('/sessions/nouvelle')
    expect((await screen.findByRole('alert')).textContent).toContain('Le serveur ne répond pas')
  })
})
