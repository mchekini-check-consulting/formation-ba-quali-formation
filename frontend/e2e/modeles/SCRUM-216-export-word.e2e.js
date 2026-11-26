// Parcours « Télécharger un modèle en Word » (SCRUM-216) : téléchargement de la Convention, nom du fichier,
// variables écrites {{code}} dans le Word (RG9), puis réimport (SCRUM-215) : les variables redeviennent des étiquettes
import { readFile } from 'node:fs/promises'
import { inflateRawSync } from 'node:zlib'
import { expect, test } from '@playwright/test'
import { creerCompteParApi } from '../outils'

// Un fichier d'une archive .docx (zip), lu par son répertoire central
function lireDansZip(archive, chemin) {
  const fin = archive.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  let position = archive.readUInt32LE(fin + 16)
  for (let i = 0; i < archive.readUInt16LE(fin + 10); i += 1) {
    const methode = archive.readUInt16LE(position + 10)
    const taille = archive.readUInt32LE(position + 20)
    const longueurNom = archive.readUInt16LE(position + 28)
    const suite = longueurNom + archive.readUInt16LE(position + 30) + archive.readUInt16LE(position + 32)
    const entete = archive.readUInt32LE(position + 42)
    if (archive.toString('utf8', position + 46, position + 46 + longueurNom) === chemin) {
      const debut = entete + 30 + archive.readUInt16LE(entete + 26) + archive.readUInt16LE(entete + 28)
      const donnees = archive.subarray(debut, debut + taille)
      return (methode === 8 ? inflateRawSync(donnees) : donnees).toString('utf8')
    }
    position += 46 + suite
  }
  throw new Error(`${chemin} absent de l'archive`)
}

test('télécharger la Convention en Word : bon nom, variables {{code}}, réimport en étiquettes', async ({ page }) => {
  await creerCompteParApi(page.request)
  await page.goto('/modeles/generiques/convention')
  const document = page.getByRole('textbox', { name: 'Convention de formation' })
  await expect(document).toContainText('CONVENTION DE FORMATION PROFESSIONNELLE')

  // CA1 : le fichier .docx est téléchargé avec le bon nom (accents compris)
  const [telechargement] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Télécharger en Word' }).click(),
  ])
  expect(telechargement.suggestedFilename()).toBe('Modèle - Convention de formation.docx')
  const fichier = await readFile(await telechargement.path())

  // CA2 + CA3 : le Word contient le texte, ses titres, et les variables sous la forme {{code}} (RG9)
  const xml = lireDansZip(fichier, 'word/document.xml')
  expect(xml).toContain('CONVENTION DE FORMATION PROFESSIONNELLE')
  expect(xml).toContain('w:val="Heading1"')
  expect(xml).toContain('{{org_nom}}')
  expect(xml).toContain('{{formation_intitule}}')

  // CA4 : réimporté, le fichier retrouve ses variables en étiquettes
  await page.getByLabel('Utiliser mon propre document Word').setInputFiles({
    name: telechargement.suggestedFilename(), buffer: fichier,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
  await expect(page.getByRole('heading', { name: /Votre document est importé/ })).toBeVisible()
  await expect(document.getByRole('heading', { level: 1 })).toHaveText('CONVENTION DE FORMATION PROFESSIONNELLE')
  await expect(document.locator('.doc-variable').first()).toBeVisible()
  await expect(document).not.toContainText('{{')
  await expect(document.locator('.doc-variable', { hasText: 'Intitulé de la formation' }).first()).toBeVisible()

  // Import pas encore enregistré : fenêtre de confirmation avant de télécharger
  await page.getByRole('button', { name: 'Télécharger en Word' }).click()
  const fenetre = page.getByRole('dialog')
  await expect(fenetre.getByRole('heading', { name: 'Modifications non enregistrées' })).toBeVisible()
  await fenetre.getByRole('button', { name: 'Annuler' }).click()
  await expect(fenetre).toHaveCount(0)
})
