// Phrases réutilisables des scénarios fonctionnels (fichiers .feature, en français).
// Chaque phrase d'un scénario est rejouée par un vrai navigateur à l'aide de la définition ci-dessous.
// Les textes entre « » (ou entre "…" quand le texte contient lui-même des « ») sont des paramètres.
import { expect } from '@playwright/test'
import { createBdd, defineParameterType } from 'playwright-bdd'
import { creerCompteParApi, creerPersonnesExemplesParApi } from '../../outils'

// Texte entre guillemets français « … », ou entre "…" s'il contient lui-même des guillemets français
defineParameterType({
  name: 'texte',
  regexp: [/«\s?([^»]*?)\s?»/, /"([^"]*)"/],
  transformer: (a, b) => a ?? b,
})

export const { Given, When, Then } = createBdd()

// Ce que le scénario a créé (formations…), partagé entre ses phrases : une page de navigateur par scénario
const donneesParPage = new WeakMap()
export function donnees(page) {
  if (!donneesParPage.has(page)) donneesParPage.set(page, { formations: [] })
  return donneesParPage.get(page)
}

const MODALITES = { Présentiel: 'PRESENTIEL', Distanciel: 'DISTANCIEL', Mixte: 'MIXTE' }
const echapper = (texte) => texte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
// Champ repéré par le début de son libellé (« Nom » ne doit pas trouver « Prénom »)
export const champ = (page, libelle) => page.getByLabel(new RegExp(`^${echapper(libelle)}`))
// « 18/11/2026 » -> « 2026-11-18 » (format des champs date)
const dateIso = (texte) => texte.replace(/^(\d{2})\/(\d{2})\/(\d{4})$/, '$3-$2-$1')
// Minuscules, sans accents (« Lefèvre » est trouvé avec « lefevre »)
export const normaliser = (texte) => texte.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

// ---- Contexte ----

// Compte connecté dont le centre est déjà renseigné (SCRUM-221)
Given('je suis connecté', async ({ page }) => {
  await creerCompteParApi(page.request)
})

// Les formateurs et apprenants de la maquette SCRUM-25 (Sarah Dubois, Julien Lefèvre, Camille Martin…)
Given('les formateurs et apprenants d\'exemple sont enregistrés dans mon centre', async ({ page }) => {
  await creerPersonnesExemplesParApi(page.request)
})

// Nouveau compte, sans aucune donnée (remplace le compte connecté dans ce navigateur)
Given('je me connecte avec un nouveau compte', async ({ page }) => {
  await creerCompteParApi(page.request)
})

Given('j\'ai une formation {texte} de {int} heures en {texte}', async ({ page }, intitule, heures, modalite) => {
  const reponse = await page.request.post('/api/formations/',
    { data: { action: 'brouillon', intitule, duree_heures: heures, modalite: MODALITES[modalite] } })
  expect(reponse.status(), await reponse.text()).toBe(201)
  donnees(page).formations.push(intitule)
})

Given('je n\'ai aucune formation', async ({ page }) => {
  expect(await (await page.request.get('/api/formations/')).json()).toEqual([])
})

Given('je suis sur la page {texte}', async ({ page }, titre) => {
  const adresses = { 'Sessions et planning': '/sessions', Formations: '/formations', 'Parties prenantes': '/parties-prenantes',
    'Créer votre compte': '/creer-un-compte' }
  await page.goto(adresses[titre])
  await expect(page.getByRole('heading', { level: 1, name: titre })).toBeVisible()
})

// ---- Actions ----

// Bouton, choix d'un menu ou lien portant ce texte, dans cet ordre de préférence
// (« Parties prenantes » est à la fois un bouton de Sessions et planning et une entrée du menu latéral)
When('je clique sur {texte}', async ({ page }, nom) => {
  const cibles = [
    page.getByRole('button', { name: nom, exact: true }),
    page.getByRole('menuitem', { name: nom }),
    page.getByRole('link', { name: nom, exact: true }),
  ]
  await expect(cibles[0].or(cibles[1]).or(cibles[2]).first()).toBeVisible()
  for (const cible of cibles) {
    if (await cible.count()) return cible.first().click()
  }
})

