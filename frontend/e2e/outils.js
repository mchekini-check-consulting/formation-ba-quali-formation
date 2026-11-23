// Outils partagés des tests end to end
import { randomUUID } from 'node:crypto'
import { expect } from '@playwright/test'

// Adresse jamais utilisée : la base des tests est commune à tous les tests
export const emailUnique = (prefixe = 'e2e') => `${prefixe}.${randomUUID().slice(0, 8)}@organisme-test.fr`

// Mot de passe tiré au hasard, qui respecte les 5 règles (8 caractères, majuscule, minuscule, chiffre, spécial)
export const motDePasse = () => `Aa1!${randomUUID().slice(0, 8)}`

// Compte créé directement par l'API (sans passer par l'écran) ; `requete` = page.request pour être connecté
// dans ce navigateur, ou le `request` du test pour un compte créé à part
export async function creerCompteParApi(requete, email = emailUnique(), mdp = motDePasse()) {
  const reponse = await requete.post('/api/auth/register',
    { data: { email, mot_de_passe: mdp, confirmation: mdp, cgu_acceptees: true } })
  expect(reponse.status()).toBe(201)
  return { email, mdp }
}

// Crée une formation en brouillon depuis l'écran (seul l'intitulé est obligatoire, RG02)
export async function creerFormationBrouillon(page, intitule) {
  await page.goto('/formations/nouvelle')
  await page.getByLabel('Intitulé de la formation').fill(intitule)
  await page.getByRole('button', { name: 'Enregistrer en brouillon' }).click()
  await expect(page).toHaveURL(/\/formations$/)
  await expect(page.getByText(`« ${intitule} » est enregistrée en brouillon.`)).toBeVisible()
}
