// Entreprises clientes (SCRUM-120) : affichage de la liste de l'onglet Entreprises clientes.

export const A_CONFIRMER = 'À confirmer' // OPCO pas encore renseigné (aucune saisie prévue pour l'instant)

// « 41234567800021 » → « 412 345 678 00021 » (SIREN puis NIC) ; un SIRET incomplet est affiché tel quel
export const siretFr = (siret) => (/^\d{14}$/.test(siret || '') ? siret.replace(/^(\d{3})(\d{3})(\d{3})(\d{5})$/, '$1 $2 $3 $4') : siret || '')

// Bulle : initiales des deux premiers mots de la raison sociale (« Société Durand » → « SD »)
export const initialesEntreprise = (raisonSociale) =>
  raisonSociale.trim().split(/\s+/).slice(0, 2).map((mot) => mot[0] || '').join('').toUpperCase()

// « 0 salarié », « 1 salarié », « 2 salariés »
export const texteSalaries = (n) => `${n} salarié${n > 1 ? 's' : ''}`
