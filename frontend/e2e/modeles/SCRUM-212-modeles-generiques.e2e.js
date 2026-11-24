// Parcours « Consulter les modèles génériques » (SCRUM-212) : cartes, message orange, ouverture d'un modèle
import { expect, test } from '@playwright/test'
import { creerCompteParApi } from '../outils'

const MODELES = ['Convention de formation', 'Contrat de formation', 'Convocation', 'Attestation de fin de formation']

test('un nouveau compte voit ses 4 modèles génériques et ouvre la convocation', async ({ page }) => {
  await creerCompteParApi(page.request)
  await page.goto('/modeles/generiques')

  // CA5 : Paramètres de l'organisme pas encore remplis (SCRUM-221) -> message orange, sans bouton
  await expect(page.getByText('Pensez à remplir les informations de votre organisme dans Paramètres : elles apparaîtront automatiquement dans vos documents.')).toBeVisible()

  // CA1 + CA3 : 4 cartes, miniature du vrai document, statut « Modèle d'origine », pas de lien « Rétablir »
  for (const nom of MODELES) {
    const carte = page.getByRole('article', { name: nom })
    await expect(carte.getByRole('link', { name: `Ouvrir ${nom}` }).locator('.doc-variable').first()).toBeAttached()
    await expect(carte).toContainText('Modèle d’origine')
    await expect(carte.getByRole('button', { name: 'Dupliquer' })).toBeDisabled()
    await expect(carte.getByRole('button', { name: /Rétablir/ })).toHaveCount(0)
  }

  // Au survol de la miniature : « Ouvrir »
  const miniature = page.getByRole('link', { name: 'Ouvrir Convocation' })
  await miniature.hover()
  await expect(miniature.getByText('Ouvrir', { exact: true })).toBeVisible()

  // CA4 (RG7) : un clic ouvre directement le modèle
  await miniature.click()
  await expect(page).toHaveURL(/\/modeles\/generiques\/convocation$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Convocation', exact: true })).toBeVisible()
})
