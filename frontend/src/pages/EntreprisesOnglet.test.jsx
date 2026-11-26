import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../App'
import { initialesEntreprise, siretFr, texteSalaries } from '../entreprises/entreprises'
import { installerFauxBackend, repondre } from '../sessions/fauxBackend'

// SCRUM-120 : onglet Entreprises clientes de Parties prenantes
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

function ouvrirOnglet() {
  const router = createMemoryRouter(routes, { initialEntries: ['/parties-prenantes'] })
  render(<RouterProvider router={router} />)
  fireEvent.click(screen.getByRole('tab', { name: /^Entreprises clientes/ }))
}
const liste = () => screen.findByRole('list', { name: 'Entreprises clientes' })
const lignes = async () => within(await liste()).getAllByRole('listitem')
const rechercher = (texte) => fireEvent.change(screen.getByRole('searchbox', { name: 'Rechercher une entreprise cliente' }), { target: { value: texte } })

describe('Liste des entreprises clientes (SCRUM-120)', () => {
  it('CA1 : triées par raison sociale, avec toutes leurs informations ; carte « Entreprises clientes · N » et ligne d’en-tête', async () => {
    installerFauxBackend()
    ouvrirOnglet()
    const [globex, durand] = await lignes()
    expect(screen.getByRole('tab', { name: /^Entreprises clientes/ }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Entreprises clientes · 2')
    expect(document.querySelector('.ent-entete').textContent).toBe('EntrepriseVilleOPCOInterlocuteurSalariés')
    expect(globex.textContent).toBe('GGlobex528 741 963 00015NantesAKTO—1 salarié')
    expect(durand.textContent).toBe('SDSociété Durand389 456 123 00034ParisÀ confirmerHugo Weber2 salariés')
    expect(durand.querySelector('.bulle').className).toBe('bulle bulle-1')
    expect(screen.getByRole('searchbox').getAttribute('placeholder')).toBe('Rechercher par raison sociale, SIRET ou ville')
  })

  it('CA2 : sans OPCO ni interlocuteur, on lit « À confirmer » (pastille orange) et « — »', async () => {
    installerFauxBackend()
    ouvrirOnglet()
    const [globex, durand] = await lignes()
    expect(within(durand).getByText('À confirmer').className).toBe('app-pastille ent-pastille-orange')
    expect(within(globex).getByText('AKTO').className).toBe('app-pastille app-pastille-verte')
    expect(within(globex).getByText('—')).toBeTruthy()
  })

  it('CA4 : la recherche ne garde que les entreprises dont la raison sociale, le SIRET ou la ville contient le texte', async () => {
    const fetch = installerFauxBackend()
    ouvrirOnglet()
    await lignes()
    const noms = async () => (await lignes()).map((l) => l.querySelector('b').textContent)
    rechercher('PARIS')
    await waitFor(async () => expect(await noms()).toEqual(['Société Durand']))
    expect(fetch.mock.calls.some(([url]) => url.endsWith('/entreprises/?recherche=PARIS'))).toBe(true)
    rechercher('528 741')
    await waitFor(async () => expect(await noms()).toEqual(['Globex']))
    rechercher('marseille')
    expect(await screen.findByRole('heading', { name: 'Aucun résultat pour cette recherche' })).toBeTruthy()
    // Le nombre de la carte reste celui de toutes les entreprises du centre
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Entreprises clientes · 2')
  })

  it('CA5 : aucune entreprise, un message invite à en ajouter une', async () => {
    installerFauxBackend({ entreprises: [] })
    ouvrirOnglet()
    expect(await screen.findByRole('heading', { name: 'Aucune entreprise cliente pour le moment' })).toBeTruthy()
    expect(screen.getByText('Ajoutez votre première entreprise avec « + Nouvelle entreprise cliente ».')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Entreprises clientes · 0')
  })

  // « + Nouvelle entreprise cliente » et CA6 (entreprise ajoutée en tête) : PanneauEntreprise.test.jsx (SCRUM-113)

  it('le chargement échoue : message d’erreur', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => (url.endsWith('/auth/moi') ? repondre(401, {}) : repondre(500, null))))
    ouvrirOnglet()
    expect(await screen.findByText(/Certaines informations sont invalides|réessayez|erreur/i)).toBeTruthy()
  })
})

describe('affichage des entreprises (SCRUM-120)', () => {
  it('SIRET, initiales et salariés', () => {
    expect(siretFr('41234567800021')).toBe('412 345 678 00021')
    expect(siretFr('123')).toBe('123')
    expect(siretFr('')).toBe('')
    expect(initialesEntreprise(' société  durand et fils ')).toBe('SD')
    expect(initialesEntreprise('Globex')).toBe('G')
    expect([0, 1, 2].map(texteSalaries)).toEqual(['0 salarié', '1 salarié', '2 salariés'])
  })
})
