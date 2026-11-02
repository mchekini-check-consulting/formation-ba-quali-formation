import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EMAIL_CONTACT, MENU, MOTS_TITRE, TEMOIGNAGES } from './contenu'
import LandingPage, { DELAI_MOT_MS, DELAI_TEMOIGNAGE_MS } from './LandingPage'

const lisible = (texte) => texte.replace(/\s/g, ' ')

const afficher = () => render(<MemoryRouter><LandingPage /></MemoryRouter>)
const formule = (nom) => screen.getByTestId(`formule-${nom}`)

// jsdom ne sait pas faire défiler : on espionne l'appel
let defilement
beforeEach(() => {
  defilement = vi.fn()
  Element.prototype.scrollIntoView = defilement
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('Landing page — sections de la maquette (CA1)', () => {
  it('affiche toutes les sections', () => {
    const { container } = afficher()
    for (const id of ['top', 'fonctionnalites', 'avis', 'tarifs', 'faq']) {
      expect(container.querySelector(`#${id}`)).not.toBeNull()
    }
    expect(screen.getByRole('heading', { level: 2, name: 'Opérationnel en 3 étapes' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: 'Questions fréquentes' })).toBeTruthy()
    expect(screen.getAllByRole('heading', { level: 3 }).length).toBeGreaterThanOrEqual(11)
  })

  it('propose de se connecter et de créer un compte', () => {
    afficher()
    expect(screen.getByRole('link', { name: 'Se connecter' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Essai gratuit' })).toBeTruthy()
    expect(screen.getAllByRole('link', { name: 'Démarrer mon essai gratuit' })).toHaveLength(2)
  })

  it('ouvre la première question de la FAQ, les autres sont fermées', () => {
    const { container } = afficher()
    const questions = container.querySelectorAll('#faq details')
    expect(questions).toHaveLength(4)
    expect(Array.from(questions).map((q) => q.open)).toEqual([true, false, false, false])
  })
})

describe('Landing page — menu (CA2)', () => {
  it.each(MENU)('« $libelle » fait défiler jusqu’à la section $section', ({ libelle, section }) => {
    afficher()
    const menu = screen.getByRole('navigation', { name: 'Navigation principale' })
    fireEvent.click(within(menu).getByRole('link', { name: libelle }))
    expect(defilement).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
    expect(defilement.mock.instances[0].id).toBe(section)
  })

  it('« Voir les tarifs » fait défiler jusqu’aux tarifs', () => {
    afficher()
    fireEvent.click(screen.getByRole('link', { name: 'Voir les tarifs' }))
    expect(defilement.mock.instances[0].id).toBe('tarifs')
  })
})

describe('Landing page — tarifs (CA3)', () => {
  it('affiche les prix mensuels par défaut', () => {
    afficher()
    expect(screen.getByRole('button', { name: 'Mensuel' }).getAttribute('aria-pressed')).toBe('true')
    expect(within(formule('Essentiel')).getByText('199 €')).toBeTruthy()
    expect(within(formule('Essentiel')).getByText('HT / mois')).toBeTruthy()
    expect(within(formule('Essentiel')).getByText('Sans engagement')).toBeTruthy()
  })

  it('en annuel : 11 fois le prix mensuel, avec l’équivalent mensuel et « 1 mois offert »', () => {
    afficher()
    fireEvent.click(screen.getByRole('button', { name: /Annuel/ }))
    expect(screen.getByRole('button', { name: /Annuel/ }).getAttribute('aria-pressed')).toBe('true')
    const essentiel = formule('Essentiel')
    expect(lisible(essentiel.querySelector('.lp-formule-prix').textContent)).toBe('2 189 €')
    expect(within(essentiel).getByText('HT / an')).toBeTruthy()
    expect(lisible(essentiel.querySelector('.lp-formule-detail').textContent)).toBe('soit 182 € / mois · 1 mois offert')
    expect(lisible(formule('Découverte').querySelector('.lp-formule-prix').textContent)).toBe('1 089 €')
  })

  it('revient aux prix mensuels', () => {
    afficher()
    fireEvent.click(screen.getByRole('button', { name: /Annuel/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Mensuel' }))
    expect(within(formule('Premium')).getByText('549 €')).toBeTruthy()
  })

  it('met en avant la formule recommandée', () => {
    afficher()
    expect(within(formule('Essentiel')).getByText('Recommandé')).toBeTruthy()
    expect(within(formule('Avancé')).queryByText('Recommandé')).toBeNull()
  })
})

describe('Landing page — devis (CA4)', () => {
  it('« Demander un devis » ouvre la messagerie avec l’adresse de contact', () => {
    afficher()
    expect(screen.getByRole('link', { name: 'Demander un devis' }).getAttribute('href')).toBe(`mailto:${EMAIL_CONTACT}`)
  })
})

describe('Landing page — animations', () => {
  it('le mot du titre change régulièrement', () => {
    vi.useFakeTimers()
    afficher()
    const titre = () => screen.getByRole('heading', { level: 1 }).textContent
    expect(titre()).toContain(MOTS_TITRE[0])
    act(() => vi.advanceTimersByTime(DELAI_MOT_MS))
    expect(titre()).toContain(MOTS_TITRE[1])
  })

  it('les témoignages défilent tout seuls et avec les flèches', () => {
    vi.useFakeTimers()
    afficher()
    const cite = (i) => screen.queryByText(`« ${TEMOIGNAGES[i].citation} »`)
    expect(cite(0)).not.toBeNull()
    act(() => vi.advanceTimersByTime(DELAI_TEMOIGNAGE_MS))
    expect(cite(1)).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Témoignage précédent' }))
    expect(cite(0)).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Témoignage précédent' }))
    expect(cite(TEMOIGNAGES.length - 1)).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Témoignage suivant' }))
    expect(cite(0)).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Afficher le témoignage 4' }))
    expect(cite(3)).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Afficher le témoignage 4' }).getAttribute('aria-current')).toBe('true')
  })
})
