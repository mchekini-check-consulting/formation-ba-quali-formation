import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { apiBase } from './api'

// Réponse fetch simulée
function reponse(corps, status = 200) {
  return Promise.resolve({
    ok: status < 400,
    status,
    json: () => Promise.resolve(corps),
  })
}

// <App /> affiche Items et Formations ensemble : chacun fait son propre appel
// au chargement. On route les réponses simulées par URL (file d'attente par
// URL) plutôt que par ordre d'appel, pour ne pas dépendre de l'ordre des
// deux montages. Les URL absentes de la map reçoivent une liste vide.
function simulerFetch(reponsesParUrl) {
  const compteurs = {}
  return vi.fn((url) => {
    const liste = reponsesParUrl[url] ?? [reponse([])]
    const i = compteurs[url] ?? 0
    compteurs[url] = i + 1
    return liste[Math.min(i, liste.length - 1)]
  })
}

beforeEach(() => vi.stubGlobal('fetch', simulerFetch({})))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('apiBase', () => {
  it("pointe la passerelle de l'environnement du frontend", () => {
    expect(apiBase('frontend.formation-ba-projet.qualif.check-consulting.net')).toBe(
      'https://gateway.formation-ba-projet.qualif.check-consulting.net/backend',
    )
  })

  it('utilise le proxy du serveur de dev en local', () => {
    expect(apiBase('localhost')).toBe('/api')
  })
})

describe('App', () => {
  it('affiche les items du backend', async () => {
    vi.stubGlobal(
      'fetch',
      simulerFetch({ '/api/items': [reponse([{ id: 1, nom: 'a', description: 'd' }])] }),
    )
    render(<App />)
    expect(await screen.findByText('a')).toBeTruthy()
    expect(screen.getByText(': d')).toBeTruthy()
    expect(fetch).toHaveBeenCalledWith('/api/items', undefined)
  })

  it('ajoute un item', async () => {
    vi.stubGlobal(
      'fetch',
      simulerFetch({
        '/api/items': [reponse([]), reponse({ id: 2, nom: 'Premier', description: null }, 201)],
      }),
    )
    render(<App />)
    const main = screen.getByRole('main')
    await within(main).findByText('Aucun item')
    fireEvent.change(within(main).getByRole('textbox', { name: 'Nom' }), {
      target: { value: 'Premier' },
    })
    fireEvent.click(within(main).getByRole('button', { name: 'Ajouter' }))
    expect(await within(main).findByText('Premier')).toBeTruthy()
    const appelsItems = fetch.mock.calls.filter(([url]) => url === '/api/items')
    const [url, options] = appelsItems[1]
    expect(url).toBe('/api/items')
    expect(options.method).toBe('POST')
    expect(JSON.parse(options.body)).toEqual({ nom: 'Premier', description: '' })
    expect(within(main).getByRole('textbox', { name: 'Nom' }).value).toBe('')
  })

  it('signale une erreur du backend', async () => {
    vi.stubGlobal(
      'fetch',
      simulerFetch({ '/api/items': [reponse('', 503), reponse('', 400)] }),
    )
    render(<App />)
    const main = screen.getByRole('main')
    expect((await within(main).findByRole('alert')).textContent).toContain('503')
    fireEvent.change(within(main).getByRole('textbox', { name: 'Nom' }), {
      target: { value: 'x' },
    })
    fireEvent.click(within(main).getByRole('button', { name: 'Ajouter' }))
    expect((await within(main).findByText(/Ajout impossible/)).textContent).toContain('400')
  })
})
