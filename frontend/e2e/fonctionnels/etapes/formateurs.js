// Phrases de la page Parties prenantes, onglet Formateurs, et de la fenêtre « Nouveau formateur » (SCRUM-119)
import { expect } from '@playwright/test'
import { creerCompteParApi } from '../../outils'
import { donnees, Given, normaliser, Then, When } from './commun'

const lignes = (page) => page.getByRole('list', { name: 'Formateurs' }).getByRole('listitem')
const STATUTS = { Salarié: 'SALARIE', 'Sous-traitant': 'SOUS_TRAITANT' }
const IMPORT = { CV: 'Importer un CV', Diplômes: 'Importer un diplôme' }
const MO = 1024 * 1024

async function enregistrer(requete, { Prénom: prenom, Nom: nom, 'E-mail': email }) {
  const reponse = await requete.post('/api/formateurs/', { data: { prenom, nom, email } })
  expect(reponse.status(), await reponse.text()).toBe(201)
  return (await reponse.json()).id
}

// Sessions d'une formation du centre, avec ce formateur et un apprenant
async function creerSessions(requete, formateur, nombre) {
  const formation = await requete.post('/api/formations/', { data: { action: 'brouillon', intitule: `Formation ${formateur}`, duree_heures: 7, modalite: 'PRESENTIEL' } })
  expect(formation.status(), await formation.text()).toBe(201)
  const apprenant = await requete.post('/api/apprenants/',
    { data: { prenom: 'Ana', nom: `Apprenante${formateur}`, email: `ana.${formateur}@exemple.fr`, statut: 'PARTICULIER' } })
  for (let i = 1; i <= nombre; i += 1) {
    const reponse = await requete.post('/api/sessions/', { data: {
      formation: (await formation.json()).id, date_debut: `2026-12-0${i}`, date_fin: `2026-12-0${i}`, duree_heures: '7',
      modalite: 'PRESENTIEL', lieu: 'Lyon', lien_classe_virtuelle: '', nombre_places: 5,
      formateurs: [formateur], apprenants: [(await apprenant.json()).id],
    } })
    expect(reponse.status(), await reponse.text()).toBe(201)
  }
}

// Colonne « Sessions » facultative : nombre de sessions du formateur
Given('les formateurs suivants sont enregistrés dans mon centre :', async ({ page }, tableau) => {
  for (const formateur of tableau.hashes()) {
    const id = await enregistrer(page.request, formateur)
    if (Number(formateur.Sessions) > 0) await creerSessions(page.request, id, Number(formateur.Sessions))
  }
})

// Compte et centre à part (le navigateur reste connecté au compte du scénario)
Given('un autre centre a enregistré le formateur {texte}', async ({ request }, nomComplet) => {
  const [prenom, nom] = nomComplet.split(' ')
  await creerCompteParApi(request)
  await enregistrer(request, { Prénom: prenom, Nom: nom, 'E-mail': normaliser(`${prenom}.${nom}@ailleurs.fr`) })
})

When('je tape {texte} dans la recherche des formateurs', async ({ page }, texte) => {
  await page.getByRole('searchbox', { name: 'Rechercher un formateur' }).fill(texte)
})

When('je choisis le statut {texte}', async ({ page }, statut) => {
  await page.getByRole('radio', { name: statut }).check()
})

// Fichier créé pour le test (contenu quelconque), de la taille demandée ; les réponses du backend aux envois
// de documents sont notées pour vérifier ensuite qu'ils sont enregistrés
async function importer(page, champ, fichiers) {
  const d = donnees(page)
  if (!d.documents) {
    d.documents = []
    page.on('response', async (r) => {
      if (/\/formateurs\/\d+\/documents\/$/.test(r.url())) d.documents.push({ statut: r.status(), corps: await r.json().catch(() => null) })
    })
  }
  await page.getByLabel(IMPORT[champ]).setInputFiles(fichiers.map(({ nom, taille = 2048 }) => ({
    name: nom, mimeType: 'application/octet-stream', buffer: Buffer.alloc(taille, 'x'),
  })))
}

