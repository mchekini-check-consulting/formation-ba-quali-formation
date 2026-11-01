import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Formations from './Formations'

function reponse(corps, status = 200) {
  return Promise.resolve({
    ok: status < 400,
    status,
    json: () => Promise.resolve(corps),
  })
}

beforeEach(() => vi.stubGlobal('fetch', vi.fn()))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('Formations', () => {
  it('affiche les formations du backend', async () => {
    fetch.mockReturnValueOnce(
      reponse([{ id: 1, nom: 'Django', description: 'Avancé', dureeHeures: 14, dateDebut: '2026-02-01' }]),
    )
    render(<Formations />)
    expect(await screen.findByText('Django')).toBeTruthy()
    expect(screen.getByText(': Avancé')).toBeTruthy()
    expect(screen.getByText('(14 h)')).toBeTruthy()
    expect(fetch).toHaveBeenCalledWith('/api/formations', undefined)
  })

  it('ajoute une formation', async () => {
    fetch
      .mockReturnValueOnce(reponse([]))
      .mockReturnValueOnce(
        reponse({ id: 2, nom: 'React', description: null, dureeHeures: null, dateDebut: null }, 201),
      )
    render(<Formations />)
    await screen.findByText('Aucune formation')
    fireEvent.change(screen.getByRole('textbox', { name: 'Nom' }), {
      target: { value: 'React' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }))
    expect(await screen.findByText('React')).toBeTruthy()
    const [url, options] = fetch.mock.calls[1]
    expect(url).toBe('/api/formations')
    expect(options.method).toBe('POST')
    expect(JSON.parse(options.body)).toEqual({
      nom: 'React',
      description: '',
      dureeHeures: null,
      dateDebut: null,
    })
  })

  it('modifie une formation', async () => {
    fetch
      .mockReturnValueOnce(reponse([{ id: 1, nom: 'Django', description: null, dureeHeures: 10, dateDebut: null }]))
      .mockReturnValueOnce(
        reponse({ id: 1, nom: 'Django avancé', description: null, dureeHeures: 10, dateDebut: null }),
      )
    render(<Formations />)
    await screen.findByText('Django')
    fireEvent.click(screen.getByRole('button', { name: 'Modifier' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Nom' }), {
      target: { value: 'Django avancé' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(await screen.findByText('Django avancé')).toBeTruthy()
    const [url, options] = fetch.mock.calls[1]
    expect(url).toBe('/api/formations/1')
    expect(options.method).toBe('PUT')
  })

  it('supprime une formation', async () => {
    fetch
      .mockReturnValueOnce(reponse([{ id: 1, nom: 'Django', description: null, dureeHeures: null, dateDebut: null }]))
      .mockReturnValueOnce(reponse(undefined, 204))
    render(<Formations />)
    await screen.findByText('Django')
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
    await screen.findByText('Aucune formation')
    const [url, options] = fetch.mock.calls[1]
    expect(url).toBe('/api/formations/1')
    expect(options.method).toBe('DELETE')
  })

  it('signale une erreur du backend', async () => {
    fetch.mockReturnValueOnce(reponse('', 503)).mockReturnValueOnce(reponse('', 400))
    render(<Formations />)
    expect((await screen.findByRole('alert')).textContent).toContain('503')
    fireEvent.change(screen.getByRole('textbox', { name: 'Nom' }), {
      target: { value: 'x' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }))
    expect((await screen.findByText(/Ajout impossible/)).textContent).toContain('400')
  })
})
