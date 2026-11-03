// Règles du formulaire « Nouvelle session » (SCRUM-25), vérifiées dans l'écran avant l'envoi
// (le backend les vérifie aussi).
export const OBLIGATOIRE = 'Ce champ est obligatoire.'
export const MSG_DATES = 'La date de fin doit être postérieure ou égale à la date de début.'
export const MSG_FORMATEUR = 'Une session doit avoir au moins un formateur'
export const MSG_APPRENANT = 'Une session doit avoir au moins un apprenant'
// Étape 1 : tous les champs obligatoires, date de fin ≥ date de début
export function verifierInformations(s) {
  const lieuOuLien = s.modalite === 'PRESENTIEL' ? 'lieu' : 'lien'
  const erreurs = {}
  for (const k of ['formation', 'debut', 'fin', 'heureDebut', 'heureFin', 'duree', 'places', 'modalite', lieuOuLien]) {
    if (!String(s[k]).trim()) erreurs[k] = OBLIGATOIRE
  }
  if (!erreurs.duree && !(Number(s.duree.replace(',', '.')) > 0)) erreurs.duree = 'Indiquez une durée supérieure à 0.'
  if (!erreurs.places && !/^[1-9]\d*$/.test(s.places.trim())) erreurs.places = 'Indiquez un nombre entier supérieur à 0.'
  if (!erreurs.debut && !erreurs.fin && s.fin < s.debut) erreurs.fin = MSG_DATES
  return erreurs
}
