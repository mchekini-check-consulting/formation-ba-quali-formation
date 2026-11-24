// Parcours « Disposer de 4 modèles d'origine » (SCRUM-211) : modèles chargés par la migration du backend
import { expect, test } from '@playwright/test'
import { creerCompteParApi } from './outils'

const MODELES = ['Convention de formation', 'Contrat de formation', 'Convocation', 'Attestation de fin de formation']

test('un nouveau compte trouve les 4 modèles d’origine et ouvre la convention', async ({ page }) => {
  await creerCompteParApi(page.request)
  await page.goto('/modeles')
  await page.getByRole('link', { name: /Modèles génériques/ }).click()

  // CA1 : les 4 modèles, statut « Modèle d'origine »
  for (const nom of MODELES) {
    await expect(page.getByRole('article', { name: nom })).toContainText('Modèle d’origine')
  }

  // CA2 : le texte d'origine, les variables en étiquettes (libellés du dictionnaire, jamais {{code}})
  await page.getByRole('link', { name: 'Convention de formation', exact: true }).click()
  await expect(page).toHaveURL(/\/modeles\/generiques\/convention$/)
  await expect(page.getByRole('navigation', { name: "Fil d'Ariane" })).toHaveText('Modèles › Modèles génériques › Convention de formation')
  const document = page.getByRole('article', { name: 'Document' })
  await expect(document.getByRole('heading', { name: 'CONVENTION DE FORMATION PROFESSIONNELLE' })).toBeVisible()
  await expect(document).toContainText('Articles L6353-1 et suivants du Code du travail')
  await expect(document.locator('.doc-variable').first()).toBeVisible()
  expect(await document.locator('.doc-variable').count()).toBeGreaterThan(40)
  await expect(document).not.toContainText('{{')

  // Retour à la liste
  await page.getByRole('button', { name: '← Retour' }).click()
  await expect(page).toHaveURL(/\/modeles\/generiques$/)
})
