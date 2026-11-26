// Entreprises clientes : affichage de la liste de l'onglet (SCRUM-120) et règles du panneau « Nouvelle entreprise
// cliente » (SCRUM-113, mêmes règles que le backend).
import { emailValide } from '../sessions/regles'

export const A_CONFIRMER = 'À confirmer' // OPCO pas encore renseigné (aucune saisie prévue pour l'instant)

// « 41234567800021 » → « 412 345 678 00021 » (SIREN puis NIC) ; un SIRET incomplet est affiché tel quel
export const siretFr = (siret) => (/^\d{14}$/.test(siret || '') ? siret.replace(/^(\d{3})(\d{3})(\d{3})(\d{5})$/, '$1 $2 $3 $4') : siret || '')

// Bulle : initiales des deux premiers mots de la raison sociale (« Société Durand » → « SD »)
export const initialesEntreprise = (raisonSociale) =>
  raisonSociale.trim().split(/\s+/).slice(0, 2).map((mot) => mot[0] || '').join('').toUpperCase()

// « 0 salarié », « 1 salarié », « 2 salariés »
export const texteSalaries = (n) => `${n} salarié${n > 1 ? 's' : ''}`

// ---- SCRUM-113 : panneau « Nouvelle entreprise cliente » ----

export const LONGUEUR_MIN_RECHERCHE = 3
export const MSG_RECHERCHE_COURTE = 'Saisissez au moins 3 caractères.'
export const MSG_OBLIGATOIRE = 'Champ obligatoire'
export const MSG_SIRET = 'Le SIRET doit contenir 14 chiffres'
export const MSG_EMAIL = "Format d'e-mail invalide"
export const MSG_TELEPHONE = 'Le téléphone doit contenir 10 chiffres'
export const ROLES = [
  ['RESSOURCES_HUMAINES', 'Ressources humaines'], ['MANAGER', 'Manager'], ['COMPTABILITE', 'Comptabilité'], ['DIRIGEANT', 'Dirigeant'],
]

export const ENTREPRISE_VIDE = {
  raison_sociale: '', siret: '', forme_juridique: '', code_naf: '', adresse: '', code_postal: '', ville: '',
  adresse_facturation_identique: true, adresse_facturation: '', email: '',
  interlocuteur_prenom: '', interlocuteur_nom: '', interlocuteur_role: '', interlocuteur_email: '', interlocuteur_telephone: '',
}

// « PARIS » → « Paris », « SAINT-DENIS » → « Saint-Denis » (ville affichée dans les résultats de l'annuaire)
export const villeFr = (ville) => (ville || '').toLowerCase().replace(/(^|[\s-])\p{L}/gu, (l) => l.toUpperCase())

const sansEspaces = (texte, autres = '') => texte.replace(new RegExp(`[\\s${autres}]`, 'g'), '')

// Obligatoires : raison sociale, SIRET (14 chiffres), adresse, code postal, ville, adresse de facturation si elle
// n'est pas identique ; e-mails valides et téléphone à 10 chiffres s'ils sont saisis
export function verifierEntreprise(e) {
  const erreurs = {}
  const obligatoires = ['raison_sociale', 'siret', 'adresse', 'code_postal', 'ville']
  if (!e.adresse_facturation_identique) obligatoires.push('adresse_facturation')
  for (const k of obligatoires) if (!e[k].trim()) erreurs[k] = MSG_OBLIGATOIRE
  if (!erreurs.siret && !/^\d{14}$/.test(sansEspaces(e.siret))) erreurs.siret = MSG_SIRET
  for (const k of ['email', 'interlocuteur_email']) if (e[k].trim() && !emailValide(e[k].trim())) erreurs[k] = MSG_EMAIL
  const tel = sansEspaces(e.interlocuteur_telephone, '.-')
  if (tel && !/^\d{10}$/.test(tel)) erreurs.interlocuteur_telephone = MSG_TELEPHONE
  return erreurs
}

// Corps du POST /entreprises/ : textes nettoyés, SIRET sans espaces
export const corpsEntreprise = (e) => Object.fromEntries(Object.entries(e).map(([k, v]) => [
  k, typeof v === 'string' ? (k === 'siret' ? sansEspaces(v) : v.trim()) : v,
]))
