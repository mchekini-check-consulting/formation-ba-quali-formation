import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../App'
import { adresseExportWord, nomFichierWord, telechargerWord } from './serviceApi'

// SCRUM-216 « Télécharger un modèle en Word » : téléchargement simulé (fetch, lien de téléchargement)
const CATALOGUE = [{ code: 'apprenant_nom', libelle: 'Nom', categorie: 'Apprenant', exemple: 'Martin' }]
const MODELE = { type: 'CONVENTION', nom: 'Convention de formation', statut: 'PERSONNALISE', contenu: '<p>Texte {{apprenant_nom}}</p>',
  variables: [{ code: 'apprenant_nom', libelle: 'Nom' }] }
const ok = (json) => ({ ok: true, status: 200, json: async () => json })
const WORD = new Blob(['PK'], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })

function simulerBackend({ exporter = () => ({ ok: true, status: 200, blob: async () => WORD }) } = {}) {
  const fetchMock = vi.fn(async (url, options = {}) => {
    if (url.endsWith('/auth/moi')) return ok({ id: 1, email: 'camille@organisme.fr' })
    if (url.endsWith('/variables/')) return ok(CATALOGUE)
    if (url.endsWith('/export.docx')) return exporter()
    if (url.endsWith('/modeles/CONVENTION/import')) return ok({ contenu: '<p>Bonjour {{apprenant_nom}}</p>', nom_fichier: 'Modèle - Convention de formation.docx' })
    if (url.endsWith('/modeles/CONVENTION') && options.method === 'PUT') {
      return ok({ ...MODELE, nb_formations_utilisant: 0, nb_formations: 0 })
    }
    if (url.endsWith('/modeles/convention')) return ok(MODELE)
    return ok([])
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

let telecharges
beforeAll(() => {
  const vide = () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] })
  Range.prototype.getClientRects ??= vide
  Range.prototype.getBoundingClientRect ??= () => new DOMRect()
})
beforeEach(() => {
  telecharges = []
  URL.createObjectURL = vi.fn(() => 'blob:word')
  URL.revokeObjectURL = vi.fn()
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function clic() {
    telecharges.push({ nom: this.download, adresse: this.href })
  })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

async function ouvrir(options) {
  const fetchMock = simulerBackend(options)
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/modeles/generiques/convention'] })} />)
  await screen.findByRole('textbox', { name: 'Convention de formation' })
  return fetchMock
}
const bouton = () => screen.getByRole('button', { name: 'Télécharger en Word' })
const exports = (fetchMock) => fetchMock.mock.calls.filter(([u]) => u.endsWith('/modeles/CONVENTION/export.docx'))
const editeur = () => screen.getByRole('textbox', { name: 'Convention de formation' }).editor

describe('Télécharger un modèle en Word (SCRUM-216)', () => {
  it('CA1 : un clic télécharge « Modèle - <nom du document>.docx », accents compris, sans fenêtre', async () => {
    const fetchMock = await ouvrir()
    fireEvent.click(bouton())
    await waitFor(() => expect(telecharges).toEqual([{ nom: 'Modèle - Convention de formation.docx', adresse: 'blob:word' }]))
    expect(exports(fetchMock)).toHaveLength(1)
    expect(exports(fetchMock)[0][1]).toEqual({ credentials: 'include' }) // connecté (cookie), en GET
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(bouton().disabled).toBe(false)
  })

  it('modification non enregistrée : fenêtre de confirmation ; « Annuler » ne télécharge rien', async () => {
    const fetchMock = await ouvrir()
    act(() => { editeur().commands.insertContent(' ajout') })
    fireEvent.click(bouton())
    const fenetre = screen.getByRole('dialog')
    expect(within(fenetre).getByRole('heading', { name: 'Modifications non enregistrées' })).toBeTruthy()
    expect(fenetre.textContent).toContain('Le fichier Word contiendra la dernière version enregistrée, sans vos modifications. Enregistrez d’abord pour les inclure.')
    fireEvent.click(within(fenetre).getByRole('button', { name: 'Annuler' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(exports(fetchMock)).toHaveLength(0)
    expect(telecharges).toEqual([])
  })

  it('« Télécharger quand même » télécharge la version enregistrée ; après « Enregistrer », plus de fenêtre', async () => {
    const fetchMock = await ouvrir()
    act(() => { editeur().commands.insertContent(' ajout') })
    fireEvent.click(bouton())
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Télécharger quand même' }))
    await waitFor(() => expect(telecharges).toHaveLength(1))
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await screen.findByText('Modèle générique enregistré.')
    fireEvent.click(bouton())
    await waitFor(() => expect(telecharges).toHaveLength(2))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(exports(fetchMock)).toHaveLength(2)
  })

  it('import Word pas encore enregistré : fenêtre de confirmation', async () => {
    await ouvrir()
    fireEvent.change(screen.getByLabelText('Utiliser mon propre document Word'),
      { target: { files: [new File(['x'], 'Modèle - Convention de formation.docx')] } })
    await screen.findByRole('heading', { name: /Votre document est importé/ })
    fireEvent.click(bouton())
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('CA4 : le Word exporté puis réimporté affiche ses {{code}} en étiquettes', async () => {
    await ouvrir()
    fireEvent.change(screen.getByLabelText('Utiliser mon propre document Word'),
      { target: { files: [new File(['x'], 'Modèle - Convention de formation.docx')] } })
    await screen.findByRole('heading', { name: /Votre document est importé/ })
    const document = screen.getByRole('textbox', { name: 'Convention de formation' })
    expect([...document.querySelectorAll('.doc-variable')].map((e) => e.textContent)).toEqual(['Nom'])
    expect(document.textContent).not.toContain('{{')
  })

  it('erreur du serveur : message clair, aucun fichier', async () => {
    await ouvrir({ exporter: () => ({ ok: false, status: 500, json: async () => ({ code: 'EXPORT_IMPOSSIBLE', detail: 'Le fichier Word n’a pas pu être créé. Réessayez.' }) }) })
    fireEvent.click(bouton())
    expect((await screen.findByRole('alert')).textContent).toBe('Le fichier Word n’a pas pu être créé. Réessayez.')
    expect(telecharges).toEqual([])
    expect(bouton().disabled).toBe(false)
  })

  it('« Téléchargement… » et bouton inactif pendant l’envoi', async () => {
    let repondre
    await ouvrir({ exporter: () => new Promise((r) => { repondre = r }) })
    fireEvent.click(bouton())
    const enCours = await screen.findByRole('button', { name: 'Téléchargement…' })
    expect(enCours.disabled).toBe(true)
    await act(async () => { repondre({ ok: true, status: 200, blob: async () => WORD }) })
    await waitFor(() => expect(telecharges).toHaveLength(1))
    expect(bouton().disabled).toBe(false)
  })
})

describe('telechargerWord (réutilisable, SCRUM-219)', () => {
  it('adresse et nom du fichier', () => {
    expect(adresseExportWord('CONVENTION')).toBe('/modeles/CONVENTION/export.docx')
    expect(nomFichierWord('Attestation de fin de formation')).toBe('Modèle - Attestation de fin de formation.docx')
  })

  it('serveur injoignable ou réponse sans message : message clair', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    await expect(telechargerWord('/x.docx', 'x.docx')).rejects.toThrow('Le serveur ne répond pas')
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 502, json: async () => { throw new Error() } })))
    await expect(telechargerWord('/x.docx', 'x.docx')).rejects.toThrow('Le fichier Word n’a pas pu être téléchargé. Réessayez.')
    expect(telecharges).toEqual([])
  })
})