When('je saisis {texte} dans le champ {texte}', async ({ page }, valeur, libelle) => {
  const c = champ(page, libelle)
  await c.fill(await c.getAttribute('type') === 'date' ? dateIso(valeur) : valeur)
})

When('je choisis {texte} dans le champ {texte}', async ({ page }, valeur, libelle) => {
  await champ(page, libelle).selectOption({ label: valeur })
})

// Tableau « libellé du champ | valeur » : liste déroulante ou zone de saisie
When('je remplis les champs :', async ({ page }, tableau) => {
  for (const [libelle, valeur] of tableau.raw()) {
    const c = champ(page, libelle)
    if (await c.evaluate((e) => e.tagName === 'SELECT')) await c.selectOption({ label: valeur })
    else await c.fill(await c.getAttribute('type') === 'date' ? dateIso(valeur) : valeur)
  }
})

// ---- Vérifications ----

Then('la fenêtre {texte} s\'ouvre', async ({ page }, titre) => {
  await expect(page.getByRole('dialog', { name: titre })).toBeVisible()
})

Then('la fenêtre {texte} est fermée', async ({ page }, titre) => {
  await expect(page.getByRole('dialog', { name: titre })).toHaveCount(0)
})

Then('le champ {texte} est signalé en erreur', async ({ page }, libelle) => {
  await expect(champ(page, libelle)).toHaveAttribute('aria-invalid', 'true')
})

Then('le champ {texte} n\'est pas signalé en erreur', async ({ page }, libelle) => {
  await expect(champ(page, libelle)).not.toHaveAttribute('aria-invalid', 'true')
})

Then('le champ {texte} contient {texte}', async ({ page }, libelle, valeur) => {
  const c = champ(page, libelle)
  if (await c.evaluate((e) => e.tagName === 'SELECT')) {
    await expect(c.locator('option:checked')).toHaveText(valeur)
  } else {
    await expect(c).toHaveValue(await c.getAttribute('type') === 'date' ? dateIso(valeur) : valeur)
  }
})

Then('le champ {texte} est affiché', async ({ page }, libelle) => {
  await expect(champ(page, libelle)).toBeVisible()
})

Then('le champ {texte} n\'est pas affiché', async ({ page }, libelle) => {
  await expect(champ(page, libelle)).toHaveCount(0)
})

// Message d'erreur placé sous le champ (relié au champ pour les lecteurs d'écran)
Then('le message {texte} s\'affiche sous le champ {texte}', async ({ page }, message, libelle) => {
  const c = champ(page, libelle)
  await expect(c).toHaveAttribute('aria-invalid', 'true')
  const id = await c.getAttribute('aria-describedby')
  await expect(page.locator(`[id="${id}"]`)).toHaveText(message)
})

Then('le message {texte} s\'affiche', async ({ page }, message) => {
  await expect(page.getByText(message, { exact: true }).first()).toBeVisible()
})

Then('le message {texte} ne s\'affiche pas', async ({ page }, message) => {
  await expect(page.getByText(message, { exact: true })).toHaveCount(0)
})

Then('je vois {texte}', async ({ page }, texte) => {
  await expect(page.getByText(texte).first()).toBeVisible()
})

Then('je ne vois pas {texte}', async ({ page }, texte) => {
  await expect(page.getByText(texte)).toHaveCount(0)
})

// Rouge : couleur d'erreur de l'application (texte nettement rouge)
Then('{texte} est affiché en rouge', async ({ page }, texte) => {
  const element = page.getByText(texte).first()
  await expect(element).toBeVisible()
  await expect.poll(async () => {
    const [r, g, b] = (await element.evaluate((e) => getComputedStyle(e).color)).match(/\d+/g).map(Number)
    return r > 150 && g < 100 && b < 100
  }).toBe(true)
})

Then('{texte} n\'est pas affiché en rouge', async ({ page }, texte) => {
  const element = page.getByText(texte).first()
  await expect(element).toBeVisible()
  const [r, g, b] = (await element.evaluate((e) => getComputedStyle(e).color)).match(/\d+/g).map(Number)
  expect(r > 150 && g < 100 && b < 100).toBe(false)
})

Then('le bandeau de confirmation affiche {texte}', async ({ page }, message) => {
  await expect(page.getByRole('status')).toHaveText(message)
})
