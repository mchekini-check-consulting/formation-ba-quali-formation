// Phrases de la page Parties prenantes, onglet Apprenants (SCRUM-112)
import { expect } from '@playwright/test'
import { creerCompteParApi } from '../../outils'
import { champ, Given, normaliser, Then, When } from './commun'

const STATUTS = { Salarié: 'SALARIE', 'Demandeur d’emploi': 'DEMANDEUR_EMPLOI', Indépendant: 'INDEPENDANT', Particulier: 'PARTICULIER' }
const lignes = (page) => page.getByRole('list', { name: 'Apprenants' }).getByRole('listitem')
const onglet = (page, nom) => page.getByRole('tab', { name: new RegExp(`^${nom}`) })

// Enregistrés par l'API dans le centre du compte connecté. Il n'existe pas encore de création d'entreprise cliente
// (SCRUM-113) : la colonne « Entreprise » est enregistrée comme nom d'entreprise (texte), affiché de la même façon.
async function enregistrer(requete, { Prénom: prenom, Nom: nom, 'E-mail': email, Téléphone: telephone = '', Statut: statut,
  Entreprise: entreprise = '', Poste: poste = '' }) {
  const reponse = await requete.post('/api/apprenants/', { data: {
    prenom, nom, email, telephone, statut: STATUTS[statut], entreprise, poste,
  } })
  expect(reponse.status(), await reponse.text()).toBe(201)
}

Given('les apprenants suivants sont enregistrés dans mon centre :', async ({ page }, tableau) => {
  for (const apprenant of tableau.hashes()) await enregistrer(page.request, apprenant)
})

// Compte et centre à part (le navigateur reste connecté au compte du scénario)
Given('un autre centre a enregistré l\'apprenant {texte}', async ({ request }, nomComplet) => {
  const [prenom, nom] = nomComplet.split(' ')
  await creerCompteParApi(request)
  await enregistrer(request, { Prénom: prenom, Nom: nom, 'E-mail': normaliser(`${prenom}.${nom}@ailleurs.fr`), Statut: 'Particulier' })
})

When('je tape {texte} dans la recherche des apprenants', async ({ page }, texte) => {
  await page.getByRole('searchbox', { name: 'Rechercher un apprenant' }).fill(texte)
})

Then('les onglets sont, dans l\'ordre : {texte}, {texte}, {texte}', async ({ page }, a, b, c) => {
  await expect(page.getByRole('tab')).toHaveText([new RegExp(`^${a}`), b, c])
})

Then('l\'onglet {texte} est ouvert', async ({ page }, nom) => {
  await expect(onglet(page, nom)).toHaveAttribute('aria-selected', 'true')
})

Then('l\'onglet {texte} affiche le nombre {int}', async ({ page }, nom, nombre) => {
  await expect(onglet(page, nom)).toHaveText(`${nom}${nombre}`)
})

// Colonnes : Nom (prénom et nom), E-mail, Téléphone, Statut, Entreprise, Poste (sous l'entreprise), Sessions
Then('la liste des apprenants affiche, dans l\'ordre :', async ({ page }, tableau) => {
  const attendu = tableau.hashes().map((l) => [l.Nom, l['E-mail'], l.Téléphone, l.Statut, l.Entreprise, l.Poste, l.Sessions].join('|'))
  await expect.poll(() => lignes(page).evaluateAll((li) => li.map((l) => {
    const [, nom, tel, statut, entreprise, sessions] = l.children
    return [nom.querySelector('b').textContent, nom.querySelector('small').textContent, tel.textContent, statut.textContent,
      entreprise.querySelector('b').textContent, entreprise.querySelector('small')?.textContent || '', sessions.textContent].join('|')
  }))).toEqual(attendu)
})

Then(/^la liste des apprenants ne contient que (.+)$/, async ({ page }, liste) => {
  const noms = [...liste.matchAll(/«\s?([^»]*?)\s?»/g)].map((m) => m[1])
  await expect.poll(() => lignes(page).evaluateAll((li) => li.map((l) => l.children[1].querySelector('b').textContent))).toEqual(noms)
})

Then('{texte} est en tête de la liste des apprenants, mis en évidence', async ({ page }, nom) => {
  const premiere = lignes(page).first()
  await expect(premiere).toContainText(nom)
  await expect(premiere).toHaveAttribute('aria-current', 'true')
  // Fond « ligne mise en évidence » de la charte (#F0FDFA)
  await expect.poll(() => premiere.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe('rgb(240, 253, 250)')
  await expect(lignes(page).nth(1)).not.toHaveAttribute('aria-current', 'true')
})

Then('le champ {texte} ne propose aucune entreprise', async ({ page }, libelle) => {
  await expect(champ(page, libelle).locator('option')).toHaveText(['Choisir une entreprise'])
})
