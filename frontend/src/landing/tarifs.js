// Tarifs de la landing page (SCRUM-14, CA3) :
// en annuel, on paie 11 mois au lieu de 12 (« 1 mois offert »).
export const MOIS_FACTURES_PAR_AN = 11

// Formules : prix mensuel HT
export const FORMULES = [
  { nom: 'Découverte', tranche: "Jusqu'à 200 apprenants / an", mensuel: 89 },
  { nom: 'Essentiel', tranche: "Jusqu'à 500 apprenants / an", mensuel: 199, recommandee: true },
  { nom: 'Avancé', tranche: "Jusqu'à 1 500 apprenants / an", mensuel: 349 },
  { nom: 'Premium', tranche: "Jusqu'à 3 000 apprenants / an", mensuel: 549 },
]

// 1234 -> « 1 234 € » (séparateur de milliers français)
export const enEuros = (montant) => `${montant.toLocaleString('fr-FR')} €`

// Prix affiché d'une formule selon la période choisie (mensuelle ou annuelle)
export function prixAffiche(mensuel, annuel) {
  if (!annuel) {
    return { prix: enEuros(mensuel), unite: 'HT / mois', detail: 'Sans engagement' }
  }
  const prixAnnuel = mensuel * MOIS_FACTURES_PAR_AN
  return {
    prix: enEuros(prixAnnuel),
    unite: 'HT / an',
    detail: `soit ${enEuros(Math.round(prixAnnuel / 12))} / mois · 1 mois offert`,
  }
}
