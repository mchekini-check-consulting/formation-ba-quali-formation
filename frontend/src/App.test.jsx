import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'

afterEach(cleanup)

describe('App', () => {
  it('affiche le titre', () => {
    render(<App />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Bonjour Nassiba')
  })

  it('affiche les 9 fonctionnalités', () => {
    const { container } = render(<App />)
    expect(container.querySelectorAll('.module')).toHaveLength(9)
  })

  it('ouvre et ferme le menu au clic', () => {
    const { container } = render(<App />)
    const sidebar = container.querySelector('.sidebar')
    const button = screen.getByRole('button', { name: /ouvrir le menu/i })
    fireEvent.click(button)
    expect(sidebar.classList.contains('ouverte')).toBe(true)
    fireEvent.click(button)
    expect(sidebar.classList.contains('ouverte')).toBe(false)
  })
})
