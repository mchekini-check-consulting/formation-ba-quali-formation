import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../App'
import { REGLES_MOT_DE_PASSE, verifier } from '../compte/regles'

// SCRUM-15 « Créer un compte » : règles RG-CC-01 à RG-CC-10 et critères d'acceptation
// (docs/SCRUM-15-regles-de-gestion.md)

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

const afficher = (depart = '/creer-un-compte') => {
  const router = createMemoryRouter(routes, { initialEntries: [depart] })
  render(<RouterProvider router={router} />)
  return router
}

const champ = (libelle) => screen.getByLabelText(libelle)
const bouton = () => screen.getByRole('button', { name: /Créer mon compte|Création en cours/ })

function saisir({ email = 'nouveau@organisme.fr', motDePasse = MOT_DE_PASSE, confirmation = motDePasse, cgu = true } = {}) {
  fireEvent.change(champ('Adresse e-mail'), { target: { value: email } })
  fireEvent.change(champ('Mot de passe'), { target: { value: motDePasse } })
  fireEvent.change(champ('Confirmer le mot de passe'), { target: { value: confirmation } })
  if (cgu) fireEvent.click(screen.getByRole('checkbox'))
}

function valider(donnees) {
  saisir(donnees)
  fireEvent.click(bouton())
}

const regle = (libelle) => screen.getByText(libelle).closest('li').dataset.ok

