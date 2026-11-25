import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../App'
import { DocumentModele } from './DocumentModele'

// SCRUM-211 « Disposer de 4 modèles d'origine » : GET /modeles/ et /modeles/<type> simulés, compte connecté
const CONVENTION = '<div class="eh"><span class="logo-ph">LOGO</span><span>{{org_nom}}</span></div>'
  + '<h1>CONVENTION DE FORMATION PROFESSIONNELLE</h1><p style="text-align:center">Articles L6353-1 et suivants du Code du travail</p>'
  + '<p>Entre {{org_nom}} et {{client_nom}}. <em class="cond">Si salarié :</em> texte.</p>'
const LISTE = [
  { type: 'CONVENTION', nom: 'Convention de formation', statut: 'ORIGINE' },
  { type: 'CONTRAT', nom: 'Contrat de formation', statut: 'ORIGINE' },
  { type: 'CONVOCATION', nom: 'Convocation', statut: 'ORIGINE' },
  { type: 'ATTESTATION', nom: 'Attestation de fin de formation', statut: 'ORIGINE' },
]
const ok = (json) => ({ ok: true, status: 200, json: async () => json })

function simulerBackend(reponses = {}) {
  const fetchMock = vi.fn(async (url) => {
    if (url.endsWith('/auth/moi')) return ok({ id: 1, email: 'camille@organisme.fr' })
    for (const [fin, reponse] of Object.entries(reponses)) if (url.endsWith(fin)) return reponse
    if (url.endsWith('/modeles/')) return ok({ modeles: LISTE })
    if (url.endsWith('/modeles/CONVENTION') || url.endsWith('/modeles/convention')) {
      return ok({ type: 'CONVENTION', nom: 'Convention de formation', statut: 'ORIGINE', contenu: CONVENTION,
        variables: [{ code: 'org_nom', libelle: 'Nom de l’organisme' }, { code: 'client_nom', libelle: 'Raison sociale du client' }] })
    }
    return ok([])
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

function afficher(adresse) {
  const router = createMemoryRouter(routes, { initialEntries: [adresse] })
  render(<RouterProvider router={router} />)
  return router
}
const filAriane = () => screen.getByRole('navigation', { name: "Fil d'Ariane" })

describe('Modèles génériques (SCRUM-211)', () => {
  it('CA1 : un nouveau compte voit les 4 modèles avec le statut « Modèle d’origine »', async () => {
    simulerBackend()
    afficher('/modeles/generiques')
    for (const nom of ['Convention de formation', 'Contrat de formation', 'Convocation', 'Attestation de fin de formation']) {
      expect((await screen.findByRole('article', { name: nom })).textContent).toContain('Modèle d’origine')
    }
    expect(filAriane().textContent).toBe('Modèles › Modèles génériques')
  })

  it('CA2 : un clic ouvre le modèle (dans l’éditeur), son texte d’origine et les variables en étiquettes', async () => {
    simulerBackend()
    const router = afficher('/modeles/generiques')
    fireEvent.click(await screen.findByRole('link', { name: 'Convention de formation' }))
    expect(router.state.location.pathname).toBe('/modeles/generiques/convention')

    expect(await screen.findByRole('heading', { level: 1, name: 'Convention de formation' })).toBeTruthy()
    expect(filAriane().textContent).toBe('Modèles › Modèles génériques › Convention de formation')
    // SCRUM-213 : le modèle s'ouvre dans l'éditeur, avec le même texte et les mêmes étiquettes
    const document = screen.getByRole('textbox', { name: 'Convention de formation' })
    expect(within(document).getByRole('heading', { name: 'CONVENTION DE FORMATION PROFESSIONNELLE' })).toBeTruthy()
    expect(document.textContent).toContain('Articles L6353-1 et suivants du Code du travail')
    const etiquettes = [...document.querySelectorAll('.doc-variable')]
    expect(etiquettes.map((e) => e.textContent)).toEqual(['Nom de l’organisme', 'Nom de l’organisme', 'Raison sociale du client'])
    expect(etiquettes[0].getAttribute('title')).toBe('{{org_nom}}')
    expect(document.textContent).not.toContain('{{')
  })

  it('« ← Retour » et « Modèles génériques » du fil d’Ariane ramènent à la liste', async () => {
    simulerBackend()
    let router = afficher('/modeles/generiques/convention')
    fireEvent.click(await screen.findByRole('button', { name: '← Retour' }))
    expect(router.state.location.pathname).toBe('/modeles/generiques')
    cleanup()
    router = afficher('/modeles/generiques/convention')
    await screen.findByRole('textbox', { name: 'Convention de formation' })
    fireEvent.click(within(filAriane()).getByRole('link', { name: 'Modèles génériques' }))
    expect(router.state.location.pathname).toBe('/modeles/generiques')
  })

  it('modèle inconnu : message du backend', async () => {
    simulerBackend({ '/modeles/devis': { ok: false, status: 404, json: async () => ({ code: 'MODELE_INTROUVABLE', detail: 'Modèle introuvable' }) } })
    afficher('/modeles/generiques/devis')
    expect((await screen.findByRole('alert')).textContent).toContain('Modèle introuvable')
  })

  it('statut d’un modèle modifié : « Personnalisé »', async () => {
    simulerBackend({ '/modeles/': ok({ modeles: [{ type: 'CONTRAT', nom: 'Contrat de formation', statut: 'PERSONNALISE' }] }) })
    afficher('/modeles/generiques')
    expect((await screen.findByRole('article', { name: 'Contrat de formation' })).textContent).toContain('Personnalisé')
  })
})

describe('DocumentModele : seule la mise en forme est affichée', () => {
  it('ni script, ni image, ni lien, ni événement ; le texte reste', () => {
    const contenu = '<p onclick="alert(1)" style="color:red;text-align:right;background:url(x)">Bonjour</p>'
      + '<script>alert(1)</script><img src="x" onerror="alert(1)"><a href="javascript:alert(1)">lien</a>'
      + '<iframe src="https://exemple.fr"></iframe><span class="inconnue">fin</span>'
    const { container } = render(<DocumentModele contenu={contenu} />)
    expect(container.querySelector('script, img, a, iframe, [onclick], [onerror], [href], [src]')).toBeNull()
    const p = container.querySelector('p')
    expect(p.getAttribute('style')).toBe('text-align: right;')
    expect(container.textContent).toBe('Bonjourlienfin')
    expect(container.querySelector('span').className).toBe('')
  })

  it('variable inconnue du dictionnaire : son code en étiquette, sans blocage (RG12)', () => {
    const { container } = render(<DocumentModele contenu="<p>{{ variable_inconnue }}</p>" />)
    expect(container.querySelector('.doc-variable').textContent).toBe('variable_inconnue')
  })

  it('contenu vide', () => {
    const { container } = render(<DocumentModele contenu="" />)
    expect(container.querySelector('article').textContent).toBe('')
  })
})
