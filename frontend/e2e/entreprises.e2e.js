// Parcours « Créer une entreprise cliente » (SCRUM-113) depuis l'onglet Entreprises clientes de Parties prenantes
import { expect, test } from '@playwright/test'
import { creerCompteParApi } from './outils'

// Réponse de l'annuaire officiel, simulée dans le navigateur : les tests n'appellent jamais l'API de l'État
const ANNUAIRE = [
  { siret: '38945612300034', raison_sociale: 'SOCIETE DURAND', forme_juridique: 'SAS', code_naf: '47.11B',
    adresse: '12 RUE DE LA PAIX', code_postal: '75002', ville: 'PARIS' },
  { siret: '51287496300027', raison_sociale: 'DURAND ET FILS', forme_juridique: 'SARL', code_naf: '',
    adresse: '3 QUAI DU RHONE', code_postal: '69002', ville: 'LYON' },
]

test('créer une entreprise cliente depuis l’annuaire : elle apparaît en tête de liste, mise en évidence', async ({ page }) => {
  await creerCompteParApi(page.request)
  await page.route('**/api/annuaire-entreprises/**', (route) => route.fulfill({ json: ANNUAIRE }))
  await page.goto('/parties-prenantes')
  await page.getByRole('tab', { name: /^Entreprises clientes/ }).click()
  await expect(page.getByText('Aucune entreprise cliente pour le moment')).toBeVisible()

  // Le panneau s'ouvre sur la recherche, « Enregistrer » inactif
  await page.getByRole('button', { name: '+ Nouvelle entreprise cliente' }).click()
  const panneau = page.getByRole('dialog', { name: 'Nouvelle entreprise cliente' })
  await expect(panneau.getByRole('button', { name: 'Enregistrer' })).toBeDisabled()

  // Recherche dans l'annuaire, puis choix d'un établissement : les champs se remplissent
  await panneau.getByLabel('Raison sociale ou SIRET').fill('durand')
  await panneau.getByRole('button', { name: 'Rechercher' }).click()
  await panneau.getByRole('button', { name: /SOCIETE DURAND/ }).click()
  await expect(panneau.getByLabel(/^SIRET/)).toHaveValue('38945612300034')
  await expect(panneau.getByLabel(/^Ville/)).toHaveValue('PARIS')

  // Interlocuteur principal (facultatif), puis enregistrement
  await panneau.getByLabel(/^Prénom/).fill('Hugo')
  await panneau.getByLabel(/^Nom/).fill('Weber')
  await panneau.getByLabel(/^Rôle/).selectOption({ label: 'Ressources humaines' })
  await panneau.getByRole('button', { name: 'Enregistrer' }).click()

  // Le panneau se ferme ; l'entreprise est en tête de liste, mise en évidence, avec ses informations
  await expect(panneau).toHaveCount(0)
  const premiere = page.getByRole('list', { name: 'Entreprises clientes' }).getByRole('listitem').first()
  await expect(premiere).toContainText('SOCIETE DURAND')
  await expect(premiere).toContainText('389 456 123 00034')
  await expect(premiere).toContainText('PARIS')
  await expect(premiere).toContainText('À confirmer')
  await expect(premiere).toContainText('Hugo Weber')
  await expect(premiere).toHaveAttribute('aria-current', 'true')
  await expect(page.getByRole('heading', { level: 2 })).toHaveText('Entreprises clientes · 1')

  // Elle est bien enregistrée par le backend : toujours là après rechargement de la page
  await page.reload()
  await page.getByRole('tab', { name: /^Entreprises clientes/ }).click()
  await expect(page.getByRole('list', { name: 'Entreprises clientes' }).getByRole('listitem')).toHaveCount(1)
})
