// Phrases du menu latéral (SCRUM-209)
import { expect } from '@playwright/test'
import { Given, Then, When } from './commun'

const menu = (page) => page.getByRole('navigation', { name: 'Menu principal' })
const barre = (page) => page.locator('aside')
const bas = (page) => barre(page).locator('.nav-bas')
// Entrée de la barre latérale (lien, ou entrée « Bientôt » grisée ; Paramètres compris), repérée par son libellé
const entree = (page, titre) => barre(page).locator('a, .nav-bientot').filter({ hasText: new RegExp(`^${titre}(Bientôt)?$`) })

Given('je suis sur la page d\'accueil de l\'application', async ({ page }) => {
  await page.goto('/tableau-de-bord')
  await expect(menu(page)).toBeVisible()
})

When('je clique sur l\'entrée {texte} du menu', async ({ page }, titre) => {
  // force : une entrée « Bientôt » n'est pas un lien, on clique quand même dessus comme l'utilisateur
  await entree(page, titre).click({ force: true })
})

// Tableau « Section | Entrée » ; section vide = entrée hors section (Tableau de bord)
Then('le menu latéral affiche, dans l\'ordre :', async ({ page }, tableau) => {
  const attendu = tableau.hashes()
  await expect(menu(page).locator('a, .nav-bientot')).toHaveCount(attendu.length)
  const lu = await menu(page).locator('.nav-section').evaluateAll((sections) => sections.flatMap((s) => {
    const titre = s.querySelector('.nav-titre')?.textContent || ''
    return [...s.querySelectorAll('a, .nav-bientot')].map((e) => ({ Section: titre, Entrée: e.textContent.replace(/Bientôt$/, '') }))
  }))
  expect(lu).toEqual(attendu)
})

Then('le bas du menu affiche {texte} puis {texte}', async ({ page }, premier, second) => {
  const texte = await bas(page).innerText()
  expect(texte.indexOf(premier), texte).toBeGreaterThanOrEqual(0)
  expect(texte.indexOf(second), texte).toBeGreaterThan(texte.indexOf(premier))
})

Then('le menu ne propose pas {texte}', async ({ page }, titre) => {
  await expect(menu(page).getByRole('link', { name: titre, exact: true })).toHaveCount(0)
  await expect(entree(page, titre)).toHaveCount(0)
})

Then('l\'entrée {texte} du menu est grisée avec l\'étiquette {texte}', async ({ page }, titre, etiquette) => {
  const e = entree(page, titre)
  await expect(e).toHaveAttribute('aria-disabled', 'true')
  await expect(e.locator('.nav-badge')).toHaveText(etiquette)
  await expect(menu(page).getByRole('link', { name: titre })).toHaveCount(0)
})

Then('la page {texte} s\'affiche', async ({ page }, titre) => {
  await expect(page.getByRole('heading', { level: 1, name: titre, exact: true })).toBeVisible()
})

Then('je suis toujours sur la page {texte}', async ({ page }, titre) => {
  await expect(page.getByRole('heading', { level: 1, name: titre, exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
})

Then('l\'entrée {texte} du menu est mise en évidence', async ({ page }, titre) => {
  await expect(entree(page, titre)).toHaveAttribute('aria-current', 'page')
  await expect(barre(page).locator('[aria-current="page"]')).toHaveCount(1)
})