describe('Créer un compte : page de la maquette', () => {
  it('reprend les textes de la maquette, dans son ordre (RG-CC-08)', () => {
    afficher()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Créer votre compte')
    expect(screen.getByText("Pour le responsable de l'organisme de formation.")).toBeTruthy()
    expect(screen.getByText(/15 jours d'essai gratuit · sans carte bancaire/)).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Créez votre compte et démarrez votre essai' })).toBeTruthy()
    expect(screen.getByText(/Programmes, sessions, documents, émargement/)).toBeTruthy()
    for (const a of ['Utilisateurs illimités', 'Sans frais de mise en service', 'Sans engagement']) expect(screen.getByText(a)).toBeTruthy()
    expect(screen.getByText('Déjà un compte ?')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Se connecter' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'CGU / CGV' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'politique de confidentialité' })).toBeTruthy()
    expect(screen.getByText(/conformément au RGPD/)).toBeTruthy()
    expect(champ('Adresse e-mail').getAttribute('placeholder')).toBe('vous@organisme.fr')
    const libelles = [...document.querySelectorAll('.cpt-form label')].map((l) => l.textContent)
    expect(libelles.slice(0, 3)).toEqual(['Adresse e-mail', 'Mot de passe', 'Confirmer le mot de passe'])
    expect(libelles[3]).toMatch(/^J'accepte les CGU/)
  })

  it('le logo ramène à la landing page', () => {
    const router = afficher()
    fireEvent.click(screen.getByRole('link', { name: 'Quali-formation' }))
    expect(router.state.location.pathname).toBe('/')
  })

  it('le bouton œil affiche puis masque le mot de passe', () => {
    afficher()
    expect(champ('Mot de passe').type).toBe('password')
    fireEvent.click(screen.getByRole('button', { name: 'Afficher le mot de passe' }))
    expect(champ('Mot de passe').type).toBe('text')
    fireEvent.click(screen.getByRole('button', { name: 'Masquer le mot de passe' }))
    expect(champ('Mot de passe').type).toBe('password')
  })
})

describe('Créer un compte : règles de gestion', () => {
  // RG-CC-01
  it('e-mail obligatoire : message sous le champ, rien n’est envoyé', () => {
    afficher()
    valider({ email: '' })
    expect(screen.getByText("L'adresse e-mail est obligatoire.").id).toBe('erreur-email')
    expect(champ('Adresse e-mail').getAttribute('aria-invalid')).toBe('true')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('e-mail au mauvais format (jeu « E-mail invalide ») : message sous le champ', () => {
    afficher()
    valider({ email: 'nouveau@' })
    expect(screen.getByText(/n'est pas au bon format/).id).toBe('erreur-email')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  // RG-CC-03, RG-CC-04
  it('les 5 critères du mot de passe se cochent en direct', () => {
    afficher()
    for (const r of REGLES_MOT_DE_PASSE) expect(regle(r.libelle)).toBe('false')
    fireEvent.change(champ('Mot de passe'), { target: { value: 'a' } })
    expect(regle('Une minuscule')).toBe('true')
    expect(regle('Une majuscule')).toBe('false')
    fireEvent.change(champ('Mot de passe'), { target: { value: MOT_DE_PASSE } })
    for (const r of REGLES_MOT_DE_PASSE) expect(regle(r.libelle)).toBe('true')
  })

  it.each([
    ['Trop court', 'Se#1', '8 caractères minimum'],
    ['Sans majuscule', 'secret#2026', 'une majuscule'],
    ['Sans caractère spécial', 'Secret2026', 'un caractère spécial'],
  ])('mot de passe non conforme (jeu « %s ») : le critère manquant est indiqué (critère 3)', (_cas, mot, manque) => {
    afficher()
    valider({ motDePasse: mot })
    const erreur = screen.getByText(/Le mot de passe doit contenir/)
    expect(erreur.id).toBe('erreur-motDePasse')
    expect(erreur.textContent).toContain(manque)
    expect(champ('Mot de passe').getAttribute('aria-describedby')).toBe('erreur-motDePasse')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  // RG-CC-05
  it('confirmation différente : message sous la confirmation (critère 3)', () => {
    afficher()
    valider({ confirmation: 'Secret#2027' })
    expect(screen.getByText('La confirmation ne correspond pas au mot de passe.').id).toBe('erreur-confirmation')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  // RG-CC-06, critère 4
  it('CGU non cochées : validation impossible', () => {
    afficher()
    saisir({ cgu: false })
    expect(bouton().disabled).toBe(true)
    fireEvent.click(bouton())
    expect(fetchMock).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('checkbox'))
    expect(bouton().disabled).toBe(false)
  })

  // RG-CC-10
  it('après une erreur, l’e-mail et les CGU restent, les mots de passe sont vidés', () => {
    afficher()
    valider({ confirmation: 'Secret#2027' })
    expect(champ('Adresse e-mail').value).toBe('nouveau@organisme.fr')
    expect(screen.getByRole('checkbox').checked).toBe(true)
    expect(champ('Mot de passe').value).toBe('')
    expect(champ('Confirmer le mot de passe').value).toBe('')
  })

  it('corriger un champ efface son erreur', () => {
    afficher()
    valider({ email: '' })
    fireEvent.change(champ('Adresse e-mail'), { target: { value: 'a@b.fr' } })
    expect(screen.queryByText("L'adresse e-mail est obligatoire.")).toBeNull()
  })
})

describe('Créer un compte : critères d’acceptation avec le serveur', () => {
  // Critère 1, RG-CC-09 (page provisoire en attendant SCRUM-19)
  it('informations valides : le compte est créé et la page d’accueil provisoire s’affiche', async () => {
    repondre(201, { id: 1, email: 'nouveau@organisme.fr' })
    const router = afficher()
    valider()
    expect(await screen.findByText(/Votre compte a été créé/)).toBeTruthy()
    expect(router.state.location.pathname).toBe('/tableau-de-bord')
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/auth/register')
    expect(options.method).toBe('POST')
    expect(JSON.parse(options.body)).toEqual({
      email: 'nouveau@organisme.fr', mot_de_passe: MOT_DE_PASSE, confirmation: MOT_DE_PASSE, cgu_acceptees: true,
    })
  })

  // Critère 2, RG-CC-02
  it('e-mail déjà utilisé : le compte n’est pas créé et un message l’indique', async () => {
    repondre(409, { code: 'EMAIL_DEJA_UTILISE', champ: 'email', detail: 'Un compte existe déjà avec cet e-mail.' })
    const router = afficher()
    valider()
    expect((await screen.findByText('Un compte existe déjà avec cet e-mail.')).id).toBe('erreur-email')
    expect(champ('Adresse e-mail').getAttribute('aria-invalid')).toBe('true')
    expect(champ('Adresse e-mail').value).toBe('nouveau@organisme.fr')
    expect(router.state.location.pathname).toBe('/creer-un-compte')
  })

  it('affiche sous le bon champ une erreur renvoyée par le serveur (400)', async () => {
    repondre(400, { code: 'EMAIL_INVALIDE', erreurs: [{ champ: 'email', code: 'EMAIL_INVALIDE', message: 'Format refusé par le serveur.' }] })
    afficher()
    valider()
    expect((await screen.findByText('Format refusé par le serveur.')).id).toBe('erreur-email')
  })

  it('400 sans détail : message général', async () => {
    repondre(400, null)
    afficher()
    valider()
    expect((await screen.findByRole('alert')).textContent).toBe('Le compte n’a pas pu être créé. Réessayez.')
  })

  it('prévient si le serveur ne répond pas', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    afficher()
    valider()
    expect((await screen.findByRole('alert')).textContent).toMatch(/Le serveur ne répond pas/)
  })
})

describe('Landing page : lien vers la création de compte', () => {
  it('« Essai gratuit » ouvre la page Créer un compte', async () => {
    const router = afficher('/')
    fireEvent.click(screen.getByRole('link', { name: 'Essai gratuit' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Créer votre compte' })).toBeTruthy()
    expect(router.state.location.pathname).toBe('/creer-un-compte')
  })
})

describe('Tableau de bord', () => {
  it('sans création de compte, pas de message de bienvenue', () => {
    afficher('/tableau-de-bord')
    expect(screen.queryByText(/Votre compte a été créé/)).toBeNull()
  })
})

describe('verifier (RG-CC-01 à RG-CC-06)', () => {
  const ok = { email: ' nouveau@organisme.fr ', motDePasse: MOT_DE_PASSE, confirmation: MOT_DE_PASSE, cgu: true }
  it('accepte des informations valides', () => expect(verifier(ok)).toEqual({}))
  it.each(['a@b', 'a@b.', 'a@.fr', '@b.fr', 'a@@b.fr', 'a b@c.fr', 'nouveau@'])('refuse l’e-mail au mauvais format « %s »', (email) => {
    expect(verifier({ ...ok, email }).email).toMatch(/bon format/)
  })
  it('refuse un mot de passe vide', () => {
    expect(verifier({ ...ok, motDePasse: '', confirmation: '' }).motDePasse).toBe('Le mot de passe est obligatoire.')
  })
  it('liste tous les critères manquants', () => {
    expect(verifier({ ...ok, motDePasse: 'abc', confirmation: 'abc' }).motDePasse)
      .toBe('Le mot de passe doit contenir : 8 caractères minimum, une majuscule, un chiffre, un caractère spécial.')
  })
  it('refuse des CGU non acceptées', () => expect(verifier({ ...ok, cgu: false }).cgu).toMatch(/accepter les CGU/))
})
