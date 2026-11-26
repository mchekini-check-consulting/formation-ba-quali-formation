import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../App'
import {
  messageFichiersNonEnregistres, MSG_NDA, tailleFr, TAILLE_MAX, trierFichiers, verifierFormateur,
} from '../formateurs/formateurs'
import { installerFauxBackend, repondre } from '../sessions/fauxBackend'

// SCRUM-119 : onglet Formateurs de Parties prenantes et fenêtre « Nouveau formateur » complétée (statut, NDA, documents)
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

function afficher(page = '/parties-prenantes') {
  const router = createMemoryRouter(routes, { initialEntries: [page] })
  render(<RouterProvider router={router} />)
}
async function ouvrirOnglet() {
  afficher()
  fireEvent.click(screen.getByRole('tab', { name: /^Formateurs/ }))
  return within(await screen.findByRole('list', { name: 'Formateurs' })).getAllByRole('listitem')
}
const lignes = () => within(screen.getByRole('list', { name: 'Formateurs' })).getAllByRole('listitem')
const bouton = (nom) => screen.getByRole('button', { name: nom })
const saisir = (label, valeur) => fireEvent.change(screen.getByLabelText(new RegExp(`^${label}`)), { target: { value: valeur } })
const rechercher = (texte) => fireEvent.change(screen.getByRole('searchbox', { name: 'Rechercher un formateur' }), { target: { value: texte } })
const panneau = () => screen.queryByRole('dialog', { name: 'Nouveau formateur' })
const fichier = (nom, taille = 1000) => {
  const f = new File(['x'], nom)
  Object.defineProperty(f, 'size', { value: taille })
  return f
}
const importer = (libelle, ...fichiers) => fireEvent.change(screen.getByLabelText(libelle), { target: { files: fichiers } })
const posts = (fetch, fin) => fetch.mock.calls.filter(([url, o]) => url.endsWith(fin) && o?.method === 'POST')
const documentsEnvoyes = (fetch) => fetch.mock.calls.filter(([url]) => /\/formateurs\/\d+\/documents\/$/.test(url))
  .map(([url, o]) => [url.replace(/^\/api/, ''), o.body.get('type'), o.body.get('fichier').name])

async function ouvrirFenetre() {
  await ouvrirOnglet()
  fireEvent.click(bouton('+ Nouveau formateur'))
}
function remplirIdentite() {
  saisir('Prénom', 'Marc')
  saisir('Nom', 'Garnier')
  saisir('E-mail', 'marc.garnier@exemple.fr')
}

describe('Liste des formateurs (SCRUM-119)', () => {
  it('CA1 : une ligne par formateur triée par nom, avec bulle, e-mail et nombre de sessions ; carte « Formateurs · N »', async () => {
    installerFauxBackend()
    const formateurs = await ouvrirOnglet()
    expect(screen.getByRole('tab', { name: /^Formateurs/ }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Formateurs · 2')
    expect(formateurs.map((l) => l.textContent)).toEqual([
      'SDSarah Duboissarah.dubois@exemple.fr3 sessions', 'JLJulien Lefèvrejulien.lefevre@exemple.fr1 session'])
    expect(formateurs[0].querySelector('.bulle').className).toBe('bulle bulle-1')
    expect(screen.getByRole('searchbox').getAttribute('placeholder')).toBe('Rechercher par nom ou e-mail')
  })

  it('CA2 : la recherche ne garde que les formateurs dont le nom ou l’e-mail contient le texte ; le total ne change pas', async () => {
    const fetch = installerFauxBackend()
    await ouvrirOnglet()
    rechercher('DUBOIS')
    await waitFor(() => expect(lignes().map((l) => l.querySelector('b').textContent)).toEqual(['Sarah Dubois']))
    expect(fetch.mock.calls.some(([url]) => url.endsWith('/formateurs/?recherche=DUBOIS'))).toBe(true)
    rechercher('cap conseil') // l'entreprise n'est pas cherchée
    expect(await screen.findByText('Aucun formateur ne correspond à votre recherche.')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Formateurs · 2')
  })

  it('CA3 : aucun formateur, un message invite à en ajouter un', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => (url.endsWith('/auth/moi') ? repondre(401, {}) : repondre(200, []))))
    afficher()
    fireEvent.click(screen.getByRole('tab', { name: /^Formateurs/ }))
    expect(await screen.findByRole('heading', { name: 'Aucun formateur pour le moment' })).toBeTruthy()
    expect(screen.getByText('Ajoutez votre premier formateur avec « + Nouveau formateur ».')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Formateurs · 0')
  })

  it('le chargement échoue : message d’erreur', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('hors ligne') }))
    afficher()
    fireEvent.click(screen.getByRole('tab', { name: /^Formateurs/ }))
    expect(await screen.findByText(/Le serveur ne répond pas/)).toBeTruthy()
  })
})

