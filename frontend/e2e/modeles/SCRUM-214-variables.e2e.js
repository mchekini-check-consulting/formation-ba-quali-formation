// Parcours « Insérer des variables dans un modèle » (SCRUM-214) : panneau (RG10), clic, glisser-déposer,
// aperçu avec des données d'exemple, enregistrement en {{code}} (RG9), réouverture
import { expect, test } from '@playwright/test'
import { creerCompteParApi } from '../outils'

const RG10 = ['Session', 'Formation', 'Apprenant', 'Client', 'Prix', 'Fin de formation', 'Document', 'Organisme']

test('insérer une variable par clic et par glisser-déposer, enregistrer puis rouvrir', async ({ page }) => {
  await creerCompteParApi(page.request)
  await page.goto('/modeles/generiques/convocation')
  const document = page.getByRole('textbox', { name: 'Convocation' })
  const panneau = page.getByRole('complementary', { name: 'Variables' })
  await expect(document).toContainText('CONVOCATION À LA FORMATION')

  // CA1 : catégories dans l'ordre de RG10
  await expect(panneau.getByRole('heading', { level: 3 })).toHaveText(RG10)

  // CA3 : curseur dans le texte, clic sur « Date limite du questionnaire »
  const titre = document.getByRole('heading', { name: 'CONVOCATION À LA FORMATION' })
  await titre.click()
  await page.keyboard.press('End')
  await page.keyboard.type(' le ')
  await panneau.getByRole('button', { name: 'Date limite du questionnaire' }).click()
  await expect(titre.locator('.doc-variable')).toHaveText('Date limite du questionnaire')

  // CA2 : glisser « Certification visée » et la lâcher dans le titre
  await panneau.getByRole('button', { name: 'Certification visée' }).dragTo(titre, { targetPosition: { x: 20, y: 10 } })
  await expect(titre.locator('.doc-variable', { hasText: 'Certification visée' })).toBeVisible()

  // CA4 : aperçu -> valeurs d'exemple, puis retour aux étiquettes
  const apercu = page.getByRole('checkbox', { name: 'Aperçu avec des données d’exemple' })
  await apercu.check()
  await expect(page.getByRole('article', { name: 'Convocation (aperçu)' })).toBeVisible()
  await expect(document).toBeHidden()
  await apercu.uncheck()
  await expect(document).toBeVisible()

  // CA5 (RG9) : enregistré sous {{code}}
  const envoi = page.waitForRequest((r) => r.method() === 'PUT')
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  const { contenu } = (await envoi).postDataJSON()
  expect(contenu).toContain('{{session_date_questionnaire}}')
  expect(contenu).toContain('{{formation_certification}}')
  await expect(page.getByText('Modèle générique enregistré.', { exact: true })).toBeVisible()

  // Rouvert : les deux étiquettes sont toujours là
  await page.reload()
  const rouvert = page.getByRole('textbox', { name: 'Convocation' }).getByRole('heading', { name: /CONVOCATION À LA FORMATION/ })
  await expect(rouvert.locator('.doc-variable')).toHaveText(['Certification visée', 'Date limite du questionnaire'])
})
