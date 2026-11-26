import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../App'
import {
  corpsEntreprise, ENTREPRISE_VIDE, MSG_EMAIL, MSG_OBLIGATOIRE, MSG_SIRET, MSG_TELEPHONE, verifierEntreprise, villeFr,
} from '../entreprises/entreprises'
import { installerFauxBackend, repondre } from '../sessions/fauxBackend'

// SCRUM-113 : panneau « Nouvelle entreprise cliente » (onglet Entreprises clientes) ; CA6 de SCRUM-120
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

async function ouvrirPanneau() {
  const router = createMemoryRouter(routes, { initialEntries: ['/parties-prenantes'] })
  render(<RouterProvider router={router} />)
  fireEvent.click(screen.getByRole('tab', { name: /^Entreprises clientes/ }))
  await screen.findByRole('list', { name: 'Entreprises clientes' })
  fireEvent.click(screen.getByRole('button', { name: '+ Nouvelle entreprise cliente' }))
}
const panneau = () => screen.queryByRole('dialog', { name: 'Nouvelle entreprise cliente' })
const bouton = (nom) => screen.getByRole('button', { name: nom })
const champ = (libelle) => screen.getByLabelText(new RegExp(`^${libelle}( \\*)?$`))
const saisir = (libelle, valeur) => fireEvent.change(champ(libelle), { target: { value: valeur } })
const erreur = (id) => document.getElementById(`ent-${id}-err`)?.textContent
const chercher = (texte) => { saisir('Raison sociale ou SIRET', texte); fireEvent.click(bouton('Rechercher')) }
const posts = (fetch) => fetch.mock.calls.filter(([url, o]) => url.endsWith('/entreprises/') && o?.method === 'POST')
const sections = () => within(panneau()).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)

async function choisirDurand() {
  chercher('durand')
  fireEvent.click(await screen.findByRole('button', { name: /SOCIETE DURAND/ }))
}

