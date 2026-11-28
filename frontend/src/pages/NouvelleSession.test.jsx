import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../App'
import { installerFauxBackend, repondre, SESSION_EXCEL } from '../sessions/fauxBackend'

// SCRUM-167 : la liste range les sessions selon la date du jour ; on la fixe au 17/11/2026 (sessions de test à venir)
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-17T10:00:00+01:00') }) })
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers() })

function afficher(adresse = '/sessions') {
  const router = createMemoryRouter(routes, { initialEntries: [adresse] })
  render(<RouterProvider router={router} />)
  return router
}
const bouton = (nom) => screen.getByRole('button', { name: nom })
const saisir = (label, valeur) => fireEvent.change(screen.getByLabelText(new RegExp(`^${label}`)), { target: { value: valeur } })
const titreEtape = () => screen.getByRole('heading', { level: 3 }).textContent
const choisirModalite = (valeur) => fireEvent.change(screen.getByLabelText(/^Modalité/), { target: { value: valeur } })
const cocher = (nom) => fireEvent.click(screen.getByRole('checkbox', { name: new RegExp(nom) }))
const nomsAffiches = (liste) => within(screen.getByRole('list', { name: liste })).getAllByRole('checkbox').map((c) => c.closest('label').querySelector('b').textContent)

async function ouvrirFormulaire() {
  const router = afficher('/sessions/nouvelle')
  await screen.findByRole('heading', { name: 'Informations' })
  return router
}
function remplirEtape1() {
  fireEvent.change(screen.getByLabelText(/^Formation/), { target: { value: '2' } })
  saisir('Date de début', '2026-11-18')
  saisir('Date de fin', '2026-11-20')
  saisir('Durée', '21')
  saisir('Nombre de places', '10')
  choisirModalite('PRESENTIEL')
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
  it('liste les sessions : dates, formation et avancement, lieu, formateur, inscrits (SCRUM-167)', async () => {
    installerFauxBackend()
    afficher()
    const ligne = (await screen.findByText('Excel avancé')).closest('tr')
    expect([...ligne.cells].map((c) => c.textContent)).toEqual(['18 – 19 nov.', 'Excel avancéDemain', 'Lyon', 'Nadia Haddad', '3 / 8'])
    expect(within(ligne).getByRole('progressbar', { name: 'Inscrits : 3 / 8' }).getAttribute('aria-valuenow')).toBe('38')
    expect(screen.getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['Dates', 'Formation', 'Lieu', 'Formateur', 'Inscrits'])
  })

  it('onglets avec leur nombre ; « Passées » : la plus récente en tête, absente de « Toutes » (SCRUM-167)', async () => {
    const s = (id, intitule, date_debut, date_fin, autres = {}) => ({
      ...SESSION_EXCEL, id, formation_intitule: intitule, date_debut, date_fin, ...autres,
    })
    installerFauxBackend({ sessions: [
      s(1, 'Excel avancé', '2026-11-18', '2026-11-19'),
      s(2, 'Accueil téléphonique', '2026-11-16', '2026-11-18', { modalite: 'DISTANCIEL', lieu: '' }),
      s(3, 'Word', '2026-11-02', '2026-11-03'),
      s(4, 'Sauveteur secouriste', '2026-11-12', '2026-11-16'),
    ] })
    afficher()
    await screen.findByText('Excel avancé')
    const onglet = (nom) => screen.getByRole('tab', { name: new RegExp(`^${nom}`) })
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Toutes2', 'En cours1', 'À venir1', 'Passées2'])
    expect(onglet('Toutes').getAttribute('aria-selected')).toBe('true')
    const formations = () => screen.getAllByRole('link', { name: /./ }).filter((l) => l.className === 'sp-formation').map((l) => l.textContent)
    expect(formations()).toEqual(['Accueil téléphonique', 'Excel avancé'])
    expect(screen.getByText('Jour 2 sur 3').className).toContain('en-cours')
    expect(screen.getByText('Distanciel')).toBeTruthy()

    fireEvent.click(onglet('Passées'))
    expect(onglet('Passées').getAttribute('aria-selected')).toBe('true')
    expect(formations()).toEqual(['Sauveteur secouriste', 'Word'])
    expect(screen.getAllByText('Terminée')).toHaveLength(2)
    fireEvent.click(onglet('En cours'))
    expect(formations()).toEqual(['Accueil téléphonique'])
  })

  it('indique quand il n’y a aucune session', async () => {
    installerFauxBackend({ sessions: [] })
    afficher()
    expect(await screen.findByText('Aucune session')).toBeTruthy()
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Toutes0', 'En cours0', 'À venir0', 'Passées0'])
  })

  it('signale un backend injoignable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('réseau') }))
    afficher()
    expect((await screen.findByRole('alert')).textContent).toContain('Le serveur ne répond pas')
  })

  it('est accessible depuis le menu', async () => {
    installerFauxBackend()
    afficher('/tableau-de-bord')
    fireEvent.click(screen.getByRole('link', { name: 'Sessions' }))
    expect(await screen.findByRole('heading', { name: 'Sessions' })).toBeTruthy()
  })
})

