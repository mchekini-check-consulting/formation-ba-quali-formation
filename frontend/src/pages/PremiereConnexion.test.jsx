import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../App'
import { initialesCompte, verifierCentre, VIDE } from '../compte/centre'

// SCRUM-221 : informations du centre à la première connexion
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const EMAIL = 'marie.arnaud@hitech-formation.fr'
const SANS_CENTRE = { id: 7, email: EMAIL, prenom: '', nom: '', role: 'UTILISATEUR', organisme: null }
const AVEC_CENTRE = { ...SANS_CENTRE, prenom: 'Marie', nom: 'Arnaud', role: 'GESTIONNAIRE',
  organisme: { id: 3, raison_sociale: 'HiTech Formation' } }
const reponse = (status, corps) => ({ ok: status < 400, status, json: async () => corps })

const INTROUVABLE = reponse(404, { code: 'ENTREPRISE_INTROUVABLE' })
const TROUVEE = reponse(200, { siret: '12345678900012', raison_sociale: 'HITECH FORMATION', adresse: '12 RUE DES LILAS 75011 PARIS' })

// Faux serveur : GET /auth/moi -> `compte` ; POST /organisme/ -> `enregistrement` ; GET /entreprises/<siret>/ ->
// `entreprise` (réponse, erreur réseau ou fonction du SIRET) ; le reste : listes vides
function serveur({ compte = SANS_CENTRE, enregistrement = reponse(201, AVEC_CENTRE), entreprise = INTROUVABLE } = {}) {
  let actuel = compte
  const fetch = vi.fn(async (url, options) => {
    if (url.endsWith('/auth/moi')) return actuel ? reponse(200, actuel) : reponse(401, { code: 'NON_CONNECTE' })
    const siret = url.match(/\/entreprises\/(\d+)\/$/)?.[1]
    if (siret) {
      if (entreprise instanceof Error) throw entreprise
      return typeof entreprise === 'function' ? entreprise(siret) : entreprise
    }
    if (url.endsWith('/organisme/')) {
      if (enregistrement instanceof Error) throw enregistrement
      // 201 : le centre vient d'être créé ; 409 : le compte en avait déjà un (ex. enregistré depuis un autre onglet)
      if (enregistrement.ok || enregistrement.status === 409) actuel = AVEC_CENTRE
      return enregistrement
    }
    if (url.endsWith('/auth/logout') && options?.method === 'POST') { actuel = null; return { ok: true, status: 204 } }
    return reponse(200, [])
  })
  vi.stubGlobal('fetch', fetch)
  return fetch
}

function afficher(adresse = '/premiere-connexion', state) {
  const router = createMemoryRouter(routes, { initialEntries: [{ pathname: adresse, state }] })
  render(<RouterProvider router={router} />)
  return router
}
const champ = (libelle) => screen.getByLabelText(new RegExp(`^${libelle}`))
const saisir = (libelle, valeur) => fireEvent.change(champ(libelle), { target: { value: valeur } })
const remplirObligatoires = () => {
  saisir('SIRET', '12345678900012')
  saisir('Raison sociale', 'HiTech Formation')
  saisir('Adresse', '12 rue des Lilas, 75011 Paris')
  saisir('Prénom', 'Marie')
  saisir('Nom', 'Arnaud')
}
const enregistrer = () => fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

