// Parcours « Importer son propre document Word » (SCRUM-215) : import d'un .docx fictif, guide, variable,
// enregistrement, statut « Mon document » ; un fichier qui n'est pas un .docx est refusé
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'
import { creerCompteParApi } from '../outils'

const DOCX = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fichiers', 'convocation-exemple.docx')

test('importer un .docx, remplacer « Camille » par une variable, enregistrer : statut « Mon document »', async ({ page }) => {
  await creerCompteParApi(page.request)
  await page.goto('/modeles/generiques/convocation')
  await expect(page.getByRole('textbox', { name: 'Convocation' })).toContainText('CONVOCATION À LA FORMATION')

  // CA4 : un fichier qui n'est pas un .docx est refusé
  await page.getByLabel('Utiliser mon propre document Word').setInputFiles({ name: 'convocation.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF') })
  await expect(page.getByRole('alert')).toHaveText('Seuls les fichiers Word (.docx) sont acceptés.')

  // CA1 + CA2 : le .docx remplace le document ; guide et encadré « Document importé »
  await page.getByLabel('Utiliser mon propre document Word').setInputFiles(DOCX)
  const document = page.getByRole('textbox', { name: 'Convocation' })
  await expect(document.getByRole('heading', { level: 1 })).toHaveText('Convocation à la formation Management d’équipe')
  await expect(document.locator('strong')).toHaveText('Camille')
  await expect(document.locator('.doc-variable')).toHaveText('Nom') // {{apprenant_nom}} du Word reconnu
  await expect(page.getByRole('heading', { name: /Votre document est importé/ })).toBeVisible()
  const panneau = page.getByRole('complementary', { name: 'Variables' })
  await expect(panneau).toContainText('Document importé')
  await expect(panneau).toContainText('convocation-exemple.docx')

  // CA3 : sélectionner « Camille » puis cliquer « Prénom »
  await document.locator('strong', { hasText: 'Camille' }).dblclick()
  await panneau.getByRole('button', { name: 'Prénom', exact: true }).click()
  await expect(document).not.toContainText('Camille')
  await expect(document.locator('.doc-variable')).toHaveText(['Prénom', 'Nom'])
  await page.getByRole('button', { name: 'J’ai compris' }).click()

  // CA5 : enregistrer puis revenir à la liste -> « Mon document »
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Modèle générique enregistré.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '← Retour' }).click()
  await expect(page.getByRole('article', { name: 'Convocation' })).toContainText('Mon document')

  // Rouvert : le document importé et son nom de fichier
  await page.getByRole('link', { name: 'Convocation', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Convocation' }).locator('.doc-variable')).toHaveText(['Prénom', 'Nom'])
  await expect(page.getByRole('complementary', { name: 'Variables' })).toContainText('convocation-exemple.docx')
})
