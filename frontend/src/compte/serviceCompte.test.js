import { describe, expect, it } from 'vitest'
import { initiales } from './serviceCompte'

describe('initiales de l’avatar', () => {
  it('prénom.nom : première lettre de chaque partie', () => {
    expect(initiales('prenom.nom@organisme.fr')).toBe('PN')
    expect(initiales('test_session@organisme.fr')).toBe('TS')
    expect(initiales('jean-marc+qualif@organisme.fr')).toBe('JM')
  })

  it('une seule partie : les deux premières lettres', () => {
    expect(initiales('nassiba@organisme.fr')).toBe('NA')
  })

  it('séparateurs en trop ignorés', () => {
    expect(initiales('.anne..durand@organisme.fr')).toBe('AD')
  })
})
