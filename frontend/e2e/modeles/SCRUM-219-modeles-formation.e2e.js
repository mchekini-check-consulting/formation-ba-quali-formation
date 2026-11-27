// Parcours « Consulter et rétablir les modèles d'une formation » (SCRUM-219) : ouvrir le dossier d'une formation,
// modifier son modèle de la formation, puis rétablir le modèle générique (RG7, RG18, RG19)
import { expect, test } from '@playwright/test'
import { creerCompteParApi, creerFormationBrouillon } from '../outils'

test('ouvrir le dossier d’une formation, modifier son modèle de la formation, puis le rétablir', async ({ page }) => {
  await creerCompteParApi(page.request)
  await creerFormationBrouillon(page, 'Excel intermédiaire')

  // La formation a sa convocation (duplication, SCRUM-218)
  await page.goto('/modeles/generiques')
  await page.getByRole('article', { name: 'Convocation' }).getByRole('button', { name: 'Dupliquer' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Créer le modèle de la formation' }).click()
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page).toHaveURL(/\/modeles\/formations\/\d+$/)

  // CA3 : dans « Modèles par formation », la carte indique « 1 modèle de la formation »
  await page.goto('/modeles/formations')
  const dossier = page.getByRole('link', { name: /Excel intermédiaire/ })
  await expect(dossier).toContainText('1 modèle de la formation')
  await dossier.click()

  // CA2 : carte « Modèle de la formation », phrase avec les 3 autres documents, pas de « Dupliquer » (RG14)
  const carte = page.getByRole('article', { name: 'Convocation' })
  await expect(carte).toContainText('Modèle de la formation')
  await expect(page.getByText('Modèle générique appliqué : Convention de formation, Contrat de formation, Attestation de fin de formation.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Dupliquer' })).toHaveCount(0)

  // RG7 : un clic l'ouvre dans l'éditeur ; modifier puis enregistrer
  await carte.getByRole('link', { name: 'Convocation', exact: true }).click()
  const document = page.getByRole('textbox', { name: 'Convocation' })
  await expect(document).toContainText('CONVOCATION')
  await expect(page.getByText('Modèle de la formation « Excel intermédiaire ». Il remplace le modèle générique pour toutes les sessions de cette formation.')).toBeVisible()
  await document.locator('h1').first().click()
  await page.keyboard.press('End')
  await page.keyboard.type(' EXCEL')
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Document enregistré pour la formation « Excel intermédiaire ».')).toBeVisible()
  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Convocation' })).toContainText('EXCEL')

  // CA5 : « Annuler » ne change rien
  await page.getByRole('button', { name: '← Retour' }).click()
  await carte.getByRole('button', { name: 'Rétablir le modèle générique' }).click()
  await page.getByRole('dialog', { name: 'Rétablir le modèle générique ?' }).getByRole('button', { name: 'Annuler' }).click()
  await expect(carte).toBeVisible()

  // CA4 : rétablir et confirmer : la carte disparaît, le dossier est de nouveau vide
  await carte.getByRole('button', { name: 'Rétablir le modèle générique' }).click()
  const fenetre = page.getByRole('dialog', { name: 'Rétablir le modèle générique ?' })
  await expect(fenetre).toContainText('Le modèle de la formation « Excel intermédiaire » (convocation) sera supprimé.')
  await fenetre.getByRole('button', { name: 'Rétablir le modèle générique' }).click()
  await expect(page.getByText('Modèle générique rétabli pour cette formation.')).toBeVisible()
  await expect(carte).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Aucun modèle de la formation' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Aucun modèle de la formation' })).toBeVisible()
})
