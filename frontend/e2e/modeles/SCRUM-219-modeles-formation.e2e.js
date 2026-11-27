// Parcours « Consulter et rétablir les modèles d'une formation » (SCRUM-219) : ouvrir le dossier d'une formation,
// modifier son modèle de la formation, puis rétablir le modèle générique (RG7, RG18, RG18 bis, RG19)
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
  // RG18 bis : juste copié, il est identique au modèle générique : pas de lien « Rétablir »
  const carte = page.getByRole('article', { name: 'Convocation' })
  const retablir = carte.getByRole('button', { name: 'Rétablir le modèle générique' })
  await expect(carte).toContainText('Modèle de la formation')
  await expect(carte).toContainText('Identique au modèle générique')
  await expect(retablir).toHaveCount(0)
  await expect(page.getByText('Modèle générique appliqué : Convention de formation, Contrat de formation, Attestation de fin de formation.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Dupliquer' })).toHaveCount(0)

  // RG7 : un clic l'ouvre dans l'éditeur. RG18 bis : une modification annulée puis « Enregistrer » (l'éditeur réécrit
  // le document) : rien ne change à l'écran, il reste « Identique au modèle générique »
  await carte.getByRole('link', { name: 'Convocation', exact: true }).click()
  const document = page.getByRole('textbox', { name: 'Convocation' })
  await expect(document).toContainText('CONVOCATION')
  await expect(page.getByText('Modèle de la formation « Excel intermédiaire ». Il remplace le modèle générique pour toutes les sessions de cette formation.')).toBeVisible()
  await document.locator('h1').first().click()
  await page.keyboard.press('End')
  await page.keyboard.type('Z')
  await page.keyboard.press('Backspace')
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Document enregistré pour la formation « Excel intermédiaire ».')).toBeVisible()
  await page.getByRole('button', { name: '← Retour' }).click()
  await expect(carte).toContainText('Identique au modèle générique')

  // Vraie modification : « Différent du modèle générique » et lien « Rétablir »
  await carte.getByRole('link', { name: 'Convocation', exact: true }).click()
  await document.locator('h1').first().click()
  await page.keyboard.press('End')
  await page.keyboard.type(' EXCEL')
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Document enregistré pour la formation « Excel intermédiaire ».')).toBeVisible()
  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Convocation' })).toContainText('EXCEL')
  await page.getByRole('button', { name: '← Retour' }).click()
  await expect(carte).toContainText('Différent du modèle générique')

  // CA5 : « Annuler » ne change rien
  await retablir.click()
  await page.getByRole('dialog', { name: 'Rétablir le modèle générique ?' }).getByRole('button', { name: 'Annuler' }).click()
  await expect(carte).toContainText('Différent du modèle générique')

  // CA4 / RG19 : rétablir et confirmer : la carte reste « Modèle de la formation », son contenu redevient celui du
  // modèle générique actuel (la modification « EXCEL » disparaît) ; de nouveau identique, le lien disparaît
  await retablir.click()
  const fenetre = page.getByRole('dialog', { name: 'Rétablir le modèle générique ?' })
  await expect(fenetre).toContainText('Le contenu du modèle de la formation « Excel intermédiaire » (convocation) sera remplacé par le modèle générique actuel. Le modèle reste dans le dossier de la formation.')
  await fenetre.getByRole('button', { name: 'Rétablir le modèle générique' }).click()
  await expect(page.getByText('Modèle générique rétabli pour la formation « Excel intermédiaire ».')).toBeVisible()
  await expect(fenetre).toBeHidden()
  await expect(carte).toContainText('Modèle de la formation')
  await expect(carte).toContainText('Identique au modèle générique')
  await expect(carte).not.toContainText('EXCEL')
  await expect(retablir).toHaveCount(0)
  await page.reload()
  await expect(carte).toContainText('Identique au modèle générique')
  await carte.getByRole('link', { name: 'Convocation', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Convocation' })).toContainText('CONVOCATION')
  await expect(page.getByRole('textbox', { name: 'Convocation' })).not.toContainText('EXCEL')
})
