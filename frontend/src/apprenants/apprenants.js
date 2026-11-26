// Apprenants (SCRUM-112) : statuts, vérifications de la fenêtre « Nouvel apprenant » et affichage de la liste.
import { verifierPersonne } from '../sessions/regles'

export const SALARIE = 'SALARIE'
export const STATUTS_APPRENANT = [
  [SALARIE, 'Salarié'], ['DEMANDEUR_EMPLOI', 'Demandeur d’emploi'], ['INDEPENDANT', 'Indépendant'], ['PARTICULIER', 'Particulier'],
]
export const libelleStatut = (statut) => Object.fromEntries(STATUTS_APPRENANT)[statut] || ''

export const MSG_STATUT = 'Le statut est obligatoire'
export const MSG_TELEPHONE = 'Le téléphone doit contenir 10 chiffres'
export const VIDE = '—'

const chiffres = (telephone) => telephone.replaceAll(/[\s.-]/g, '')

// Prénom, nom, e-mail (SCRUM-27) ; statut obligatoire ; téléphone facultatif mais de 10 chiffres (espaces acceptés)
export function verifierApprenant(a) {
  const erreurs = verifierPersonne(a)
  if (!a.statut) erreurs.statut = MSG_STATUT
  const tel = chiffres(a.telephone)
  if (tel && !/^\d{10}$/.test(tel)) erreurs.telephone = MSG_TELEPHONE
  return erreurs
}

// « 0611223344 » → « 06 11 22 33 44 »
export const telephoneFr = (telephone) => (telephone ? telephone.replaceAll(/(\d{2})(?=\d)/g, '$1 ') : '')

// « 0 session », « 1 session », « 2 sessions »
export const texteSessions = (n) => `${n} session${n > 1 ? 's' : ''}`

// Charte : six couleurs de bulles d'initiales, une par personne (toujours la même pour un apprenant donné)
export const NOMBRE_COULEURS_BULLES = 6
export const classeBulle = (id) => `bulle bulle-${id % NOMBRE_COULEURS_BULLES}`