describe('Fenêtre « Nouveau formateur » (SCRUM-119)', () => {
  it('trois sections : Identité, Statut, Documents ; statut facultatif', async () => {
    installerFauxBackend()
    await ouvrirFenetre()
    const p = within(panneau())
    expect(p.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Identité', 'Statut', 'Documents'])
    expect(p.getAllByRole('radio').map((r) => r.parentElement.textContent)).toEqual(['Salarié', 'Sous-traitant'])
    expect(p.getAllByText('Glissez un fichier ici ou', { exact: false })).toHaveLength(2)
    expect(p.getAllByText('Facultatif · PDF, JPG, PNG ou Word · 10 Mo maximum')).toHaveLength(2)
  })

  it('CA4 : le NDA n’apparaît que pour « Sous-traitant »', async () => {
    installerFauxBackend()
    await ouvrirFenetre()
    const nda = () => screen.queryByLabelText('N° de déclaration d’activité (NDA)')
    expect(nda()).toBeNull()
    fireEvent.click(screen.getByRole('radio', { name: 'Sous-traitant' }))
    expect(nda()).toBeTruthy()
    expect(screen.getByText('Facultatif · 11 chiffres')).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: 'Salarié' }))
    expect(nda()).toBeNull()
  })

  it('CA5 : un NDA qui n’a pas 11 chiffres est signalé et rien n’est enregistré', async () => {
    const fetch = installerFauxBackend()
    await ouvrirFenetre()
    remplirIdentite()
    fireEvent.click(screen.getByRole('radio', { name: 'Sous-traitant' }))
    saisir('N° de déclaration', '1175654321')
    fireEvent.click(bouton('Enregistrer'))
    expect(document.getElementById('frm-numero_nda-err').textContent).toBe(MSG_NDA)
    expect(screen.getByLabelText(/^N° de déclaration/).getAttribute('aria-invalid')).toBe('true')
    expect(posts(fetch, '/formateurs/')).toHaveLength(0)
    expect(panneau()).toBeTruthy()
  })

  it('CA6 : un autre format, plus de 10 Mo, un 2e CV ou un 6e diplôme sont refusés avec un message', async () => {
    installerFauxBackend()
    await ouvrirFenetre()
    const refus = (titre) => within(screen.getByRole('group', { name: titre })).getByRole('alert').textContent
    importer('Importer un CV', fichier('CV_complet.zip'))
    expect(screen.getByRole('alert').textContent).toBe('« CV_complet.zip » refusé : format non accepté (PDF, JPG, PNG ou Word)')
    importer('Importer un CV', fichier('CV.pdf'), fichier('Autre_CV.pdf'))
    expect(refus('CV')).toBe('« Autre_CV.pdf » refusé : 1 CV maximum')
    // Le CV ajouté remplace la zone d'import
    expect(screen.queryByLabelText('Importer un CV')).toBeNull()
    importer('Importer un diplôme', fichier('Scan.pdf', TAILLE_MAX + 1))
    expect(refus('Diplômes')).toBe('« Scan.pdf » refusé : plus de 10 Mo')
    importer('Importer un diplôme', ...['A.pdf', 'B.jpg', 'C.png', 'D.doc', 'E.docx', 'Habilitation.pdf'].map((n) => fichier(n)))
    expect(refus('Diplômes')).toBe('« Habilitation.pdf » refusé : 5 diplômes maximum')
    expect(within(screen.getByRole('list', { name: 'Diplômes' })).getAllByRole('listitem')).toHaveLength(5)
  })

  it('les fichiers ajoutés s’affichent avec leur nom et leur taille, et se retirent ; glisser-déposer', async () => {
    installerFauxBackend()
    await ouvrirFenetre()
    importer('Importer un CV', fichier('CV_Marc_Garnier.pdf', 420 * 1024))
    const cv = within(screen.getByRole('list', { name: 'CV' })).getByRole('listitem')
    expect(cv.textContent).toBe('CV_Marc_Garnier.pdf420 Ko')
    fireEvent.click(bouton('Retirer CV_Marc_Garnier.pdf'))
    expect(screen.queryByRole('list', { name: 'CV' })).toBeNull()
    expect(screen.getByLabelText('Importer un CV')).toBeTruthy()
    const zone = screen.getByTestId('frm-diplome-zone')
    fireEvent.dragOver(zone)
    expect(zone.className).toContain('survol')
    fireEvent.dragLeave(zone)
    fireEvent.drop(zone, { dataTransfer: { files: [fichier('Master.pdf', 1.2 * 1024 * 1024)] } })
    expect(within(screen.getByRole('list', { name: 'Diplômes' })).getByRole('listitem').textContent).toBe('Master.pdf1,2 Mo')
  })

  it('« Annuler » n’enregistre rien, ni le formateur ni ses fichiers', async () => {
    const fetch = installerFauxBackend()
    await ouvrirFenetre()
    remplirIdentite()
    importer('Importer un CV', fichier('CV.pdf'))
    fireEvent.click(bouton('Annuler'))
    expect(panneau()).toBeNull()
    expect(posts(fetch, '/formateurs/')).toHaveLength(0)
    expect(documentsEnvoyes(fetch)).toEqual([])
  })

  it('CA7 : enregistré avec statut, NDA, CV et diplômes, il apparaît en tête de liste, mis en évidence', async () => {
    const fetch = installerFauxBackend()
    await ouvrirFenetre()
    remplirIdentite()
    fireEvent.click(screen.getByRole('radio', { name: 'Sous-traitant' }))
    saisir('N° de déclaration', '117 565 432 10')
    importer('Importer un CV', fichier('CV_Marc_Garnier.pdf'))
    importer('Importer un diplôme', fichier('Master_Management.pdf'), fichier('Titre_Formateur_FPA.jpg'))
    fireEvent.click(bouton('Enregistrer'))
    await waitFor(() => expect(panneau()).toBeNull())
    expect(JSON.parse(posts(fetch, '/formateurs/')[0][1].body)).toEqual({
      prenom: 'Marc', nom: 'Garnier', email: 'marc.garnier@exemple.fr', statut: 'SOUS_TRAITANT', numero_nda: '117 565 432 10',
    })
    expect(documentsEnvoyes(fetch)).toEqual([
      ['/formateurs/50/documents/', 'CV', 'CV_Marc_Garnier.pdf'],
      ['/formateurs/50/documents/', 'DIPLOME', 'Master_Management.pdf'],
      ['/formateurs/50/documents/', 'DIPLOME', 'Titre_Formateur_FPA.jpg'],
    ])
    await waitFor(() => expect(lignes()).toHaveLength(3))
    expect(lignes()[0].textContent).toContain('Marc Garnier')
    expect(lignes()[0].getAttribute('aria-current')).toBe('true')
    expect(lignes()[0].className).toContain('app-ligne-nouvelle')
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Formateurs · 3')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('ajouté pendant une recherche : la recherche est vidée pour le montrer ; NDA non envoyé pour un salarié', async () => {
    const fetch = installerFauxBackend()
    await ouvrirOnglet()
    rechercher('dubois')
    await waitFor(() => expect(lignes()).toHaveLength(1))
    fireEvent.click(bouton('+ Nouveau formateur'))
    remplirIdentite()
    fireEvent.click(screen.getByRole('radio', { name: 'Sous-traitant' }))
    saisir('N° de déclaration', '11756543210')
    fireEvent.click(screen.getByRole('radio', { name: 'Salarié' }))
    fireEvent.click(bouton('Enregistrer'))
    await waitFor(() => expect(lignes()).toHaveLength(3))
    expect(screen.getByRole('searchbox').value).toBe('')
    expect(JSON.parse(posts(fetch, '/formateurs/')[0][1].body).numero_nda).toBe('')
  })

  it('un fichier non enregistré : le formateur reste créé et un bandeau nomme le fichier', async () => {
    installerFauxBackend({
      reponseDocument: (type, f) => (f.name === 'Titre.jpg' ? repondre(400, { code: 'X', detail: 'refusé' }) : repondre(201, {})),
    })
    await ouvrirFenetre()
    remplirIdentite()
    importer('Importer un CV', fichier('CV.pdf'))
    importer('Importer un diplôme', fichier('Titre.jpg'))
    fireEvent.click(bouton('Enregistrer'))
    expect((await screen.findByRole('alert')).textContent)
      .toBe('Le formateur « Marc Garnier » a été créé, mais le fichier « Titre.jpg » n’a pas été enregistré.')
    expect(lignes()[0].textContent).toContain('Marc Garnier')
    fireEvent.click(bouton('Fermer le message'))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('serveur injoignable pendant l’envoi des fichiers : tous sont signalés', async () => {
    const fetch = installerFauxBackend()
    const normal = fetch.getMockImplementation()
    fetch.mockImplementation(async (url, o) => {
      if (url.includes('/documents/')) throw new Error('hors ligne')
      return normal(url, o)
    })
    await ouvrirFenetre()
    remplirIdentite()
    importer('Importer un diplôme', fichier('A.pdf'), fichier('B.pdf'))
    fireEvent.click(bouton('Enregistrer'))
    expect((await screen.findByRole('alert')).textContent)
      .toBe('Le formateur « Marc Garnier » a été créé, mais ces fichiers n’ont pas été enregistrés : « A.pdf », « B.pdf ».')
  })

  it('erreurs du serveur à la création : sous le champ, ou en encadré ; aucun fichier n’est envoyé', async () => {
    let reponse = repondre(400, { numero_nda: [MSG_NDA] })
    const fetch = installerFauxBackend({ reponsePersonne: () => reponse })
    await ouvrirFenetre()
    remplirIdentite()
    fireEvent.click(screen.getByRole('radio', { name: 'Sous-traitant' }))
    importer('Importer un CV', fichier('CV.pdf'))
    fireEvent.click(bouton('Enregistrer'))
    await waitFor(() => expect(document.getElementById('frm-numero_nda-err').textContent).toBe(MSG_NDA))
    reponse = repondre(500, null)
    fireEvent.click(bouton('Enregistrer'))
    await waitFor(() => expect(within(panneau()).getByRole('alert').textContent).toBe('Certaines informations sont invalides.'))
    expect(documentsEnvoyes(fetch)).toEqual([])
  })

  it('depuis Sessions et planning : même fenêtre, confirmation et bandeau des fichiers non enregistrés', async () => {
    installerFauxBackend({ reponseDocument: () => repondre(400, { code: 'X', detail: 'refusé' }) })
    afficher('/sessions')
    fireEvent.click(await screen.findByRole('button', { name: /Parties prenantes/ }))
    fireEvent.click(screen.getByRole('menuitem', { name: /Nouveau formateur/ }))
    expect(within(panneau()).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Identité', 'Statut', 'Documents'])
    remplirIdentite()
    importer('Importer un CV', fichier('CV.pdf'))
    fireEvent.click(bouton('Enregistrer'))
    expect((await screen.findByRole('status')).textContent).toContain('Le formateur « Marc Garnier » a été créé.')
    expect(screen.getByRole('alert').textContent).toBe('Le formateur « Marc Garnier » a été créé, mais le fichier « CV.pdf » n’a pas été enregistré.')
    fireEvent.click(bouton('Fermer l’alerte'))
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('règles des formateurs (SCRUM-119)', () => {
  const identite = { prenom: 'Marc', nom: 'Garnier', email: 'marc.garnier@exemple.fr' }
  it('statut et NDA facultatifs ; NDA de 11 chiffres (espaces acceptés), vérifié pour un sous-traitant seulement', () => {
    expect(verifierFormateur({ ...identite, statut: '', numero_nda: '' })).toEqual({})
    expect(verifierFormateur({ ...identite, statut: 'SOUS_TRAITANT', numero_nda: '' })).toEqual({})
    expect(verifierFormateur({ ...identite, statut: 'SOUS_TRAITANT', numero_nda: '117 565 432 10' })).toEqual({})
    expect(verifierFormateur({ ...identite, statut: 'SOUS_TRAITANT', numero_nda: '1175654321A' })).toEqual({ numero_nda: MSG_NDA })
    expect(verifierFormateur({ ...identite, statut: 'SALARIE', numero_nda: '12' })).toEqual({})
  })

  it('fichiers : formats, taille, nombre', () => {
    const { gardes, refus } = trierFichiers([fichier('a.PDF'), fichier('sans_extension'), fichier('b.docx', TAILLE_MAX)], 'DIPLOME', 4)
    expect(gardes.map((f) => f.name)).toEqual(['a.PDF'])
    expect(refus).toEqual(['« sans_extension » refusé : format non accepté (PDF, JPG, PNG ou Word)', '« b.docx » refusé : 5 diplômes maximum'])
  })

  it('tailles et message des fichiers non enregistrés', () => {
    expect([10, 420 * 1024, 1.2 * 1024 * 1024, 10 * 1024 * 1024].map(tailleFr)).toEqual(['1 Ko', '420 Ko', '1,2 Mo', '10 Mo'])
    expect(messageFichiersNonEnregistres({ prenom: 'A', nom: 'B' }, ['x.pdf']))
      .toBe('Le formateur « A B » a été créé, mais le fichier « x.pdf » n’a pas été enregistré.')
  })
})
