import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../App'
import { compteConnecte, IDENTIFIANTS_INCORRECTS, PAGE_D_ACCUEIL } from './serviceCompte'

// SCRUM-16 « Se connecter à mon compte » : règles RG-CX-01 à RG-CX-08, critères d'acceptation 1 à 6
// et jeux de test (docs/SCRUM-16-regles-de-gestion.md)

const EMAIL = 'recette@organisme.fr'
const MOT_DE_PASSE = 'Secret#2026'

let fetchMock
beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const repondre = (status, corps) => fetchMock.mockResolvedValueOnce({ ok: status < 400, status, json: async () => corps })

const afficher = (depart = '/se-connecter') => {
  const router = createMemoryRouter(routes, { initialEntries: [depart] })
  render(<RouterProvider router={router} />)
  return router
}

const popup = () => screen.queryByRole('dialog', { name: 'Se connecter' })
const dansPopup = () => within(popup())
const boutonConnexion = () => dansPopup().getByRole('button', { name: /Se connecter|Connexion…/ })

function seConnecter({ email = EMAIL, motDePasse = MOT_DE_PASSE } = {}) {
  fireEvent.change(dansPopup().getByLabelText('Adresse e-mail'), { target: { value: email } })
  fireEvent.change(dansPopup().getByLabelText('Mot de passe'), { target: { value: motDePasse } })
  fireEvent.click(boutonConnexion())
}

describe('Se connecter : ouverture depuis la landing page', () => {
  // RG-CX-01, critère 1 / jeu « Ouverture »
  it('le bouton « Se connecter » de la landing page ouvre le pop-up avec e-mail et mot de passe', () => {
    const router = afficher('/')
    expect(popup()).toBeNull()
    fireEvent.click(screen.getByRole('link', { name: 'Se connecter' }))
    expect(router.state.location.pathname).toBe('/se-connecter')
    expect(popup()).toBeTruthy()
    expect(dansPopup().getByLabelText('Adresse e-mail').type).toBe('email')
    expect(dansPopup().getByLabelText('Mot de passe').type).toBe('password')
  })

  it('la landing page reste affichée derrière le pop-up', () => {
    afficher()
    expect(screen.getByRole('navigation', { name: 'Navigation principale' })).toBeTruthy()
  })

  it('le lien « Se connecter » de la page « Créer un compte » ouvre aussi le pop-up', () => {
    const router = afficher('/creer-un-compte')
    fireEvent.click(screen.getByRole('link', { name: 'Se connecter' }))
    expect(router.state.location.pathname).toBe('/se-connecter')
    expect(popup()).toBeTruthy()
  })
})

describe('Se connecter : pop-up de la maquette', () => {
  // RG-CX-02
  it('reprend les textes, champs, boutons et lien de la maquette', () => {
    afficher()
    expect(dansPopup().getByRole('heading', { name: 'Se connecter' })).toBeTruthy()
    expect(dansPopup().getByText('Accédez à votre compte Quali-formation.')).toBeTruthy()
    expect(dansPopup().getByPlaceholderText('vous@organisme.fr')).toBeTruthy()
    const boutons = dansPopup().getAllByRole('button').filter((b) => !b.getAttribute('aria-label'))
    expect(boutons.map((b) => b.textContent)).toEqual(['Annuler', 'Se connecter'])
    expect(dansPopup().getByText(/Pas encore de compte \?/)).toBeTruthy()
    expect(dansPopup().getByRole('link', { name: 'Créer un compte' })).toBeTruthy()
  })

  it('le curseur est placé dans le champ e-mail', () => {
    afficher()
    expect(document.activeElement).toBe(dansPopup().getByLabelText('Adresse e-mail'))
  })

  it("le bouton œil affiche puis masque le mot de passe", () => {
    afficher()
    const champ = dansPopup().getByLabelText('Mot de passe')
    fireEvent.click(dansPopup().getByRole('button', { name: 'Afficher le mot de passe' }))
    expect(champ.type).toBe('text')
    fireEvent.click(dansPopup().getByRole('button', { name: 'Masquer le mot de passe' }))
    expect(champ.type).toBe('password')
  })
})

