import { describe, expect, it } from 'vitest'
import { FORMULES, MOIS_FACTURES_PAR_AN, enEuros, prixAffiche } from './tarifs'

// toLocaleString('fr-FR') sépare les milliers par une espace insécable : on la remplace pour comparer
const lisible = (texte) => texte.replace(/\s/g, ' ')

describe('tarifs de la landing page', () => {
  it('formate un montant en euros à la française', () => {
    expect(lisible(enEuros(99))).toBe('99 €')
    expect(lisible(enEuros(6039))).toBe('6 039 €')
  })

  it('en mensuel : prix mensuel, sans engagement', () => {
    expect(prixAffiche(199, false)).toEqual({ prix: '199 €', unite: 'HT / mois', detail: 'Sans engagement' })
  })

  it('en annuel : 11 fois le prix mensuel, avec l’équivalent mensuel et « 1 mois offert » (CA3)', () => {
    const { prix, unite, detail } = prixAffiche(199, true)
    expect(lisible(prix)).toBe('2 189 €')
    expect(unite).toBe('HT / an')
    expect(lisible(detail)).toBe('soit 182 € / mois · 1 mois offert')
  })

  it('applique la règle des 11 mois à toutes les formules', () => {
    expect(MOIS_FACTURES_PAR_AN).toBe(11)
    expect(FORMULES.map((f) => lisible(prixAffiche(f.mensuel, true).prix))).toEqual(['1 089 €', '2 189 €', '3 839 €', '6 039 €'])
  })

  it('une seule formule est recommandée : Essentiel', () => {
    expect(FORMULES.filter((f) => f.recommandee).map((f) => f.nom)).toEqual(['Essentiel'])
  })
})
