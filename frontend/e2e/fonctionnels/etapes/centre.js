// Phrases des informations du centre à la première connexion (SCRUM-221)
import { expect } from '@playwright/test'
import { creerCompteParApi, emailUnique, motDePasse, renseignerCentreParApi, siretUnique } from '../../outils'
import { champ, donnees, Given, Then, When } from './commun'

// Compte créé depuis l'écran « Créer votre compte » ; son e-mail et son mot de passe sont gardés pour la reconnexion
Given('je viens de créer mon compte', async ({ page }) => {
  const compte = donnees(page).compte = { email: emailUnique('scrum221'), mdp: motDePasse() }
  await page.goto('/creer-un-compte')
  await page.getByLabel('Adresse e-mail').fill(compte.email)
  await page.getByLabel('Mot de passe', { exact: true }).fill(compte.mdp)
  await page.getByLabel('Confirmer le mot de passe').fill(compte.mdp)
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Créer mon compte' }).click()
  await expect(page).toHaveURL(/\/premiere-connexion$/)
})

When('j\'ouvre l\'adresse {texte}', async ({ page }, adresse) => {
  await page.goto(adresse)
})

When('je me déconnecte', async ({ page }) => {
  await page.getByRole('button', { name: 'Profil' }).click()
  await page.getByRole('menuitem', { name: 'Se déconnecter' }).click()
  await expect(page).toHaveURL(/\/se-connecter$/)
})

When('je me reconnecte', async ({ page }) => {
  const { email, mdp } = donnees(page).compte
  await page.goto('/se-connecter')
  const popup = page.getByRole('dialog', { name: 'Se connecter' })
  await popup.getByLabel('Adresse e-mail').fill(email)
  await popup.getByRole('textbox', { name: 'Mot de passe' }).fill(mdp)
  await popup.getByRole('button', { name: 'Se connecter' }).click()
})

Then('le formulaire «Première connexion» s\'affiche', async ({ page }) => {
  await expect(page).toHaveURL(/\/premiere-connexion$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Bienvenue ! Présentez-nous votre centre' })).toBeVisible()
})

Then('le formulaire «Première connexion» ne s\'affiche pas', async ({ page }) => {
  await expect(page).not.toHaveURL(/\/premiere-connexion$/)
  await expect(page.getByRole('heading', { name: 'Bienvenue ! Présentez-nous votre centre' })).toHaveCount(0)
})

Then('le menu latéral n\'est pas affiché', async ({ page }) => {
  await expect(page.getByRole('navigation', { name: 'Menu principal' })).toHaveCount(0)
})

Then('le champ «E-mail» contient mon e-mail et n\'est pas modifiable', async ({ page }) => {
  const email = page.getByLabel('E-mail', { exact: true })
  await expect(email).toHaveValue(donnees(page).compte.email)
  await expect(email).not.toBeEditable()
})

Then('le bandeau vert affiche {texte}', async ({ page }, texte) => {
  await expect(page.locator('.pc-bandeaux').getByRole('status')).toHaveText(texte)
})

// Blocs et champs du formulaire, dans l'ordre de la page : tableau | Bloc | Champ |
Then("le formulaire contient, dans l'ordre :", async ({ page }, tableau) => {
  const attendu = tableau.hashes().map((l) => `${l.Bloc} / ${l.Champ}`)
  const lus = await page.locator('section.pc-bloc').evaluateAll((blocs) => blocs.flatMap((bloc) => {
    const titre = bloc.querySelector('h2').textContent
    return [...bloc.querySelectorAll('input')].map((c) => `${titre} / ${c.labels[0].textContent.replace(' *', '')}`)
  }))
  expect(lus).toEqual(attendu)
})

// Réponses de la recherche d'entreprises par SIRET simulées dans le navigateur (pas d'appel à l'API de l'État).
// Sans ces phrases, le backend des tests vise une adresse fermée : « Aucune information trouvée » (demarrer-backend.mjs).
Given("la recherche d'entreprises connaît le SIRET {texte} : {texte}, {texte}", async ({ page }, siret, raisonSociale, adresse) => {
  await page.route(`**/entreprises/${siret}/`, (route) => route.fulfill({
    json: { siret, raison_sociale: raisonSociale, adresse },
  }))
})

Given("la recherche d'entreprises ne répond pas", async ({ page }) => {
  await page.route('**/entreprises/*/', (route) => route.fulfill({ status: 503, json: { code: 'SERVICE_INDISPONIBLE' } }))
})

Then('le bandeau rouge affiche {texte}', async ({ page }, texte) => {
  await expect(page.getByRole('alert')).toHaveText(texte)
})

// Vérifié auprès du serveur (GET /auth/moi)
Then('aucun centre n\'est enregistré', async ({ page }) => {
  const moi = await (await page.request.get('/api/auth/moi')).json()
  expect(moi.organisme).toBeNull()
})

Then('je suis le gestionnaire du centre {texte}', async ({ page }, raisonSociale) => {
  const moi = await (await page.request.get('/api/auth/moi')).json()
  expect(moi.role).toBe('GESTIONNAIRE')
  expect(moi.organisme?.raison_sociale).toBe(raisonSociale)
})

Then('le bas du menu affiche la bulle {texte} et {texte}', async ({ page }, initiales, raisonSociale) => {
  const compte = page.locator('aside .nav-compte')
  await expect(compte.locator('.avatar')).toHaveText(initiales)
  await expect(compte.locator('.nav-compte-nom')).toHaveText(raisonSociale)
})

Then('la raison sociale est coupée avec « … »', async ({ page }) => {
  const nom = page.locator('aside .nav-compte-nom')
  await expect(nom).toBeVisible()
  const { coupee, points } = await nom.evaluate((e) => ({
    coupee: e.scrollWidth > e.clientWidth, points: getComputedStyle(e).textOverflow,
  }))
  expect(coupee).toBe(true)
  expect(points).toBe('ellipsis')
})

// Remplit les champs obligatoires du formulaire avec ceux de la maquette (raison sociale au choix). Le SIRET d'abord,
// puis on attend le résultat de sa recherche pour qu'il ne remplace pas la raison sociale saisie ensuite.
When('je remplis les champs obligatoires pour le centre {texte}', async ({ page }, raisonSociale) => {
  await champ(page, 'SIRET').fill(siretUnique())
  await expect(page.locator('#pc-siret-info')).toBeVisible()
  await champ(page, 'Raison sociale').fill(raisonSociale)
  await champ(page, 'Adresse').fill('12 rue des Lilas, 75011 Paris')
  await champ(page, 'Prénom').fill('Marie')
  await champ(page, 'Nom').fill('Arnaud')
})

// Critère 8 : centre inscrit par un autre compte (requête à part : la session du navigateur n'est pas touchée)
Given('un centre est déjà inscrit avec le SIRET {texte}', async ({ request }, siret) => {
  await creerCompteParApi(request, emailUnique('autre-centre'), motDePasse(), { centre: false })
  await renseignerCentreParApi(request, 'Centre déjà inscrit', siret)
})
