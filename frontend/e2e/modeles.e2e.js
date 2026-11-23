// Parcours « Accéder aux modèles par dossiers » (SCRUM-210)
import { expect, test } from '@playwright/test'
import { creerCompteParApi, creerFormationBrouillon } from './outils'

test('menu Modèles : deux dossiers avec leur compteur, fil d’Ariane et retour', async ({ page }) => {
  await creerCompteParApi(page.request)
  await creerFormationBrouillon(page, 'Excel intermédiaire')
  await creerFormationBrouillon(page, 'Management d’équipe')

  // CA1 : le menu ouvre la page Modèles et ses deux cartes, compteurs venus du backend
  await page.getByRole('navigation', { name: 'Menu principal' }).getByRole('link', { name: 'Modèles' }).click()
  await expect(page).toHaveURL(/\/modeles$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Modèles' })).toBeVisible()
  const generiques = page.getByRole('link', { name: /Modèles génériques/ })
  const parFormation = page.getByRole('link', { name: /Modèles par formation/ })
  await expect(generiques).toContainText('4 modèles')
  await expect(parFormation).toContainText('2 formations')

  // CA2 : une carte ouvre le dossier, le fil d'Ariane indique où l'on est
  const filAriane = page.getByRole('navigation', { name: "Fil d'Ariane" })
  await generiques.click()
  await expect(page).toHaveURL(/\/modeles\/generiques$/)
  await expect(filAriane).toHaveText('Modèles › Modèles génériques')

  // CA3 : « ← Retour » ramène aux dossiers
  await page.getByRole('button', { name: '← Retour' }).click()
  await expect(page).toHaveURL(/\/modeles$/)

  // CA2 + CA3 : l'autre dossier, puis retour par « Modèles » dans le fil d'Ariane
  await parFormation.click()
  await expect(filAriane).toHaveText('Modèles › Modèles par formation')
  await filAriane.getByRole('link', { name: 'Modèles' }).click()
  await expect(page).toHaveURL(/\/modeles$/)
  await expect(parFormation).toContainText('2 formations')
})

test('un autre compte ne compte que ses propres formations', async ({ browser }) => {
  const contexteA = await browser.newContext()
  const pageA = await contexteA.newPage()
  await creerCompteParApi(pageA.request)
  await creerFormationBrouillon(pageA, 'Formation du compte A')

  const contexteB = await browser.newContext()
  const pageB = await contexteB.newPage()
  await creerCompteParApi(pageB.request)
  await pageB.goto('/modeles')
  await expect(pageB.getByRole('link', { name: /Modèles par formation/ })).toContainText('0 formation')

  await contexteA.close()
  await contexteB.close()
})
