// Parcours « Rétablir le modèle d'origine » (SCRUM-217) : modifier, enregistrer, rétablir depuis la fenêtre du
// modèle d'origine, puis vérifier le statut « Modèle d'origine » et le contenu d'origine
import { expect, test } from '@playwright/test'
import { creerCompteParApi } from '../outils'

const MESSAGE = 'Modèle d’origine rétabli. Les modèles de la formation déjà créés ne changent pas.'

test('modifier, enregistrer, puis rétablir le modèle d’origine : statut « Modèle d’origine »', async ({ page }) => {
  await creerCompteParApi(page.request)
  await page.goto('/modeles/generiques/convention')
  const document = page.getByRole('textbox', { name: 'Convention de formation' })
  await document.getByText('CONVENTION DE FORMATION PROFESSIONNELLE').click()
  await page.keyboard.press('End')
  await page.keyboard.type(' MODIFIÉE')
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Modèle générique enregistré.', { exact: true })).toBeVisible()

  // Carte « Personnalisé » avec le lien « Rétablir le modèle d'origine »
  await page.getByRole('button', { name: '← Retour' }).click()
  const carte = page.getByRole('article', { name: 'Convention de formation' })
  await expect(carte).toContainText('Personnalisé')
  await carte.getByRole('button', { name: 'Rétablir le modèle d’origine' }).click()

  // Fenêtre du modèle d'origine en lecture seule, avec le rappel
  const fenetre = page.getByRole('dialog', { name: 'Convention de formation · Modèle d’origine' })
  await expect(fenetre.getByRole('article')).toContainText('CONVENTION DE FORMATION PROFESSIONNELLE')
  await expect(fenetre.getByRole('article')).not.toContainText('MODIFIÉE')
  await expect(fenetre).toContainText('remplace votre version personnalisée. Les modèles de la formation déjà créés ne changent pas.')
  await fenetre.getByRole('button', { name: 'Rétablir le modèle d’origine' }).click()

  // Message, statut « Modèle d'origine », lien disparu ; rouvert, le modèle est celui d'origine
  await expect(page.getByText(MESSAGE)).toBeVisible()
  await expect(fenetre).toBeHidden()
  await expect(carte).toContainText('Modèle d’origine')
  await expect(carte.getByRole('button', { name: /Rétablir/ })).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('article', { name: 'Convention de formation' })).toContainText('Modèle d’origine')
  await page.getByRole('link', { name: 'Convention de formation', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Convention de formation' })).not.toContainText('MODIFIÉE')
})
