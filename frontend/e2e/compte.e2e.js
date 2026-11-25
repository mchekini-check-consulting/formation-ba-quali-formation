// Parcours « Créer un compte » (SCRUM-15) et « Se connecter » (SCRUM-16)
import { expect, test } from '@playwright/test'
import { creerCompteParApi, emailUnique, motDePasse } from './outils'

test.describe('Créer un compte', () => {
  test('le responsable crée son compte, renseigne son centre puis arrive sur Sessions et planning (SCRUM-221)', async ({ page }) => {
    const mdp = motDePasse()
    await page.goto('/creer-un-compte')
    await page.getByLabel('Adresse e-mail').fill(emailUnique('nouveau'))
    await page.getByLabel('Mot de passe', { exact: true }).fill(mdp)
    await page.getByLabel('Confirmer le mot de passe').fill(mdp)
    // RG-CC-06 : bouton grisé tant que les CGU ne sont pas acceptées
    const bouton = page.getByRole('button', { name: 'Créer mon compte' })
    await expect(bouton).toBeDisabled()
    await page.getByRole('checkbox').check()
    await bouton.click()

    await expect(page).toHaveURL(/\/premiere-connexion$/)
    await expect(page.getByText('Votre compte a été créé.')).toBeVisible()
    await page.getByLabel(/^Raison sociale/).fill('HiTech Formation')
    await page.getByLabel(/^SIRET/).fill('12345678900012')
    await page.getByLabel(/^Adresse/).fill('12 rue des Lilas, 75011 Paris')
    await page.getByLabel(/^Prénom/).fill('Marie')
    await page.getByLabel(/^Nom/).fill('Arnaud')
    await page.getByRole('button', { name: 'Enregistrer et accéder à Quali-formation' }).click()

    await expect(page).toHaveURL(/\/sessions$/)
    await expect(page.getByText('Bienvenue sur Quali-formation !')).toBeVisible()
  })

  test('un e-mail déjà utilisé est refusé', async ({ page, request }) => {
    const { email } = await creerCompteParApi(request)
    const mdp = motDePasse()
    await page.goto('/creer-un-compte')
    await page.getByLabel('Adresse e-mail').fill(email)
    await page.getByLabel('Mot de passe', { exact: true }).fill(mdp)
    await page.getByLabel('Confirmer le mot de passe').fill(mdp)
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: 'Créer mon compte' }).click()

    await expect(page.getByText('Un compte existe déjà avec cet e-mail.')).toBeVisible()
    await expect(page).toHaveURL(/\/creer-un-compte$/)
  })
})

test.describe('Se connecter', () => {
  test('depuis la page d\'accueil, avec le bon mot de passe', async ({ page, request }) => {
    const { email, mdp } = await creerCompteParApi(request)
    await page.goto('/')
    await page.getByRole('link', { name: 'Se connecter' }).first().click()
    const popup = page.getByRole('dialog', { name: 'Se connecter' })
    await popup.getByLabel('Adresse e-mail').fill(email)
    await popup.getByRole('textbox', { name: 'Mot de passe' }).fill(mdp)
    await popup.getByRole('button', { name: 'Se connecter' }).click()

    await expect(page).toHaveURL(/\/sessions$/)
    await expect(page.getByText('Vous êtes connecté. Bienvenue sur Quali-formation !')).toBeVisible()
  })

  test('un mauvais mot de passe affiche un message sans dire quel champ est faux', async ({ page, request }) => {
    const { email } = await creerCompteParApi(request)
    await page.goto('/se-connecter')
    const popup = page.getByRole('dialog', { name: 'Se connecter' })
    await popup.getByLabel('Adresse e-mail').fill(email)
    await popup.getByRole('textbox', { name: 'Mot de passe' }).fill(motDePasse())
    await popup.getByRole('button', { name: 'Se connecter' }).click()

    await expect(popup.getByRole('alert')).toHaveText('E-mail ou mot de passe incorrect')
    await expect(page).toHaveURL(/\/se-connecter$/)
  })
})