describe('Panneau « Nouvelle entreprise cliente » (SCRUM-113)', () => {
  it('CA1 : s’ouvre sur la recherche, « Enregistrer » inactif', async () => {
    installerFauxBackend()
    await ouvrirPanneau()
    expect(sections()).toEqual(['Recherche'])
    expect(champ('Raison sociale ou SIRET').getAttribute('placeholder')).toBe('Ex. : Durand ou 389 456 123 00034')
    expect(screen.getByText('3 caractères minimum · annuaire officiel des entreprises')).toBeTruthy()
    expect(bouton('Enregistrer').disabled).toBe(true)
  })

  it('moins de 3 caractères : l’annuaire n’est pas interrogé', async () => {
    const fetch = installerFauxBackend()
    await ouvrirPanneau()
    chercher(' du ')
    expect(erreur('recherche')).toBe('Saisissez au moins 3 caractères.')
    expect(fetch.mock.calls.some(([url]) => url.includes('/annuaire-entreprises/'))).toBe(false)
    saisir('Raison sociale ou SIRET', 'dur')
    expect(erreur('recherche')).toBeUndefined()
  })

  it('CA2 : les établissements s’affichent avec leur nom, leur SIRET et leur ville', async () => {
    const fetch = installerFauxBackend()
    await ouvrirPanneau()
    saisir('Raison sociale ou SIRET', 'durand')
    fireEvent.keyDown(champ('Raison sociale ou SIRET'), { key: 'Enter' })
    const resultats = within(await screen.findByRole('list', { name: 'Établissements trouvés' })).getAllByRole('button')
    expect(resultats.map((r) => r.textContent)).toEqual([
      'SOCIETE DURANDSIRET 389 456 123 00034 · Paris', 'DURAND ET FILSSIRET 512 874 963 00027 · Lyon'])
    expect(fetch.mock.calls.some(([url]) => url.endsWith('/annuaire-entreprises/?recherche=durand'))).toBe(true)
  })

  it('CA3 : l’établissement choisi remplit les champs ; les autres sections apparaissent', async () => {
    installerFauxBackend()
    await ouvrirPanneau()
    await choisirDurand()
    expect(sections()).toEqual(['Recherche', 'Entreprise', 'Facturation', 'Contact', 'Interlocuteur principal'])
    expect(['Raison sociale', 'SIRET', 'Forme juridique', 'Code NAF', 'Adresse', 'Code postal', 'Ville'].map((l) => champ(l).value))
      .toEqual(['SOCIETE DURAND', '38945612300034', 'SAS', '47.11B', '12 RUE DE LA PAIX', '75002', 'PARIS'])
    expect(screen.queryByRole('list', { name: 'Établissements trouvés' })).toBeNull()
    expect(screen.getByRole('checkbox', { name: 'Adresse de facturation identique' }).checked).toBe(true)
    expect(within(champ('Rôle')).getAllByRole('option').map((o) => o.textContent))
      .toEqual(['Choisir un rôle', 'Ressources humaines', 'Manager', 'Comptabilité', 'Dirigeant'])
    expect(bouton('Enregistrer').disabled).toBe(false)
  })

  it('CA4 : aucun établissement, ou annuaire indisponible : saisie manuelle avec les mêmes champs, vides', async () => {
    installerFauxBackend({ annuaire: [] })
    await ouvrirPanneau()
    chercher('zyxwq')
    expect((await screen.findByRole('status')).textContent).toContain('Aucun établissement trouvé')
    fireEvent.click(bouton('Saisir l’entreprise manuellement'))
    expect(sections()).toEqual(['Recherche', 'Entreprise', 'Facturation', 'Contact', 'Interlocuteur principal'])
    expect(champ('Raison sociale').value).toBe('')
    expect(champ('Raison sociale ou SIRET').value).toBe('zyxwq')
    expect(screen.queryByText('Aucun établissement trouvé')).toBeNull()
    cleanup()
    installerFauxBackend({ annuaire: new Error('panne') })
    await ouvrirPanneau()
    chercher('durand')
    expect(await screen.findByText('Aucun établissement trouvé')).toBeTruthy()
  })

  it('CA6 : champs obligatoires vides, SIRET, e-mails et téléphone invalides : rien n’est créé', async () => {
    const fetch = installerFauxBackend({ annuaire: [] })
    await ouvrirPanneau()
    chercher('zyxwq')
    fireEvent.click(await screen.findByRole('button', { name: 'Saisir l’entreprise manuellement' }))
    saisir('SIRET', '3894561230003')
    saisir('E-mail de l’entreprise', 'contact@durand')
    saisir('E-mail', 'h.weber@')
    saisir('Téléphone', '06 12 34 5')
    fireEvent.click(bouton('Enregistrer'))
    expect(['raison_sociale', 'siret', 'adresse', 'code_postal', 'ville', 'email', 'interlocuteur_email', 'interlocuteur_telephone']
      .map(erreur)).toEqual([MSG_OBLIGATOIRE, MSG_SIRET, MSG_OBLIGATOIRE, MSG_OBLIGATOIRE, MSG_OBLIGATOIRE, MSG_EMAIL, MSG_EMAIL, MSG_TELEPHONE])
    expect(champ('SIRET').getAttribute('aria-invalid')).toBe('true')
    expect(posts(fetch)).toHaveLength(0)
    saisir('SIRET', '38945612300034')
    expect(champ('SIRET').getAttribute('aria-invalid')).toBeNull()
  })

  it('CA7 : décochée, « Adresse de facturation » apparaît et devient obligatoire', async () => {
    installerFauxBackend()
    await ouvrirPanneau()
    await choisirDurand()
    expect(screen.queryByLabelText(/^Adresse de facturation \*?$/)).toBeNull()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Adresse de facturation identique' }))
    fireEvent.click(bouton('Enregistrer'))
    expect(erreur('adresse_facturation')).toBe(MSG_OBLIGATOIRE)
  })

  it('CA8 + SCRUM-120 CA6 : enregistrée, le panneau se ferme et elle apparaît en tête de liste, mise en évidence', async () => {
    const fetch = installerFauxBackend()
    await ouvrirPanneau()
    await choisirDurand()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Adresse de facturation identique' }))
    saisir('Adresse de facturation', ' 5 AVENUE DES CHAMPS, 75008 PARIS ')
    saisir('Prénom', 'Hugo')
    saisir('Nom', 'Weber')
    fireEvent.change(champ('Rôle'), { target: { value: 'RESSOURCES_HUMAINES' } })
    saisir('Téléphone', '06 12 34 56 78')
    fireEvent.click(bouton('Enregistrer'))
    await waitFor(() => expect(panneau()).toBeNull())
    expect(JSON.parse(posts(fetch)[0][1].body)).toEqual({
      ...ENTREPRISE_VIDE, raison_sociale: 'SOCIETE DURAND', siret: '38945612300034', forme_juridique: 'SAS', code_naf: '47.11B',
      adresse: '12 RUE DE LA PAIX', code_postal: '75002', ville: 'PARIS', adresse_facturation_identique: false,
      adresse_facturation: '5 AVENUE DES CHAMPS, 75008 PARIS', interlocuteur_prenom: 'Hugo', interlocuteur_nom: 'Weber',
      interlocuteur_role: 'RESSOURCES_HUMAINES', interlocuteur_telephone: '06 12 34 56 78',
    })
    await waitFor(() => expect(within(screen.getByRole('list', { name: 'Entreprises clientes' })).getAllByRole('listitem')).toHaveLength(3))
    const [premiere] = within(screen.getByRole('list', { name: 'Entreprises clientes' })).getAllByRole('listitem')
    expect(premiere.textContent).toContain('SOCIETE DURAND')
    expect(premiere.getAttribute('aria-current')).toBe('true')
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Entreprises clientes · 3')
  })

  it('ajoutée pendant une recherche dans la liste : la recherche est vidée pour la montrer', async () => {
    installerFauxBackend()
    const router = createMemoryRouter(routes, { initialEntries: ['/parties-prenantes'] })
    render(<RouterProvider router={router} />)
    fireEvent.click(screen.getByRole('tab', { name: /^Entreprises clientes/ }))
    await screen.findByRole('list', { name: 'Entreprises clientes' })
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'globex' } })
    fireEvent.click(screen.getByRole('button', { name: '+ Nouvelle entreprise cliente' }))
    await choisirDurand()
    fireEvent.click(bouton('Enregistrer'))
    await waitFor(() => expect(screen.getByRole('searchbox').value).toBe(''))
    await waitFor(() => expect(within(screen.getByRole('list', { name: 'Entreprises clientes' })).getAllByRole('listitem')[0]
      .getAttribute('aria-current')).toBe('true'))
  })

  it('CA5 : SIRET déjà enregistré dans le centre : message sous le SIRET, rien n’est créé', async () => {
    installerFauxBackend({ reponseEntreprise: () => repondre(409, { code: 'SIRET_DEJA_ENREGISTRE', detail: 'Cette entreprise est déjà enregistrée' }) })
    await ouvrirPanneau()
    await choisirDurand()
    fireEvent.click(bouton('Enregistrer'))
    await waitFor(() => expect(erreur('siret')).toBe('Cette entreprise est déjà enregistrée'))
    expect(panneau()).toBeTruthy()
  })

  it('erreurs du serveur : sous le champ, ou en encadré', async () => {
    let reponse = repondre(400, { code_postal: ['Champ obligatoire'] })
    installerFauxBackend({ reponseEntreprise: () => reponse })
    await ouvrirPanneau()
    await choisirDurand()
    fireEvent.click(bouton('Enregistrer'))
    await waitFor(() => expect(erreur('code_postal')).toBe('Champ obligatoire'))
    reponse = repondre(500, null)
    fireEvent.click(bouton('Enregistrer'))
    await waitFor(() => expect(within(panneau()).getByRole('alert').textContent).toBe('Certaines informations sont invalides.'))
  })

  it('« Annuler » ferme le panneau sans rien créer', async () => {
    const fetch = installerFauxBackend()
    await ouvrirPanneau()
    await choisirDurand()
    fireEvent.click(bouton('Annuler'))
    expect(panneau()).toBeNull()
    expect(posts(fetch)).toHaveLength(0)
  })
})

describe('règles de l’entreprise (SCRUM-113)', () => {
  const valide = { ...ENTREPRISE_VIDE, raison_sociale: 'A', siret: '389 456 123 00034', adresse: 'B', code_postal: '75002', ville: 'P' }
  it('obligatoires et formats', () => {
    expect(verifierEntreprise(valide)).toEqual({})
    expect(verifierEntreprise({ ...valide, adresse_facturation_identique: false })).toEqual({ adresse_facturation: MSG_OBLIGATOIRE })
    expect(verifierEntreprise({ ...valide, siret: '1234567890123A' })).toEqual({ siret: MSG_SIRET })
    expect(verifierEntreprise({ ...valide, interlocuteur_telephone: '06.12.34.56.78' })).toEqual({})
  })

  it('corps envoyé et ville affichée', () => {
    expect(corpsEntreprise({ ...valide, raison_sociale: ' A ' })).toMatchObject({ raison_sociale: 'A', siret: '38945612300034', adresse_facturation_identique: true })
    expect([villeFr('PARIS'), villeFr('SAINT-DENIS'), villeFr('aix en provence'), villeFr(undefined)])
      .toEqual(['Paris', 'Saint-Denis', 'Aix En Provence', ''])
  })
})
