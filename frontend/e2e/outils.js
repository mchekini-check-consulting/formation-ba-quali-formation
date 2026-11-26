// Outils partagés des tests end to end
import { randomUUID } from 'node:crypto'
import { expect } from '@playwright/test'

// Adresse jamais utilisée : la base des tests est commune à tous les tests
export const emailUnique = (prefixe = 'e2e') => `${prefixe}.${randomUUID().slice(0, 8)}@organisme-test.fr`

// Mot de passe tiré au hasard, qui respecte les 5 règles (8 caractères, majuscule, minuscule, chiffre, spécial)
// SIRET tiré au hasard (14 chiffres) : un seul centre par SIRET (SCRUM-221, critère 8)
export const siretUnique = () => `9${Array.from(randomUUID().replaceAll('-', '').slice(0, 13), (c) => parseInt(c, 16) % 10).join('')}`

export const motDePasse = () => `Aa1!${randomUUID().slice(0, 8)}`

// Compte créé directement par l'API (sans passer par l'écran) ; `requete` = page.request pour être connecté
// dans ce navigateur, ou le `request` du test pour un compte créé à part.
// SCRUM-221 : le centre est aussi renseigné (sinon l'application reste sur le formulaire de première connexion),
// sauf avec { centre: false }
export async function creerCompteParApi(requete, email = emailUnique(), mdp = motDePasse(), { centre = true } = {}) {
  const reponse = await requete.post('/api/auth/register',
    { data: { email, mot_de_passe: mdp, confirmation: mdp, cgu_acceptees: true } })
  expect(reponse.status()).toBe(201)
  if (centre) await renseignerCentreParApi(requete)
  return { email, mdp }
}

// Formulaire de première connexion (SCRUM-221) enregistré par l'API, avec les seules informations obligatoires
export async function renseignerCentreParApi(requete, raisonSociale = 'Centre de test', siret = siretUnique()) {
  const reponse = await requete.post('/api/organisme/', { data: {
    raison_sociale: raisonSociale, siret, adresse: '12 rue des Lilas, 75011 Paris',
    prenom: 'Marie', nom: 'Arnaud',
  } })
  expect(reponse.status(), await reponse.text()).toBe(201)
}

// Crée une formation en brouillon depuis l'écran (seul l'intitulé est obligatoire, RG02)
export async function creerFormationBrouillon(page, intitule) {
  await page.goto('/formations/nouvelle')
  await page.getByLabel('Intitulé de la formation').fill(intitule)
  await page.getByRole('button', { name: 'Enregistrer en brouillon' }).click()
  await expect(page).toHaveURL(/\/formations$/)
  await expect(page.getByText(`« ${intitule} » est enregistrée en brouillon.`)).toBeVisible()
}