describe('Se connecter : critères d\'acceptation', () => {
  // RG-CX-04, RG-CX-06, critère 2 / jeu « Nominal »
  it('identifiants corrects : la page d\'accueil s\'affiche', async () => {
    repondre(200, { id: 1, email: EMAIL })
    const router = afficher()
    seConnecter()
    expect(await screen.findByText('Vous êtes connecté. Bienvenue sur Quali-formation !', {}, { timeout: 3000 })).toBeTruthy()
    expect(router.state.location.pathname).toBe(PAGE_D_ACCUEIL)
    expect(popup()).toBeNull()
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toMatch(/\/auth\/login$/)
    expect(options.method).toBe('POST')
    expect(JSON.parse(options.body)).toEqual({ email: EMAIL, mot_de_passe: MOT_DE_PASSE })
  })

  it('les espaces autour de l\'e-mail sont retirés avant l\'envoi', async () => {
    repondre(200, { id: 1, email: EMAIL })
    afficher()
    seConnecter({ email: `  ${EMAIL} ` })
    await screen.findByText(/Vous êtes connecté/, {}, { timeout: 3000 })
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).email).toBe(EMAIL)
  })

  it('le bouton est désactivé pendant l\'envoi', async () => {
    let terminer
    fetchMock.mockReturnValueOnce(new Promise((r) => { terminer = r }))
    afficher()
    seConnecter()
    expect(boutonConnexion().textContent).toBe('Connexion…')
    expect(boutonConnexion().disabled).toBe(true)
    terminer({ ok: true, status: 200, json: async () => ({ id: 1, email: EMAIL }) })
    await screen.findByText(/Vous êtes connecté/, {}, { timeout: 3000 })
  })

  // RG-CX-05, critère 3 / jeux « Mauvais mot de passe » et « E-mail inconnu »
  it.each([
    ['mauvais mot de passe', { motDePasse: 'Faux#2026' }],
    ['e-mail inconnu', { email: 'inconnu@organisme.fr' }],
  ])('%s : accès refusé avec le message unique', async (_cas, saisie) => {
    repondre(401, { code: 'IDENTIFIANTS_INVALIDES', detail: IDENTIFIANTS_INCORRECTS })
    const router = afficher()
    seConnecter(saisie)
    expect((await screen.findByRole('alert')).textContent).toBe('E-mail ou mot de passe incorrect')
    expect(router.state.location.pathname).toBe('/se-connecter')
    // Aucun champ n'est désigné comme faux
    expect(dansPopup().getByLabelText('Adresse e-mail').getAttribute('aria-invalid')).toBeNull()
    expect(dansPopup().getByLabelText('Mot de passe').getAttribute('aria-invalid')).toBeNull()
    expect(boutonConnexion().disabled).toBe(false)
  })

  it('le message disparaît dès qu\'on corrige la saisie', async () => {
    repondre(401, { code: 'IDENTIFIANTS_INVALIDES', detail: IDENTIFIANTS_INCORRECTS })
    afficher()
    seConnecter({ motDePasse: 'Faux#2026' })
    await screen.findByRole('alert')
    fireEvent.change(dansPopup().getByLabelText('Mot de passe'), { target: { value: MOT_DE_PASSE } })
    expect(screen.queryByRole('alert')).toBeNull()
  })

  // RG-CX-03, critère 4 / jeux « E-mail vide » et « Mot de passe vide »
  it('e-mail vide : accès refusé, le champ e-mail est signalé, rien n\'est envoyé', () => {
    afficher()
    seConnecter({ email: '   ' })
    expect(dansPopup().getByText("L'adresse e-mail est obligatoire.")).toBeTruthy()
    expect(dansPopup().getByLabelText('Adresse e-mail').getAttribute('aria-invalid')).toBe('true')
    expect(dansPopup().getByLabelText('Mot de passe').getAttribute('aria-invalid')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('mot de passe vide : accès refusé, le champ mot de passe est signalé, rien n\'est envoyé', () => {
    afficher()
    seConnecter({ motDePasse: '' })
    expect(dansPopup().getByText('Le mot de passe est obligatoire.')).toBeTruthy()
    expect(dansPopup().getByLabelText('Mot de passe').getAttribute('aria-invalid')).toBe('true')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('les deux champs vides sont signalés', () => {
    afficher()
    seConnecter({ email: '', motDePasse: '' })
    expect(dansPopup().getByText("L'adresse e-mail est obligatoire.")).toBeTruthy()
    expect(dansPopup().getByText('Le mot de passe est obligatoire.')).toBeTruthy()
  })

  it('un champ refusé par le serveur (400) est signalé sous ce champ', async () => {
    repondre(400, { code: 'EMAIL_REQUIS', champ: 'email', detail: "L'adresse e-mail est obligatoire.",
      erreurs: [{ champ: 'email', code: 'EMAIL_REQUIS', message: "L'adresse e-mail est obligatoire." }] })
    afficher()
    seConnecter()
    expect(await dansPopup().findByText("L'adresse e-mail est obligatoire.")).toBeTruthy()
  })

  // RG-CX-07, critère 5 / jeu « Annuler »
  it('« Annuler » ferme le pop-up et laisse la landing page affichée', () => {
    const router = afficher()
    fireEvent.click(dansPopup().getByRole('button', { name: 'Annuler' }))
    expect(popup()).toBeNull()
    expect(router.state.location.pathname).toBe('/')
    expect(screen.getByRole('navigation', { name: 'Navigation principale' })).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('la touche Échap ferme aussi le pop-up', () => {
    const router = afficher()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(router.state.location.pathname).toBe('/')
  })

  // RG-CX-08, critère 6 / jeu « Créer un compte »
  it('« Créer un compte » ferme le pop-up et ouvre la création de compte (SCRUM-15)', () => {
    const router = afficher()
    fireEvent.click(dansPopup().getByRole('link', { name: 'Créer un compte' }))
    expect(router.state.location.pathname).toBe('/creer-un-compte')
    expect(popup()).toBeNull()
    expect(screen.getByRole('heading', { level: 1, name: 'Créer votre compte' })).toBeTruthy()
  })
})

describe('Se connecter : connexion mémorisée (session)', () => {
  it('la connexion demande au navigateur de garder le cookie de session', async () => {
    repondre(200, { id: 1, email: EMAIL })
    afficher()
    seConnecter()
    await screen.findByText(/Vous êtes connecté/, {}, { timeout: 3000 })
    expect(fetchMock.mock.calls[0][1].credentials).toBe('include')
  })

  it('après la connexion, Sessions et planning s’affiche avec le message de bienvenue et le profil du compte (SCRUM-19 CA1)', async () => {
    // POST /auth/login et GET /auth/moi : le compte ; GET /sessions/ : aucune session
    fetchMock.mockImplementation(async (url) => (url.endsWith('/sessions/')
      ? { ok: true, status: 200, json: async () => [] }
      : { ok: true, status: 200, json: async () => ({ id: 1, email: EMAIL }) }))
    const router = afficher()
    seConnecter()
    expect(await screen.findByText('Vous êtes connecté. Bienvenue sur Quali-formation !', {}, { timeout: 3000 })).toBeTruthy()
    expect(router.state.location.pathname).toBe('/sessions')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Sessions et planning')
    expect(screen.getByRole('navigation', { name: 'Menu principal' })).toBeTruthy()
    await vi.waitFor(() => expect(document.querySelector('.avatar')?.textContent).toBe('RE'))
  })

  it('après « Se déconnecter », la page de connexion confirme la déconnexion (SCRUM-17)', async () => {
    afficher({ pathname: '/se-connecter', state: { deconnecte: true } })
    expect(within(screen.getByRole('dialog')).getByText('Vous êtes déconnecté.')).toBeTruthy()
  })

  it('le compte connecté est demandé au serveur avec le cookie de session (GET /auth/moi)', async () => {
    repondre(200, { id: 1, email: EMAIL })
    expect(await compteConnecte()).toEqual({ id: 1, email: EMAIL })
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toMatch(/\/auth\/moi$/)
    expect(options.credentials).toBe('include')
  })

  it('personne n\'est connecté : aucun compte', async () => {
    repondre(401, { code: 'NON_CONNECTE', detail: "Vous n'êtes pas connecté." })
    expect(await compteConnecte()).toBeNull()
  })

  it('serveur indisponible : aucun compte', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    expect(await compteConnecte()).toBeNull()
  })
})

describe('Se connecter : serveur indisponible', () => {
  it('le serveur ne répond pas : message général', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    afficher()
    seConnecter()
    expect((await screen.findByRole('alert')).textContent).toBe('Le serveur ne répond pas : réessayez dans un instant.')
  })

  it('autre erreur du serveur : message général', async () => {
    repondre(500, null)
    afficher()
    seConnecter()
    expect((await screen.findByRole('alert')).textContent).toBe('La connexion a échoué. Réessayez.')
  })
})