When('j\'importe {texte} dans {texte}', async ({ page }, nom, champ) => {
  await importer(page, champ, [{ nom }])
})

When('j\'importe {texte} de {int} Mo dans {texte}', async ({ page }, nom, mo, champ) => {
  await importer(page, champ, [{ nom, taille: mo * MO }])
})

When(/^j'importe dans (CV|Diplômes) : (.+)$/, async ({ page }, champ, liste) => {
  await importer(page, champ, [...liste.matchAll(/«\s?([^»]*?)\s?»/g)].map((m) => ({ nom: m[1] })))
})

When('je retire {texte}', async ({ page }, nom) => {
  await page.getByRole('button', { name: `Retirer ${nom}` }).click()
})

Then(/^(CV|Diplômes) contient (.+)$/, async ({ page }, champ, liste) => {
  const noms = [...liste.matchAll(/«\s?([^»]*?)\s?»/g)].map((m) => m[1])
  await expect(page.getByRole('list', { name: champ }).getByRole('listitem').locator('b')).toHaveText(noms)
})

Then('le refus {texte} s\'affiche sous {texte}', async ({ page }, message, champ) => {
  await expect(page.getByRole('group', { name: champ }).getByRole('alert')).toHaveText(message)
})

Then('la carte affiche {texte}', async ({ page }, titre) => {
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(titre)
})

// Une ligne par formateur : bulle, prénom et nom, e-mail dessous, nombre de sessions
Then('la liste des formateurs affiche, dans l\'ordre :', async ({ page }, tableau) => {
  const attendu = tableau.hashes().map((l) => [l.Nom, l['E-mail'], l.Sessions].join('|'))
  await expect.poll(() => lignes(page).evaluateAll((li) => li.map((l) => {
    const [, nom, sessions] = l.children
    return [nom.querySelector('b').textContent, nom.querySelector('small').textContent, sessions.textContent].join('|')
  }))).toEqual(attendu)
})

Then(/^la liste des formateurs ne contient que (.+)$/, async ({ page }, liste) => {
  const noms = [...liste.matchAll(/«\s?([^»]*?)\s?»/g)].map((m) => m[1])
  await expect.poll(() => lignes(page).evaluateAll((li) => li.map((l) => l.children[1].querySelector('b').textContent))).toEqual(noms)
})

Then('{texte} est en tête de la liste des formateurs, mis en évidence', async ({ page }, nom) => {
  const premiere = lignes(page).first()
  await expect(premiere).toContainText(nom)
  await expect(premiere).toHaveAttribute('aria-current', 'true')
  // Fond « ligne mise en évidence » de la charte (#F0FDFA)
  await expect.poll(() => premiere.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe('rgb(240, 253, 250)')
  await expect(lignes(page).nth(1)).not.toHaveAttribute('aria-current', 'true')
})

Then('le formateur {texte} est enregistré en {texte} avec le NDA {texte}', async ({ page }, email, statut, nda) => {
  const formateur = (await (await page.request.get('/api/formateurs/')).json()).find((f) => f.email === email)
  expect({ statut: formateur?.statut, numero_nda: formateur?.numero_nda }).toEqual({ statut: STATUTS[statut], numero_nda: nda })
})

Then(/^les documents enregistrés sont : (.+)$/, async ({ page }, liste) => {
  const attendus = [...liste.matchAll(/«\s?([^»]*?)\s?» \((CV|DIPLOME)\)/g)].map((m) => `${m[2]} ${m[1]}`)
  await expect.poll(() => donnees(page).documents.filter((d) => d.statut === 201).map((d) => `${d.corps.type} ${d.corps.nom_fichier}`))
    .toEqual(attendus)
})

Then('aucun document n\'est envoyé', async ({ page }) => {
  expect(donnees(page).documents ?? []).toEqual([])
})

When('j\'ouvre l\'onglet {texte}', async ({ page }, nom) => {
  await page.getByRole('tab', { name: new RegExp(`^${nom}`) }).click()
})
