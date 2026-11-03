// Règles du formulaire « Nouvelle session » (SCRUM-25), vérifiées dans l'écran avant l'envoi
// (le backend les vérifie aussi).
export const PRESENTIEL = 'PRESENTIEL'
export const CLASSE_VIRTUELLE = 'CLASSE_VIRTUELLE'
export const OBLIGATOIRE = 'Ce champ est obligatoire.'
export const MSG_DATES = 'La date de fin doit être postérieure ou égale à la date de début.'
export const MSG_FORMATEUR = 'Une session doit avoir au moins un formateur'
export const MSG_APPRENANT = 'Une session doit avoir au moins un apprenant'

// Étape 1 : tous les champs obligatoires, date de fin ≥ date de début
export function verifierInformations(s) {
  const lieuOuLien = s.modalite === PRESENTIEL ? 'lieu' : 'lien'
  const erreurs = {}
  for (const k of ['formation', 'debut', 'fin', 'heureDebut', 'heureFin', 'duree', 'places', 'modalite', lieuOuLien]) {
    if (!String(s[k]).trim()) erreurs[k] = OBLIGATOIRE
  }
  if (!erreurs.duree && !(Number(s.duree.replaceAll(',', '.')) > 0)) erreurs.duree = 'Indiquez une durée supérieure à 0.'
  if (!erreurs.places && !/^[1-9]\d*$/.test(s.places.trim())) erreurs.places = 'Indiquez un nombre entier supérieur à 0.'
  if (!erreurs.debut && !erreurs.fin && s.fin < s.debut) erreurs.fin = MSG_DATES
  return erreurs
}

// Champs de l'API -> champs du formulaire (erreurs renvoyées par le backend)
const CHAMPS_API = { formation: 'formation', date_debut: 'debut', date_fin: 'fin', heure_debut: 'heureDebut', heure_fin: 'heureFin',
  duree_heures: 'duree', nombre_places: 'places', modalite: 'modalite', lieu: 'lieu', lien_classe_virtuelle: 'lien' }

// Refus du serveur à la création : étape à afficher, champs de l'étape 1 à signaler, ou message
export function erreurServeur(e) {
  if (e.code === 'FORMATEUR_REQUIS') return { etape: 2, message: e.message }
  if (e.code === 'APPRENANT_REQUIS') return { etape: 3, message: e.message }
  const champs = Object.fromEntries(Object.entries(e.champs || {}).filter(([k]) => CHAMPS_API[k]).map(([k, v]) => [CHAMPS_API[k], [].concat(v)[0]]))
  if (e.code === 'DATES_INVALIDES') champs.fin = e.message
  if (Object.keys(champs).length) return { etape: 1, champs }
  return { etape: 3, message: e.message }
}
