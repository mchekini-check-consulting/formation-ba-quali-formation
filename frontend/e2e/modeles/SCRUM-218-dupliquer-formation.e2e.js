// Parcours « Dupliquer un modèle générique pour une formation » (SCRUM-218) : dupliquer la Convocation pour une
// formation, enregistrer, puis vérifier qu'elle n'est plus proposée (RG16) ; rien n'est créé avant « Enregistrer » (RG8)
import { expect, test } from '@playwright/test'
import { creerCompteParApi, creerFormationBrouillon } from '../outils'

test('dupliquer la Convocation pour une formation, enregistrer : la formation n’est plus proposée', async ({ page }) => {
  await creerCompteParApi(page.request)
  await creerFormationBrouillon(page, 'Management d’équipe')
  await creerFormationBrouillon(page, 'Excel intermédiaire')
  const creations = []
  page.on('request', (r) => { if (r.method() === 'POST' && /\/formations\/\d+\/modeles\//.test(r.url())) creations.push(r.url()) })

  // CA1 : fenêtre « Dupliquer » avec les formations sans modèle de convocation
  await page.goto('/modeles/generiques')
  const carte = page.getByRole('article', { name: 'Convocation' })
  await carte.getByRole('button', { name: 'Dupliquer' }).click()
  let fenetre = page.getByRole('dialog', { name: 'Dupliquer « Convocation »' })
  const liste = fenetre.getByRole('combobox', { name: 'Formation' })
  await expect(liste.getByRole('option')).toHaveText(['Excel intermédiaire', 'Management d’équipe'])
  await liste.selectOption({ label: 'Management d’équipe' })
  await fenetre.getByRole('button', { name: 'Créer le modèle de la formation' }).click()

  // CA2 : l'éditeur contient le modèle générique, avec le bandeau ; rien n'est encore créé (RG8)
  const document = page.getByRole('textbox', { name: 'Convocation' })
  await expect(document).toContainText('CONVOCATION')
  await expect(page.getByRole('status')).toContainText('Nouveau modèle de la formation « Management d’équipe », créé à partir du modèle générique.')
  expect(creations).toEqual([])

  // CA4 : « Enregistrer » crée le modèle de la formation ; message, retour aux modèles génériques
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Modèle de la formation « Management d’équipe » créé. Il remplace le modèle générique pour les sessions de cette formation.')).toBeVisible()
  await expect(page).toHaveURL(/\/modeles\/generiques$/)
  expect(creations).toHaveLength(1)

  // CA5 / RG16 : la formation n'est plus proposée pour la convocation
  await carte.getByRole('button', { name: 'Dupliquer' }).click()
  fenetre = page.getByRole('dialog', { name: 'Dupliquer « Convocation »' })
  await expect(fenetre.getByRole('combobox', { name: 'Formation' }).getByRole('option')).toHaveText(['Excel intermédiaire'])
  await expect(fenetre).toContainText('Modèle de la formation déjà créé pour : Management d’équipe.')
  // Le modèle générique, lui, ne change pas (RG15)
  await fenetre.getByRole('button', { name: 'Annuler' }).click()
  await expect(carte).toContainText('Modèle d’origine')
})
