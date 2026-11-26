import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../App'
import {
  classeBulle, libelleStatut, MSG_STATUT, MSG_TELEPHONE, telephoneFr, texteSessions, verifierApprenant,
} from '../apprenants/apprenants'
import { installerFauxBackend, repondre } from '../sessions/fauxBackend'

// SCRUM-209 : page « Parties prenantes » ouverte depuis le menu latéral ; onglets et apprenants : SCRUM-112
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers() })

function afficher() {
  const router = createMemoryRouter(routes, { initialEntries: ['/parties-prenantes'] })
  render(<RouterProvider router={router} />)
  return router
}
const liste = (nom) => screen.findByRole('list', { name: nom })
const lignes = async () => within(await liste('Apprenants')).getAllByRole('listitem')
const saisir = (label, valeur) => fireEvent.change(screen.getByLabelText(new RegExp(`^${label}`)), { target: { value: valeur } })
const onglet = (nom) => screen.getByRole('tab', { name: new RegExp(`^${nom}`) })
const rechercher = (texte) => fireEvent.change(screen.getByRole('searchbox', { name: 'Rechercher un apprenant' }), { target: { value: texte } })
const panneau = () => screen.queryByRole('dialog', { name: 'Nouvel apprenant' })
const posts = (fetch) => fetch.mock.calls.filter(([url, o]) => url.endsWith('/apprenants/') && o?.method === 'POST')

describe('Parties prenantes — onglets (SCRUM-112 CA1)', () => {
  it('l’onglet Apprenants est ouvert, avec les trois onglets et le nombre d’apprenants ; l’entrée du menu est mise en évidence', async () => {
    installerFauxBackend()
    afficher()
    expect(screen.getByRole('heading', { level: 1, name: 'Parties prenantes' })).toBeTruthy()
    expect(screen.getByText('Les apprenants, formateurs et entreprises clientes de votre organisme.')).toBeTruthy()
    await lignes()
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Apprenants4', 'Formateurs', 'Entreprises clientes'])
    expect(onglet('Apprenants').getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Apprenants · 4')
    expect(screen.getByRole('link', { name: 'Parties prenantes' }).getAttribute('aria-current')).toBe('page')
  })

  // Onglet Formateurs : FormateursOnglet.test.jsx (SCRUM-119)

  // Onglet Entreprises clientes : EntreprisesOnglet.test.jsx (SCRUM-120)
})

describe('Liste des apprenants (SCRUM-112)', () => {
  it('CA2 : une ligne par apprenant avec toutes ses informations, « — » si une information est vide', async () => {
    installerFauxBackend()
    afficher()
    const [camille, hugo, lea, yanis] = await lignes()
    expect(camille.textContent).toBe('CMCamille Martincamille.martin@acme.fr07 45 21 36 98SalariéAcmeCheffe de projet2 sessions')
    expect(hugo.textContent).toBe('HBHugo Bernardhugo.bernard@acme.fr——Acme—1 session')
    expect(lea.textContent).toBe('LMLéa Moreaulea.moreau@gmail.com—Demandeur d’emploi—0 session')
    expect(yanis.textContent).toBe('YPYanis Petityanis.petit@marine.fr06 12 34 56 78ParticulierGlobex—1 session')
    // Statut dans une pastille verte, bulle d'initiales en couleur
    expect(within(camille).getByText('Salarié').className).toBe('app-pastille app-pastille-verte')
    expect(camille.querySelector('.bulle').className).toBe('bulle bulle-1')
  })

  it('CA3 : la recherche ne garde que les apprenants dont le nom, l’e-mail ou l’entreprise contient le texte', async () => {
    const fetch = installerFauxBackend()
    afficher()
    await lignes()
    rechercher('acme')
    await waitFor(async () => expect((await lignes()).map((l) => l.querySelector('b').textContent)).toEqual(['Camille Martin', 'Hugo Bernard']))
    expect(fetch.mock.calls.some(([url]) => url.endsWith('/apprenants/?recherche=acme'))).toBe(true)
    // La carte et l'onglet gardent le nombre total d'apprenants pendant la recherche (comme Formateurs et Entreprises)
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Apprenants · 4')
    expect(onglet('Apprenants').textContent).toBe('Apprenants4')
    rechercher('inconnu')
    expect(await screen.findByText('Aucun apprenant ne correspond à votre recherche.')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Apprenants · 4')
    rechercher('')
    expect(await lignes()).toHaveLength(4)
  })

  it('CA3 : seule la dernière recherche s’affiche, même si une réponse précédente arrive après', async () => {
    let reponseLente
    const fetch = vi.fn((url) => {
      if (url.includes('recherche=lent')) return new Promise((r) => { reponseLente = r })
      if (url.includes('recherche=')) return Promise.resolve(repondre(200, []))
      return Promise.resolve(url.endsWith('/auth/moi') ? repondre(401, {}) : repondre(200, []))
    })
    vi.stubGlobal('fetch', fetch)
    afficher()
    await screen.findByText('Aucun apprenant pour le moment')
    rechercher('lent')
    await waitFor(() => expect(reponseLente).toBeDefined())
    rechercher('rapide')
    await waitFor(() => expect(fetch.mock.calls.some(([url]) => url.includes('recherche=rapide'))).toBe(true))
    await act(async () => reponseLente(repondre(200, [{ id: 9, prenom: 'Lent', nom: 'X', email: 'x@x.fr', telephone: '', statut: '', entreprise: '', poste: '', nombre_sessions: 0 }])))
    expect(screen.queryByText('Lent X')).toBeNull()
  })

  it('CA4 : aucun apprenant, un message invite à en ajouter un', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => (url.endsWith('/auth/moi') ? repondre(401, {}) : repondre(200, []))))
    afficher()
    expect(await screen.findByRole('heading', { name: 'Aucun apprenant pour le moment' })).toBeTruthy()
    expect(screen.getByText('Ajoutez votre premier apprenant avec « + Nouvel apprenant ».')).toBeTruthy()
    expect(onglet('Apprenants').textContent).toBe('Apprenants0')
  })

  it('le chargement échoue : message d’erreur', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => repondre(401, { code: 'NON_CONNECTE', message: 'Vous n’êtes pas connecté.' })))
    afficher()
    expect((await screen.findByRole('alert')).textContent).toContain('Se connecter')
  })
})

