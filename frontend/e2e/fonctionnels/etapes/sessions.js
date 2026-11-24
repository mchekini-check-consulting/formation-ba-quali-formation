// Phrases propres à « Nouvelle session » (SCRUM-25, SCRUM-166) et aux parties prenantes (SCRUM-26, SCRUM-27)
import { expect } from '@playwright/test'
import { champ, donnees, Given, normaliser, Then, When } from './commun'

const fenetre = (page) => page.getByRole('dialog', { name: 'Nouvelle session' })
const liste = (page) => fenetre(page).getByRole('list', { name: /Formateurs|Apprenants/ })
const personne = (page, nom) => fenetre(page).getByRole('checkbox', { name: new RegExp(nom) })

// ---- Étapes de « Nouvelle session » ----

// Étape 1 valide : la première formation du scénario, du 18/11/2026 au 20/11/2026, à Lyon
async function remplirInformations(page, places) {
  await champ(page, 'Formation concernée').selectOption({ label: donnees(page).formations[0] })
  await champ(page, 'Date de début').fill('2026-11-18')
  await champ(page, 'Date de fin').fill('2026-11-20')
  await champ(page, 'Modalité').selectOption({ label: 'Présentiel' })
  await champ(page, 'Lieu').fill('Lyon, salle 2')
  await champ(page, 'Nombre de places').fill(String(places))
}

When('je remplis l\'étape Informations avec {int} places', async ({ page }, places) => {
  await remplirInformations(page, places)
})

Given('j\'ai ouvert l\'étape Formateurs d\'une session de {int} places', async ({ page }, places) => {
  await page.getByRole('button', { name: 'Nouvelle session', exact: true }).click()
  await remplirInformations(page, places)
  await page.getByRole('button', { name: 'Suivant' }).click()
  await expect(fenetre(page).getByRole('heading', { name: /^Formateur/ })).toBeVisible()
})

Given('j\'ai ouvert l\'étape Apprenants d\'une session de {int} places', async ({ page }, places) => {
  await page.getByRole('button', { name: 'Nouvelle session', exact: true }).click()
  await remplirInformations(page, places)
  await page.getByRole('button', { name: 'Suivant' }).click()
  await personne(page, 'Julien Lefèvre').check()
  await page.getByRole('button', { name: 'Suivant' }).click()
  await expect(fenetre(page).getByRole('heading', { name: /^Apprenant/ })).toBeVisible()
})

Then('l\'étape {texte} est en cours', async ({ page }, etape) => {
  await expect(fenetre(page).getByRole('listitem').filter({ hasText: etape })).toHaveAttribute('aria-current', 'step')
})

Then('l\'étape {texte} est cochée', async ({ page }, etape) => {
  await expect(fenetre(page).getByRole('listitem').filter({ hasText: etape })).toHaveClass(/faite/)
})

// ---- Choix des formateurs et des apprenants ----

When('je coche {texte}', async ({ page }, nom) => { await personne(page, nom).check() })
When('je décoche {texte}', async ({ page }, nom) => { await personne(page, nom).uncheck() })

When('je recherche {texte}', async ({ page }, texte) => {
  await fenetre(page).getByRole('searchbox').fill(texte)
})

Then('seules les personnes contenant {texte} sont affichées', async ({ page }, texte) => {
  const lignes = liste(page).getByRole('listitem')
  await expect(lignes.first()).toBeVisible()
  for (const ligne of await lignes.allTextContents()) {
    expect(normaliser(ligne), ligne).toContain(normaliser(texte))
  }
})

Then('{texte} est affiché dans la liste', async ({ page }, nom) => {
  await expect(personne(page, nom)).toBeVisible()
})

Then('{texte} n\'est pas affiché dans la liste', async ({ page }, nom) => {
  await expect(personne(page, nom)).toHaveCount(0)
})

Then('la ligne de {texte} affiche {texte}', async ({ page }, nom, texte) => {
  await expect(liste(page).getByRole('listitem').filter({ hasText: nom })).toContainText(texte)
})

Then('les personnes cochées sont en tête de la liste dans l\'ordre :', async ({ page }, tableau) => {
  const noms = tableau.raw().map(([nom]) => nom)
  const premieres = (await liste(page).getByRole('listitem').allTextContents()).slice(0, noms.length)
  noms.forEach((nom, i) => expect(premieres[i]).toContain(nom))
})

// ---- Résultat ----

Then('la session {texte} apparaît dans la liste avec le statut {texte}', async ({ page }, intitule, statut) => {
  const ligne = page.getByRole('list', { name: 'Sessions' }).getByRole('listitem').filter({ hasText: intitule })
  await expect(ligne).toBeVisible()
  await expect(ligne).toContainText(statut)
})

Then('aucune session n\'est créée', async ({ page }) => {
  expect(await (await page.request.get('/api/sessions/')).json()).toEqual([])
})

// ---- Parties prenantes (formateurs : SCRUM-26, apprenants : SCRUM-27) ----

const chemin = { formateur: '/api/formateurs/', apprenant: '/api/apprenants/' }
const emails = async (page, type) => (await (await page.request.get(chemin[type])).json()).map((p) => p.email)

Then(/^(?:le |l')(formateur|apprenant) «\s?([^»]*?)\s?» est enregistré$/, async ({ page }, type, email) => {
  expect(await emails(page, type)).toContain(email)
})

Then(/^aucun (formateur|apprenant) «\s?([^»]*?)\s?» n'est enregistré$/, async ({ page }, type, email) => {
  expect(await emails(page, type)).not.toContain(email)
})
