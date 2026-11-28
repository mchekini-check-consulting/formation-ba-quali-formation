// Parcours « Utiliser le bon modèle pour générer les documents d'une session » (SCRUM-220) : la formation a son
// modèle de convocation (RG20), génération des convocations, téléchargement du PDF, document figé (RG22),
// « Générer à nouveau » avec confirmation, convention refusée sans entreprise cliente
import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { creerCompteParApi, creerFormationBrouillon, emailUnique } from '../outils'

async function creer(requete, chemin, data) {
  const reponse = await requete.post(`/api${chemin}`, { data })
  expect(reponse.status(), await reponse.text()).toBe(201)
  return reponse.json()
}

// EN PAUSE depuis SCRUM-168 : la fiche session remplace la page session de la 220 (onglet Documents « Bientôt
// disponible »). À réactiver (test.skip -> test) quand l'onglet Documents de la fiche affichera les documents.
// Le backend de la 220 reste vérifié par test_documents_session.py.
test.skip('générer les convocations avec le modèle de la formation, télécharger, document figé, générer à nouveau', async ({ page }) => {
  await creerCompteParApi(page.request)
  await creerFormationBrouillon(page, 'Excel intermédiaire')
  const [formation] = await (await page.request.get('/api/formations/')).json()
  const formateur = await creer(page.request, '/formateurs/', { prenom: 'Nadia', nom: 'Benali', email: emailUnique('formatrice') })
  const apprenant = await creer(page.request, '/apprenants/', { prenom: 'Camille', nom: 'Dupont', email: emailUnique('apprenant'), statut: 'INDEPENDANT' })
  await creer(page.request, '/sessions/', {
    formation: formation.id, date_debut: '2027-01-12', date_fin: '2027-01-13', duree_heures: '14', modalite: 'PRESENTIEL',
    lieu: 'Lyon, salle A', nombre_places: 8, formateurs: [formateur.id], apprenants: [apprenant.id],
  })
  // La formation a son propre modèle de convocation (SCRUM-218)
  await creer(page.request, `/formations/${formation.id}/modeles/CONVOCATION/`, {
    contenu: '<h1>CONVOCATION EXCEL</h1><p>Bonjour {{apprenant_prenom}} {{apprenant_nom}}, rendez-vous le {{session_date_debut}}.</p>',
  })

  // Le planning ouvre la page de la session, onglet Documents
  await page.goto('/sessions')
  await page.getByRole('link', { name: /Excel intermédiaire/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Excel intermédiaire' })).toBeVisible()
  const ligne = (nom) => page.getByRole('row').filter({ has: page.locator('b', { hasText: new RegExp(`^${nom}$`) }) })

  // CA1 / CA2 (RG20) : « Modèle de la formation » pour la convocation, « Modèle générique » pour le contrat
  await expect(ligne('Convocation')).toContainText('Modèle de la formation')
  await expect(ligne('Contrat de formation')).toContainText('Modèle générique')

  // Générer : une convocation pour l'apprenant
  await ligne('Convocation').getByRole('button', { name: 'Générer' }).click()
  await expect(page.getByText('1 document généré.')).toBeVisible()
  await expect(ligne('Convocation')).toContainText('Généré')
  const telecharger = page.getByRole('button', { name: 'Télécharger Convocation - Camille Dupont' })

  // CA3 : le PDF téléchargé (nom de l'apprenant et date de la session dans le document figé)
  const [premier] = await Promise.all([page.waitForEvent('download'), telecharger.click()])
  expect(premier.suggestedFilename()).toMatch(/^Convocation - Camille Dupont - CVC-\d{4}-\d{4}\.pdf$/)
  const pdf = await readFile(await premier.path())
  expect(pdf.subarray(0, 4).toString()).toBe('%PDF')

  // CA5 (RG22) : le modèle de la formation est modifié ensuite : le document déjà généré ne change pas
  const put = await page.request.put(`/api/formations/${formation.id}/modeles/CONVOCATION/`,
    { data: { contenu: '<h1>NOUVELLE CONVOCATION</h1>' } })
  expect(put.status()).toBe(200)
  await page.reload()
  const [second] = await Promise.all([page.waitForEvent('download'), telecharger.click()])
  expect(Buffer.compare(await readFile(await second.path()), pdf)).toBe(0)

  // « Générer à nouveau » : confirmation ; « Annuler » ne change rien, puis nouvelle version avec le modèle actuel
  await ligne('Convocation').getByRole('button', { name: 'Générer à nouveau' }).click()
  const fenetre = page.getByRole('dialog')
  await expect(fenetre).toContainText('Les convocations déjà générées pour cette session seront remplacées par de nouvelles versions, créées avec le modèle actuel.')
  await fenetre.getByRole('button', { name: 'Annuler' }).click()
  await ligne('Convocation').getByRole('button', { name: 'Générer à nouveau' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Générer à nouveau' }).click()
  await expect(page.getByText('1 document généré.')).toBeVisible()
  const [troisieme] = await Promise.all([page.waitForEvent('download'), telecharger.click()])
  expect(Buffer.compare(await readFile(await troisieme.path()), pdf)).not.toBe(0)

  // Convention : apprenant sans entreprise cliente : message, rien n'est généré
  await ligne('Convention de formation').getByRole('button', { name: 'Générer' }).click()
  await expect(page.getByRole('alert')).toHaveText('Aucun apprenant de cette session n’est rattaché à une entreprise cliente : pas de convention à générer. Pour un particulier qui finance lui-même sa formation, générez le contrat de formation.')
  await expect(ligne('Convention de formation')).toContainText('À générer')
})