describe('Nouvelle session (SCRUM-25, SCRUM-166)', () => {
  it('CA1 : « Nouvelle session » ouvre l’étape 1', async () => {
    installerFauxBackend()
    const router = afficher()
    fireEvent.click(await screen.findByRole('button', { name: 'Nouvelle session' }))
    expect(await screen.findByRole('heading', { name: 'Informations' })).toBeTruthy()
    expect(screen.getByRole('dialog', { name: 'Nouvelle session' })).toBeTruthy()
    // Le panneau s'ouvre par-dessus la page Sessions et planning
    expect(screen.getByRole('heading', { level: 1, name: 'Sessions' })).toBeTruthy()
    expect(router.state.location.pathname).toBe('/sessions/nouvelle')
    expect(screen.getByRole('option', { name: 'Management d’équipe — les fondamentaux' })).toBeTruthy()
  })

  it('CA2 : un champ obligatoire vide reste sur l’étape 1 et chaque champ manquant est signalé', async () => {
    installerFauxBackend()
    await ouvrirFormulaire()
    fireEvent.click(bouton('Suivant'))
    expect(titreEtape()).toBe('Informations')
    for (const label of ['Formation', 'Date de début', 'Date de fin', 'Durée', 'Lieu', 'Nombre de places']) {
      expect(screen.getByLabelText(new RegExp(`^${label}`)).getAttribute('aria-invalid'), label).toBe('true')
    }
    // Modalité : Présentiel par défaut (maquette), donc pas en erreur
    expect(screen.getByLabelText(/^Modalité/).getAttribute('aria-invalid')).toBeNull()
    expect(screen.getAllByText('Ce champ est obligatoire.')).toHaveLength(4)
    expect(screen.getByText('Saisissez une durée supérieure à 0.')).toBeTruthy()
    expect(screen.getByText('Saisissez un nombre entier supérieur à 0.')).toBeTruthy()
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
    expect(titreEtape()).toBe('Informations')
  })

  it('les champs s’affichent vides à l’ouverture, modalité « Présentiel » (maquette)', async () => {
    installerFauxBackend()
    await ouvrirFormulaire()
    for (const label of ['Formation', 'Date de début', 'Date de fin', 'Durée', 'Lieu', 'Nombre de places']) {
      const champ = screen.getByLabelText(new RegExp(`^${label}`))
      expect(champ.value, label).toBe('')
      expect(champ.getAttribute('autocomplete'), label).toBe('off')
    }
    expect(screen.getByLabelText(/^Modalité/).value).toBe('PRESENTIEL')
    expect(screen.queryByLabelText(/^Lien de la classe virtuelle/)).toBeNull()
    expect(screen.getByRole('dialog', { name: 'Nouvelle session' }).textContent).toContain('Les champs marqués d’un astérisque sont obligatoires.')
  })

  it('CA10 : plus de champs « Heure de début » ni « Heure de fin »', async () => {
    const fetch = installerFauxBackend()
    await ouvrirFormulaire()
    expect(screen.queryByLabelText(/^Heure/)).toBeNull()
    remplirEtape1()
    fireEvent.click(bouton('Suivant'))
    cocher('Julien Lefèvre')
    fireEvent.click(bouton('Suivant'))
    cocher('Camille Martin')
    fireEvent.click(bouton('Créer la session'))
    await screen.findByRole('status')
    const corps = JSON.parse(fetch.mock.calls.find(([, o]) => o?.method === 'POST')[1].body)
    expect(corps).not.toHaveProperty('heure_debut')
    expect(corps).not.toHaveProperty('heure_fin')
  })

  it('CA2 : la durée et la modalité sont reprises de la formation et restent modifiables', async () => {
    installerFauxBackend()
    await ouvrirFormulaire()
    fireEvent.click(bouton('Suivant'))
    fireEvent.change(screen.getByLabelText(/^Formation/), { target: { value: '1' } })
    expect(screen.getByLabelText(/^Durée/).value).toBe('14')
    expect(screen.getByLabelText(/^Durée/).getAttribute('aria-invalid')).toBeNull()
    expect(screen.getByLabelText(/^Modalité/).value).toBe('DISTANCIEL')
    expect(screen.getByLabelText(/^Lien de la classe virtuelle/)).toBeTruthy()
    saisir('Durée', '10')
    choisirModalite('PRESENTIEL')
    expect(screen.getByLabelText(/^Durée/).value).toBe('10')
    expect(screen.getByLabelText(/^Lieu/)).toBeTruthy()
    // Formation sans durée : la durée saisie est gardée
    fireEvent.change(screen.getByLabelText(/^Formation/), { target: { value: '3' } })
    expect(screen.getByLabelText(/^Durée/).value).toBe('10')
    expect(screen.getByLabelText(/^Modalité/).value).toBe('MIXTE')
  })

  it('demande le lien en distanciel, le lieu et le lien en mixte', async () => {
    installerFauxBackend()
    await ouvrirFormulaire()
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(expect.arrayContaining(['Présentiel', 'Distanciel', 'Mixte']))
    expect(screen.queryByRole('option', { name: 'Classe virtuelle' })).toBeNull()
    choisirModalite('DISTANCIEL')
    expect(screen.queryByLabelText(/^Lieu/)).toBeNull()
    fireEvent.click(bouton('Suivant'))
    expect(screen.getByLabelText(/^Lien de la classe virtuelle/).getAttribute('aria-invalid')).toBe('true')
    choisirModalite('MIXTE')
    fireEvent.click(bouton('Suivant'))
    expect(screen.getByLabelText(/^Lieu/).getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByLabelText(/^Lien de la classe virtuelle/).getAttribute('aria-invalid')).toBe('true')
  })

  it('invite à créer une formation s’il n’en existe aucune', async () => {
    installerFauxBackend({ formations: [] })
    afficher('/sessions/nouvelle')
    expect(await screen.findByRole('heading', { name: "Aucune formation pour l'instant" })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Suivant' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Créer une formation' }).getAttribute('href')).toBe('/formations/nouvelle')
  })

  it('CA4 + CA6 : étape 2, au moins un formateur', async () => {
    installerFauxBackend()
    await ouvrirFormulaire()
    remplirEtape1()
    fireEvent.click(bouton('Suivant'))
    expect(titreEtape()).toBe('Formateur(s) *')
    expect(screen.getByRole('listitem', { current: 'step' }).textContent).toBe('2Formateurs')
    expect(screen.getByRole('checkbox', { name: /Julien Lefèvre/ }).closest('li').textContent).toBe('JLJulien Lefèvrejulien.lefevre@exemple.fr')
    fireEvent.click(bouton('Suivant'))
    expect(screen.getByRole('alert').textContent).toBe('Une session doit avoir au moins un formateur.')
    expect(titreEtape()).toBe('Formateur(s) *')
    // Le message disparaît dès que la personne manquante est cochée
    cocher('Julien Lefèvre')
    expect(screen.queryByRole('alert')).toBeNull()
    // « Précédent » revient à l'étape 1 sans perdre la saisie
    fireEvent.click(bouton('Précédent'))
    expect(screen.getByLabelText(/^Lieu/).value).toBe('Lyon, salle 2')
  })

  it('CA5 : un formateur sélectionné ouvre l’étape 3', async () => {
    installerFauxBackend()
    await allerEtape3()
    expect(titreEtape()).toBe('Apprenant(s) * · 0 / 10 places')
    expect(screen.getByText('0 sélectionné')).toBeTruthy()
    expect(screen.getByText('Un apprenant ou un formateur absent de la liste ? Déclarez-le dans « Parties prenantes ».')).toBeTruthy()
  })

  it('chaque personne affiche ses initiales, son nom, son entreprise ou « Individuel » et son e-mail', async () => {
    installerFauxBackend()
    await allerEtape3()
    const ligne = screen.getByRole('checkbox', { name: /Camille Martin/ }).closest('li')
    expect(ligne.textContent).toBe('CMCamille MartinAcme · camille.martin@acme.fr')
    expect(screen.getByRole('checkbox', { name: /Léa Moreau/ }).closest('li').textContent).toContain('Individuel')
  })

  it('CA5 (SCRUM-166) : la recherche filtre sur le nom, l’entreprise ou l’e-mail', async () => {
    installerFauxBackend()
    await allerEtape3()
    const rechercher = (texte) => fireEvent.change(screen.getByRole('searchbox', { name: 'Rechercher un apprenant ou une entreprise' }), { target: { value: texte } })
    rechercher('mar')
    expect(nomsAffiches('Apprenants')).toEqual(['Camille Martin', 'Yanis Petit'])
    rechercher('GLOBEX')
    expect(nomsAffiches('Apprenants')).toEqual(['Yanis Petit'])
    rechercher('zzz')
    expect(screen.getByText('Aucun résultat pour « zzz ».')).toBeTruthy()
    fireEvent.click(bouton('Effacer la recherche'))
    expect(nomsAffiches('Apprenants')).toHaveLength(4)
  })

  it('les personnes cochées remontent en tête, avec le compteur « N sélectionnés »', async () => {
    installerFauxBackend()
    await allerEtape3()
    cocher('Yanis Petit')
    cocher('Léa Moreau')
    expect(nomsAffiches('Apprenants')).toEqual(['Léa Moreau', 'Yanis Petit', 'Camille Martin', 'Hugo Bernard'])
    expect(screen.getByText('2 sélectionnés')).toBeTruthy()
  })

  it('CA6 (SCRUM-166) : trop d’apprenants pour le nombre de places', async () => {
    const fetch = installerFauxBackend()
    await ouvrirFormulaire()
    remplirEtape1()
    saisir('Nombre de places', '1')
    fireEvent.click(bouton('Suivant'))
    cocher('Julien Lefèvre')
    fireEvent.click(bouton('Suivant'))
    cocher('Camille Martin')
    expect(screen.getByText('· 1 / 1 places').classList.contains('depasse')).toBe(false)
    cocher('Hugo Bernard')
    expect(screen.getByText('· 2 / 1 places').classList.contains('depasse')).toBe(true)
    expect(screen.getByRole('alert').textContent).toBe('Trop d’apprenants : 2 cochés pour 1 places.')
    fireEvent.click(bouton('Créer la session'))
    expect(fetch.mock.calls.some(([, o]) => o?.method === 'POST')).toBe(false)
    cocher('Hugo Bernard')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('CA7 : sans apprenant, la session n’est pas créée', async () => {
    const fetch = installerFauxBackend()
    await allerEtape3()
    fireEvent.click(bouton('Créer la session'))
    expect(screen.getByRole('alert').textContent).toBe('Une session doit avoir au moins un apprenant.')
    expect(fetch.mock.calls.some(([, o]) => o?.method === 'POST')).toBe(false)
  })

  it('CA8 : la session est créée « Prévue », retour à la liste avec confirmation', async () => {
    const fetch = installerFauxBackend()
    await allerEtape3()
    fireEvent.click(screen.getByRole('checkbox', { name: /Camille Martin/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: /Hugo Bernard/ }))
    expect(screen.getByText('· 2 / 10 places')).toBeTruthy()
    fireEvent.click(bouton('Créer la session'))
    const message = await screen.findByRole('status')
    expect(message.textContent).toBe('La session « Management d’équipe — les fondamentaux » du 18/11/2026 a été créée avec le statut « Prévue ».')
    const post = fetch.mock.calls.find(([, o]) => o?.method === 'POST')
    expect(JSON.parse(post[1].body)).toMatchObject({ formation: 2, formateurs: [4], apprenants: [1, 2], duree_heures: '21' })
    const ligne = (await screen.findByText('Management d’équipe — les fondamentaux')).closest('tr')
    expect(ligne.classList.contains('nouvelle')).toBe(true)
    expect(within(ligne).getByText('2 / 10')).toBeTruthy()
    fireEvent.click(bouton('Fermer le message'))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('« Annuler » (étape 1), la croix ou Échap ferment le panneau', async () => {
    installerFauxBackend()
    const router = await ouvrirFormulaire()
    fireEvent.click(bouton('Annuler'))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(router.state.location.pathname).toBe('/sessions')
    cleanup()
    await allerEtape3()
    expect(screen.queryByRole('button', { name: 'Annuler' })).toBeNull()
    fireEvent.click(bouton('Fermer'))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    cleanup()
    await ouvrirFormulaire()
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('erreurs du serveur : retour à l’étape concernée', async () => {
    let reponse = repondre(400, { code: 'FORMATEUR_REQUIS', detail: 'Une session doit avoir au moins un formateur.' })
    installerFauxBackend({ reponsePost: () => reponse })
    await allerEtape3()
    fireEvent.click(screen.getByRole('checkbox', { name: /Camille Martin/ }))
    fireEvent.click(bouton('Créer la session'))
    await waitFor(() => expect(titreEtape()).toBe('Formateur(s) *'))
    expect(screen.getByRole('alert').textContent).toBe('Une session doit avoir au moins un formateur.')

    fireEvent.click(bouton('Suivant'))
    reponse = repondre(400, { code: 'APPRENANT_REQUIS', detail: 'Une session doit avoir au moins un apprenant.' })
    fireEvent.click(bouton('Créer la session'))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Une session doit avoir au moins un apprenant.'))

    reponse = repondre(400, { code: 'TROP_APPRENANTS', detail: 'Trop d’apprenants : 1 cochés pour 0 places.' })
    fireEvent.click(bouton('Créer la session'))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Trop d’apprenants : 1 cochés pour 0 places.'))
    expect(titreEtape()).toBe('Apprenant(s) * · 1 / 10 places')

    reponse = repondre(400, { code: 'DATES_INVALIDES', detail: 'La date de fin doit être postérieure ou égale à la date de début.' })
    fireEvent.click(bouton('Créer la session'))
    await waitFor(() => expect(titreEtape()).toBe('Informations'))
    expect(screen.getByText('La date de fin doit être postérieure ou égale à la date de début.')).toBeTruthy()

    reponse = repondre(400, { lieu: ['Ce champ est obligatoire.'], autre: ['ignoré'] })
    fireEvent.click(bouton('Suivant'))
    fireEvent.click(bouton('Suivant'))
    fireEvent.click(bouton('Créer la session'))
    await waitFor(() => expect(titreEtape()).toBe('Informations'))
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
    const panneau = await screen.findByRole('dialog')
    expect((await within(panneau).findByRole('alert')).textContent).toContain('Le serveur ne répond pas')
  })
})
