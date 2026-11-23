// Parcours « Créer une formation » et « Formations par compte » (chaque compte ne voit que ses formations)
import { expect, test } from '@playwright/test'
import { creerCompteParApi, creerFormationBrouillon } from './outils'

test('créer une formation en brouillon et la retrouver dans la liste', async ({ page }) => {
  await creerCompteParApi(page.request)
  await page.goto('/formations')
  // Aucune formation : écran d'accueil avec le bouton de création
  await expect(page.getByText('Aucune formation créée pour le moment')).toBeVisible()
  await page.getByRole('button', { name: 'Créer une formation' }).click()
  await expect(page.getByRole('heading', { name: 'Nouvelle formation' })).toBeVisible()

  // RG02 : en brouillon, l'intitulé est obligatoire
  await page.getByRole('button', { name: 'Enregistrer en brouillon' }).click()
  await expect(page.getByText('Ce champ est obligatoire.')).toBeVisible()
  // La page remonte en douceur jusqu'au champ en erreur : on attend la fin du défilement avant de cliquer
  await page.waitForFunction(() => window.scrollY === 0)

  await page.getByLabel('Intitulé de la formation').fill('Management d\'équipe — niveau 2')
  await page.getByRole('button', { name: 'Enregistrer en brouillon' }).click()

  await expect(page).toHaveURL(/\/formations$/)
  await expect(page.getByRole('heading', { name: 'Management d\'équipe — niveau 2' })).toBeVisible()
  // La formation est toujours là après rechargement : elle est bien enregistrée par le backend
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Management d\'équipe — niveau 2' })).toBeVisible()
})

test('un compte ne voit pas les formations d\'un autre compte', async ({ browser }) => {
  // Compte A : crée une formation
  const contexteA = await browser.newContext()
  const pageA = await contexteA.newPage()
  await creerCompteParApi(pageA.request)
  await creerFormationBrouillon(pageA, 'Formation réservée au compte A')
  const [formation] = await (await pageA.request.get('/api/formations/')).json()

  // Compte B, dans un autre navigateur : sa liste est vide
  const contexteB = await browser.newContext()
  const pageB = await contexteB.newPage()
  await creerCompteParApi(pageB.request)
  await pageB.goto('/formations')
  await expect(pageB.getByText('Aucune formation créée pour le moment')).toBeVisible()
  await expect(pageB.getByText('Formation réservée au compte A')).toHaveCount(0)

  // … et la fiche de A, ouverte par son adresse, est « introuvable » pour B
  await pageB.goto(`/formations/${formation.id}`)
  await expect(pageB.getByRole('alert')).toContainText('Formation introuvable.')
  await expect(pageB.getByText('Formation réservée au compte A')).toHaveCount(0)

  await contexteA.close()
  await contexteB.close()
})

test('sans connexion, la liste des formations propose de se connecter', async ({ page }) => {
  await page.goto('/formations')
  const message = page.getByRole('alert')
  await expect(message).toContainText('connecté')
  await expect(message.getByRole('link', { name: 'Se connecter' })).toBeVisible()
})
