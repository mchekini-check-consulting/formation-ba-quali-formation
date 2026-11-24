// Parcours « Modifier un modèle dans l'éditeur » (SCRUM-213) : gras, enregistrer, rouvrir ; Retour sans enregistrer
import { expect, test } from '@playwright/test'
import { creerCompteParApi } from '../outils'

test('mettre un mot en gras, enregistrer, puis le retrouver en rouvrant le modèle', async ({ page }) => {
  await creerCompteParApi(page.request)
  await page.goto('/modeles/generiques')
  await page.getByRole('link', { name: 'Convention de formation', exact: true }).click()
  const document = page.getByRole('textbox', { name: 'Convention de formation' })
  await expect(document).toContainText('CONVENTION DE FORMATION PROFESSIONNELLE')

  // CA1 : sélection d'un mot + « Gras » -> en gras, bouton mis en évidence
  const gras = page.getByRole('toolbar', { name: 'Mise en forme' }).getByRole('button', { name: 'Gras' })
  await document.getByText(/est conclue la convention suivante/).dblclick({ position: { x: 30, y: 8 } })
  await gras.click()
  await expect(document.locator('strong', { hasText: /^conclue$/ })).toBeVisible()
  await expect(gras).toHaveAttribute('aria-pressed', 'true')

  // CA3 : « Enregistrer » -> message (nouveau compte : aucune formation) et statut « Personnalisé »
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Modèle générique enregistré.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '← Retour' }).click()
  await expect(page.getByRole('article', { name: 'Convention de formation' })).toContainText('Personnalisé')

  // CA5 : rouvert, le mot est toujours en gras
  await page.getByRole('link', { name: 'Convention de formation', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Convention de formation' }).locator('strong', { hasText: /^conclue$/ })).toBeVisible()
})

test('modifier sans enregistrer puis « ← Retour » : le modèle reste d’origine', async ({ page }) => {
  await creerCompteParApi(page.request)
  await page.goto('/modeles/generiques/contrat')
  const document = page.getByRole('textbox', { name: 'Contrat de formation' })
  await document.getByText('CONTRAT DE FORMATION PROFESSIONNELLE').click()
  await page.keyboard.type(' MODIFIÉ')
  await expect(document).toContainText('MODIFIÉ')

  // CA4 (RG8) : rien n'est envoyé au serveur
  const envois = []
  page.on('request', (r) => { if (r.method() === 'PUT') envois.push(r.url()) })
  await page.getByRole('button', { name: '← Retour' }).click()
  await expect(page.getByRole('article', { name: 'Contrat de formation' })).toContainText('Modèle d’origine')
  await page.getByRole('link', { name: 'Contrat de formation', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Contrat de formation' })).not.toContainText('MODIFIÉ')
  expect(envois).toEqual([])
})