describe('Fenêtre « Nouvel apprenant » (SCRUM-112)', () => {
  async function ouvrir(options) {
    const fetch = installerFauxBackend(options)
    afficher()
    await lignes()
    fireEvent.click(screen.getByRole('button', { name: '+ Nouvel apprenant' }))
    return fetch
  }
  const remplirIdentite = () => {
    saisir('Prénom', 'Sophie')
    saisir('Nom', 'Lambert')
    saisir('E-mail', 'sophie.lambert@exemple.fr')
  }

  it('trois sections : Identité, Contact, Situation', async () => {
    await ouvrir()
    const p = within(panneau())
    expect(p.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Identité', 'Contact', 'Situation'])
    expect(p.getByText('Les champs marqués d’un astérisque sont obligatoires.')).toBeTruthy()
    expect(screen.getByLabelText(/^Téléphone/).getAttribute('placeholder')).toBe('Ex. : 06 12 34 56 78')
    expect(p.getByText('Facultatif · 10 chiffres')).toBeTruthy()
    expect(within(screen.getByLabelText(/^Statut/)).getAllByRole('option').map((o) => o.textContent))
      .toEqual(['Choisir un statut', 'Salarié', 'Demandeur d’emploi', 'Indépendant', 'Particulier'])
  })

  it('CA5 : sans statut ou avec un téléphone qui n’a pas 10 chiffres, rien n’est enregistré et le champ est signalé', async () => {
    const fetch = await ouvrir()
    remplirIdentite()
    saisir('Téléphone', '06 11 22 33 4')
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(document.getElementById('app-telephone-err').textContent).toBe('Le téléphone doit contenir 10 chiffres')
    expect(document.getElementById('app-statut-err').textContent).toBe('Le statut est obligatoire')
    expect(screen.getByLabelText(/^Statut/).getAttribute('aria-invalid')).toBe('true')
    expect(screen.queryByText('Facultatif · 10 chiffres')).toBeNull() // le message remplace l'aide
    expect(posts(fetch)).toHaveLength(0)
    expect(panneau()).toBeTruthy()
  })

  it('CA6 : Entreprise et Poste n’apparaissent que pour le statut « Salarié »', async () => {
    await ouvrir()
    const statut = screen.getByLabelText(/^Statut/)
    expect(screen.queryByLabelText(/^Entreprise/)).toBeNull()
    fireEvent.change(statut, { target: { value: 'SALARIE' } })
    const entreprise = await screen.findByLabelText(/^Entreprise/)
    await waitFor(() => expect(within(entreprise).getAllByRole('option').map((o) => o.textContent))
      .toEqual(['Choisir une entreprise', 'Globex', 'Société Durand']))
    expect(screen.getByLabelText(/^Poste/).getAttribute('placeholder')).toBe('Ex. : Assistante RH')
    expect(screen.getByText('Facultatif · parmi vos entreprises clientes')).toBeTruthy()
    for (const autre of ['DEMANDEUR_EMPLOI', 'INDEPENDANT', 'PARTICULIER']) {
      fireEvent.change(statut, { target: { value: autre } })
      expect(screen.queryByLabelText(/^Entreprise/)).toBeNull()
      expect(screen.queryByLabelText(/^Poste/)).toBeNull()
    }
  })

  it('CA6 : aucune entreprise cliente, la liste « Entreprise » est vide', async () => {
    await ouvrir({ entreprises: [] })
    fireEvent.change(screen.getByLabelText(/^Statut/), { target: { value: 'SALARIE' } })
    expect(within(screen.getByLabelText(/^Entreprise/)).getAllByRole('option').map((o) => o.textContent)).toEqual(['Choisir une entreprise'])
  })

  it('CA7 : l’apprenant ajouté apparaît en tête de liste, mis en évidence, sans bandeau', async () => {
    const fetch = await ouvrir()
    remplirIdentite()
    saisir('Téléphone', '06 11 22 33 44')
    fireEvent.change(screen.getByLabelText(/^Statut/), { target: { value: 'SALARIE' } })
    await waitFor(() => expect(within(screen.getByLabelText(/^Entreprise/)).getAllByRole('option')).toHaveLength(3))
    fireEvent.change(screen.getByLabelText(/^Entreprise/), { target: { value: '7' } })
    saisir('Poste', ' Assistante RH ')
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(panneau()).toBeNull())
    expect(JSON.parse(posts(fetch)[0][1].body)).toEqual({
      prenom: 'Sophie', nom: 'Lambert', email: 'sophie.lambert@exemple.fr', telephone: '06 11 22 33 44',
      statut: 'SALARIE', entreprise_id: 7, poste: 'Assistante RH',
    })
    await waitFor(() => expect(onglet('Apprenants').textContent).toBe('Apprenants5'))
    const [premiere, deuxieme] = await lignes()
    expect(premiere.textContent).toBe('SLSophie Lambertsophie.lambert@exemple.fr06 11 22 33 44SalariéSociété DurandAssistante RH0 session')
    expect(premiere.className).toContain('app-ligne-nouvelle')
    expect(premiere.getAttribute('aria-current')).toBe('true')
    expect(deuxieme.className).not.toContain('app-ligne-nouvelle')
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('CA7 : ajouté pendant une recherche, la recherche est vidée pour le montrer', async () => {
    await ouvrir()
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    rechercher('globex')
    await waitFor(async () => expect(await lignes()).toHaveLength(1))
    fireEvent.click(screen.getByRole('button', { name: '+ Nouvel apprenant' }))
    remplirIdentite()
    fireEvent.change(screen.getByLabelText(/^Statut/), { target: { value: 'INDEPENDANT' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(async () => expect(await lignes()).toHaveLength(5))
    expect(screen.getByRole('searchbox', { name: 'Rechercher un apprenant' }).value).toBe('')
    expect((await lignes())[0].textContent).toContain('Sophie Lambert')
  })

  it('erreurs du serveur : sous le champ, ou en encadré si aucun champ n’est concerné', async () => {
    let reponse = repondre(400, { telephone: ['Le téléphone doit contenir 10 chiffres'] })
    await ouvrir({ reponsePersonne: () => reponse })
    remplirIdentite()
    fireEvent.change(screen.getByLabelText(/^Statut/), { target: { value: 'PARTICULIER' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(document.getElementById('app-telephone-err').textContent).toBe('Le téléphone doit contenir 10 chiffres'))
    reponse = repondre(400, { code: 'ENTREPRISE_INTROUVABLE', detail: 'Cette entreprise n’existe pas parmi vos entreprises clientes.' })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(within(panneau()).getByRole('alert').textContent).toBe('Cette entreprise n’existe pas parmi vos entreprises clientes.'))
  })

  it('la liste des entreprises ne se charge pas : la fenêtre reste utilisable', async () => {
    const fetch = installerFauxBackend()
    const normal = fetch.getMockImplementation()
    fetch.mockImplementation((url, o) => (url.endsWith('/entreprises/') ? Promise.reject(new Error('panne')) : normal(url, o)))
    afficher()
    await lignes()
    fireEvent.click(screen.getByRole('button', { name: '+ Nouvel apprenant' }))
    fireEvent.change(screen.getByLabelText(/^Statut/), { target: { value: 'SALARIE' } })
    await waitFor(() => expect(within(screen.getByLabelText(/^Entreprise/)).getAllByRole('option')).toHaveLength(1))
  })
})

describe('règles des apprenants (SCRUM-112)', () => {
  const apprenant = { prenom: 'S', nom: 'L', email: 's@l.fr', telephone: '', statut: 'PARTICULIER' }

  it('statut obligatoire, téléphone facultatif de 10 chiffres (espaces, points et tirets acceptés)', () => {
    expect(verifierApprenant(apprenant)).toEqual({})
    expect(verifierApprenant({ ...apprenant, statut: '' })).toEqual({ statut: MSG_STATUT })
    for (const ok of ['0611223344', '06 11 22 33 44', '06.11.22.33.44', '06-11-22-33-44']) {
      expect(verifierApprenant({ ...apprenant, telephone: ok }), ok).toEqual({})
    }
    for (const ko of ['061122334', '06112233445', '06 11 22 33 4A']) {
      expect(verifierApprenant({ ...apprenant, telephone: ko }), ko).toEqual({ telephone: MSG_TELEPHONE })
    }
  })

  it('affichage : téléphone, statut, sessions, bulle', () => {
    expect(telephoneFr('0611223344')).toBe('06 11 22 33 44')
    expect(telephoneFr('')).toBe('')
    expect([libelleStatut('INDEPENDANT'), libelleStatut('')]).toEqual(['Indépendant', ''])
    expect([0, 1, 2].map(texteSessions)).toEqual(['0 session', '1 session', '2 sessions'])
    expect([classeBulle(6), classeBulle(11)]).toEqual(['bulle bulle-0', 'bulle bulle-5'])
  })
})