describe('Formulaire « Première connexion »', () => {
  it('CA1 : après la création du compte, bandeau « Votre compte a été créé. » et e-mail pré-rempli, grisé', async () => {
    serveur()
    afficher('/premiere-connexion', { message: 'Votre compte a été créé.' })
    expect(await screen.findByRole('heading', { level: 1, name: 'Bienvenue ! Présentez-nous votre centre' })).toBeTruthy()
    expect(screen.getByRole('status').textContent).toBe('Votre compte a été créé.')
    const email = screen.getByLabelText(/^E-mail$/)
    expect(email.value).toBe(EMAIL)
    expect(email.readOnly).toBe(true)
    // Pas de menu : seuls l'e-mail du compte et « Se déconnecter » en haut
    expect(screen.queryByRole('navigation', { name: 'Menu principal' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Se déconnecter' })).toBeTruthy()
    // Les 2 blocs de la maquette, SIRET en premier ; pas de zone logo (US dédiée)
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Identité du centre', 'Gestionnaire'])
    expect(screen.getAllByRole('textbox').map((c) => c.labels[0].textContent.replace(' *', ''))).toEqual([
      'SIRET', 'Raison sociale', 'Adresse', 'N° de déclaration d’activité', 'Région du NDA', 'Ville de signature',
      'Prénom', 'Nom', 'E-mail'])
    expect(screen.getByText('Saisissez votre SIRET : nous remplissons les informations pour vous.')).toBeTruthy()
    // Retirés du formulaire : représentant, contacts, conditions de vente
    for (const retire of [/Représentant/, /E-mail de contact/, /Téléphone/, /Référent handicap/, /Régime de TVA/]) {
      expect(screen.queryByLabelText(retire)).toBeNull()
    }
    expect(screen.queryByText(/logo/i)).toBeNull()
  })

  it('à une reconnexion (sans création de compte), pas de bandeau « Votre compte a été créé. »', async () => {
    serveur()
    afficher()
    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByText('Votre compte a été créé.')).toBeNull()
    expect(screen.getByText(/Cette étape est obligatoire/)).toBeTruthy()
  })

  it('CA2 : centre non enregistré, toute autre page ramène au formulaire', async () => {
    serveur()
    for (const adresse of ['/sessions', '/formations', '/parties-prenantes', '/tableau-de-bord']) {
      const router = afficher(adresse)
      expect(await screen.findByRole('heading', { level: 1, name: /Présentez-nous votre centre/ })).toBeTruthy()
      expect(router.state.location.pathname).toBe('/premiere-connexion')
      cleanup()
    }
  })

  it('CA5 : champs obligatoires vides et formats incorrects signalés ; rien n’est envoyé', async () => {
    const fetch = serveur()
    afficher()
    await screen.findByRole('heading', { level: 1 })
    saisir('SIRET', '123456789000')
    saisir('Adresse', '12 rue des Lilas, 75011 Paris')
    saisir('Prénom', 'Marie')
    saisir('N° de déclaration', '117565')
    enregistrer()
    expect(screen.getByRole('alert').textContent).toBe('4 champs sont à corriger. Rien n’a été enregistré.')
    expect(champ('Raison sociale').getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByText('La raison sociale est obligatoire')).toBeTruthy()
    expect(screen.getByText('Le SIRET doit contenir 14 chiffres')).toBeTruthy()
    expect(screen.getByText('Le nom est obligatoire')).toBeTruthy()
    expect(screen.getByText('Le N° de déclaration d’activité doit contenir 11 chiffres')).toBeTruthy()
    expect(fetch.mock.calls.some(([url]) => url.endsWith('/organisme/'))).toBe(false)
    // Corriger un champ retire son erreur
    saisir('Raison sociale', 'HiTech Formation')
    expect(champ('Raison sociale').getAttribute('aria-invalid')).toBeNull()
    expect(screen.getByRole('alert').textContent).toMatch(/^3 champs sont à corriger/)
  })

  it('CA6 : formulaire valide, le centre est enregistré et Sessions et planning s’affiche avec « Bienvenue sur Quali-formation ! »', async () => {
    const fetch = serveur()
    const router = afficher()
    await screen.findByRole('heading', { level: 1 })
    remplirObligatoires()
    saisir('Ville de signature', ' Paris ')
    enregistrer()
    expect(await screen.findByText('Bienvenue sur Quali-formation !')).toBeTruthy()
    expect(router.state.location.pathname).toBe('/sessions')
    const [, options] = fetch.mock.calls.find(([url]) => url.endsWith('/organisme/'))
    expect(options.method).toBe('POST')
    expect(JSON.parse(options.body)).toMatchObject({ raison_sociale: 'HiTech Formation', siret: '12345678900012',
      prenom: 'Marie', nom: 'Arnaud', ville_signature: 'Paris' })
    expect(Object.keys(JSON.parse(options.body)).sort()).toEqual(['adresse', 'nom', 'numero_declaration_activite', 'prenom',
      'raison_sociale', 'region_nda', 'siret', 'ville_signature'])
    // CA7 : bas du menu, initiales et raison sociale
    expect(await screen.findByText('HiTech Formation')).toBeTruthy()
    expect(document.querySelector('.nav-compte .avatar').textContent).toBe('MA')
  })

  it('CA5 : refus du serveur, les champs concernés sont signalés', async () => {
    serveur({ enregistrement: reponse(400, { code: 'SIRET_INVALIDE', erreurs: [{ champ: 'siret', code: 'SIRET_INVALIDE', message: 'Le SIRET doit contenir 14 chiffres' }] }) })
    afficher()
    await screen.findByRole('heading', { level: 1 })
    remplirObligatoires()
    enregistrer()
    expect((await screen.findByRole('alert')).textContent).toBe('1 champ est à corriger. Rien n’a été enregistré.')
    expect(champ('SIRET').getAttribute('aria-invalid')).toBe('true')
  })

  it('CA8 : centre déjà inscrit avec ce SIRET : message sous le champ SIRET, rien n’est enregistré', async () => {
    const message = 'Ce centre est déjà inscrit sur Quali-formation. Contactez son gestionnaire.'
    serveur({ enregistrement: reponse(400, { code: 'SIRET_DEJA_UTILISE', erreurs: [{ champ: 'siret', code: 'SIRET_DEJA_UTILISE', message }] }) })
    const r = afficher()
    await screen.findByRole('heading', { level: 1 })
    remplirObligatoires()
    enregistrer()
    expect((await screen.findByRole('alert')).textContent).toBe('1 champ est à corriger. Rien n’a été enregistré.')
    expect(champ('SIRET').getAttribute('aria-invalid')).toBe('true')
    expect(document.getElementById(champ('SIRET').getAttribute('aria-describedby')).textContent).toBe(message)
    expect(r.state.location.pathname).toBe('/premiere-connexion')
  })

  it('serveur indisponible ou autre refus : message général, on reste sur le formulaire', async () => {
    serveur({ enregistrement: new TypeError('réseau') })
    const router = afficher()
    await screen.findByRole('heading', { level: 1 })
    remplirObligatoires()
    enregistrer()
    expect((await screen.findByRole('alert')).textContent).toBe('Le serveur ne répond pas : réessayez dans un instant.')
    expect(router.state.location.pathname).toBe('/premiere-connexion')
    cleanup()
    serveur({ enregistrement: reponse(500, { detail: 'Erreur du serveur.' }) })
    afficher()
    await screen.findByRole('heading', { level: 1 })
    remplirObligatoires()
    enregistrer()
    expect((await screen.findByRole('alert')).textContent).toBe('Erreur du serveur.')
  })

  it('CA6 : centre déjà enregistré pour ce compte (ex. depuis un autre onglet) : Sessions et planning, pas de bandeau rouge', async () => {
    serveur({ enregistrement: reponse(409, { code: 'ORGANISME_DEJA_RENSEIGNE', detail: 'Les informations de votre centre sont déjà enregistrées.' }) })
    const router = afficher()
    await screen.findByRole('heading', { level: 1 })
    remplirObligatoires()
    enregistrer()
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/sessions'))
    expect(screen.queryByText('Les informations de votre centre sont déjà enregistrées.')).toBeNull()
  })

  it('un seul bouton « Enregistrer », en bas du formulaire', async () => {
    serveur()
    afficher()
    await screen.findByRole('heading', { level: 1 })
    const boutons = screen.getAllByRole('button', { name: /Enregistrer/ })
    expect(boutons.map((b) => b.textContent)).toEqual(['Enregistrer'])
    expect(boutons[0].closest('.pc-pied')).toBeTruthy()
  })

  it('CA6 : centre déjà enregistré, le formulaire ne s’affiche plus', async () => {
    serveur({ compte: AVEC_CENTRE })
    const router = afficher()
    expect(await screen.findByRole('heading', { level: 1, name: 'Sessions' })).toBeTruthy()
    expect(router.state.location.pathname).toBe('/sessions')
  })

  it('personne n’est connecté : page de connexion', async () => {
    serveur({ compte: null })
    const router = afficher()
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/se-connecter'))
  })

  it('« Se déconnecter » ramène à la page de connexion ; message si le serveur ne répond pas', async () => {
    const fetch = serveur()
    const router = afficher()
    await screen.findByRole('heading', { level: 1 })
    fireEvent.click(screen.getByRole('button', { name: 'Se déconnecter' }))
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/se-connecter'))
    cleanup()
    fetch.mockImplementation(async (url) => {
      if (url.endsWith('/auth/logout')) throw new TypeError('réseau')
      return reponse(200, SANS_CENTRE)
    })
    afficher()
    await screen.findByRole('heading', { level: 1 })
    fireEvent.click(screen.getByRole('button', { name: 'Se déconnecter' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/Le serveur ne répond pas/)
  })
})

describe('Recherche par SIRET', () => {
  const messageSiret = () => document.getElementById('pc-siret-info')

  it('CA3 : SIRET connu, la raison sociale et l’adresse se remplissent, sans message ; les champs restent modifiables', async () => {
    const fetch = serveur({ entreprise: TROUVEE })
    afficher()
    await screen.findByRole('heading', { level: 1 })
    saisir('SIRET', '1234567890001') // 13 chiffres : pas de recherche
    expect(fetch.mock.calls.some(([url]) => url.includes('/entreprises/'))).toBe(false)
    saisir('SIRET', '123 456 789 00012')
    expect(await screen.findByDisplayValue('HITECH FORMATION')).toBeTruthy()
    expect(messageSiret()).toBeNull() // pas de message vert
    expect(screen.getByText('Saisissez votre SIRET : nous remplissons les informations pour vous.')).toBeTruthy()
    expect(fetch.mock.calls.find(([url]) => url.includes('/entreprises/'))[0]).toMatch(/\/entreprises\/12345678900012\/$/)
    expect(champ('Raison sociale').value).toBe('HITECH FORMATION')
    expect(champ('Adresse').value).toBe('12 RUE DES LILAS 75011 PARIS')
    // NDA et région : non fournis par l'API, saisie manuelle
    expect(champ('N° de déclaration').value).toBe('')
    expect(champ('Région du NDA').value).toBe('')
    saisir('Raison sociale', 'HiTech Formation')
    expect(champ('Raison sociale').value).toBe('HiTech Formation')
    // SIRET modifié : rien n'est effacé
    saisir('SIRET', '1234567890001')
    expect(champ('Raison sociale').value).toBe('HiTech Formation')
  })

  it('CA3 : le pré-remplissage efface les erreurs des champs trouvés', async () => {
    serveur({ entreprise: TROUVEE })
    afficher()
    await screen.findByRole('heading', { level: 1 })
    enregistrer()
    expect(screen.getByText('La raison sociale est obligatoire')).toBeTruthy()
    saisir('SIRET', '12345678900012')
    await screen.findByDisplayValue('HITECH FORMATION')
    expect(screen.queryByText('La raison sociale est obligatoire')).toBeNull()
    expect(screen.queryByText('L’adresse est obligatoire')).toBeNull()
    expect(screen.getByText('Le prénom est obligatoire')).toBeTruthy()
  })

  it('CA4 : SIRET introuvable ou service indisponible, message orange et saisie manuelle', async () => {
    for (const entreprise of [INTROUVABLE, reponse(503, { code: 'SERVICE_INDISPONIBLE' }), new TypeError('réseau')]) {
      serveur({ entreprise })
      afficher()
      await screen.findByRole('heading', { level: 1 })
      saisir('Raison sociale', 'Ma raison sociale')
      saisir('SIRET', '12345678900012')
      const message = await screen.findByText('Aucune information trouvée, renseignez les champs ci-dessous.')
      expect(message.closest('.pc-siret-ko')).toBeTruthy()
      expect(champ('Raison sociale').value).toBe('Ma raison sociale') // rien n'est effacé
      saisir('Adresse', '12 rue des Lilas, 75011 Paris')
      expect(champ('Adresse').value).toBe('12 rue des Lilas, 75011 Paris')
      cleanup()
    }
  })

  it('CA4 : on peut enregistrer sans que la recherche aboutisse', async () => {
    serveur({ entreprise: new TypeError('réseau') })
    const router = afficher()
    await screen.findByRole('heading', { level: 1 })
    remplirObligatoires()
    await screen.findByText('Aucune information trouvée, renseignez les champs ci-dessous.')
    enregistrer()
    expect(await screen.findByText('Bienvenue sur Quali-formation !')).toBeTruthy()
    expect(router.state.location.pathname).toBe('/sessions')
  })

  it('seule la réponse du dernier SIRET saisi compte', async () => {
    let repondreAncien
    serveur({ entreprise: (siret) => (siret === '11111111111111' ? new Promise((r) => { repondreAncien = r }) : INTROUVABLE) })
    afficher()
    await screen.findByRole('heading', { level: 1 })
    saisir('SIRET', '11111111111111')
    saisir('SIRET', '12345678900012')
    await screen.findByText('Aucune information trouvée, renseignez les champs ci-dessous.')
    repondreAncien(TROUVEE) // réponse tardive de l'ancien SIRET : ignorée
    await new Promise((r) => setTimeout(r, 0))
    expect(champ('Raison sociale').value).toBe('')
    expect(screen.getByText('Aucune information trouvée, renseignez les champs ci-dessous.')).toBeTruthy()
  })

  it('le même SIRET n’est recherché qu’une fois', async () => {
    const fetch = serveur()
    afficher()
    await screen.findByRole('heading', { level: 1 })
    saisir('SIRET', '12345678900012')
    saisir('SIRET', '123 456 789 00012')
    await screen.findByText('Aucune information trouvée, renseignez les champs ci-dessous.')
    expect(fetch.mock.calls.filter(([url]) => url.includes('/entreprises/'))).toHaveLength(1)
  })
})

describe('Règles du formulaire', () => {
  const valide = { ...VIDE, raison_sociale: 'HiTech', siret: '123 456 789 00012', adresse: 'Paris', prenom: 'Marie', nom: 'Arnaud' }

  it('formulaire valide (espaces acceptés dans le SIRET)', () => {
    expect(verifierCentre(valide)).toEqual({})
    expect(verifierCentre({ ...valide, numero_declaration_activite: '117 565 432 10' })).toEqual({})
  })

  it('SIRET vide : obligatoire (pas le message de format)', () => {
    expect(verifierCentre({ ...valide, siret: ' ' })).toEqual({ siret: 'Le SIRET est obligatoire' })
  })

  it('initiales : prénom et nom, sinon tirées de l’e-mail', () => {
    expect(initialesCompte({ prenom: 'marie', nom: 'arnaud', email: EMAIL })).toBe('MA')
    expect(initialesCompte({ prenom: '', nom: '', email: 'jean.dupont@x.fr' })).toBe('JD')
  })
})

describe('Connexion', () => {
  it('centre pas encore enregistré : la connexion ouvre le formulaire « Première connexion »', async () => {
    const fetch = serveur()
    fetch.mockImplementation(async (url) => {
      if (url.endsWith('/auth/login')) return reponse(200, SANS_CENTRE)
      if (url.endsWith('/auth/moi')) return reponse(200, SANS_CENTRE)
      return reponse(200, [])
    })
    const router = afficher('/se-connecter')
    const popup = within(await screen.findByRole('dialog'))
    fireEvent.change(popup.getByLabelText('Adresse e-mail'), { target: { value: EMAIL } })
    fireEvent.change(popup.getByLabelText('Mot de passe'), { target: { value: 'Secret1!' } })
    fireEvent.click(popup.getByRole('button', { name: 'Se connecter' }))
    expect(await screen.findByRole('heading', { level: 1, name: /Présentez-nous votre centre/ })).toBeTruthy()
    expect(router.state.location.pathname).toBe('/premiere-connexion')
  })
})
