// Règles du formulaire « Nouvelle session » (SCRUM-25, évolution SCRUM-166), vérifiées dans l'écran avant l'envoi
// (le backend les vérifie aussi).
// Modalités : les mêmes que celles de la formation (SCRUM-166)
export const PRESENTIEL = 'PRESENTIEL'
export const DISTANCIEL = 'DISTANCIEL'
export const MIXTE = 'MIXTE'
export const MODALITES_SESSION = [[PRESENTIEL, 'Présentiel'], [DISTANCIEL, 'Distanciel'], [MIXTE, 'Mixte']]
export const OBLIGATOIRE = 'Ce champ est obligatoire.'
export const MSG_DATES = 'La date de fin doit être postérieure ou égale à la date de début.'
export const MSG_FORMATEUR = 'Une session doit avoir au moins un formateur.'
export const MSG_APPRENANT = 'Une session doit avoir au moins un apprenant.'
export const msgTropApprenants = (n, places) => `Trop d’apprenants : ${n} cochés pour ${places} places.`

// Lieu (présentiel, mixte) et lien de classe virtuelle (distanciel, mixte)
export const demandeLieu = (modalite) => modalite === PRESENTIEL || modalite === MIXTE
export const demandeLien = (modalite) => modalite === DISTANCIEL || modalite === MIXTE

// Étape 1 : tous les champs obligatoires, date de fin ≥ date de début (plus d'heures depuis SCRUM-166)
// (le lieu ou le lien n'est demandé qu'une fois la modalité choisie)
export function verifierInformations(s) {
  const champs = ['formation', 'debut', 'fin', 'modalite']
  if (demandeLieu(s.modalite)) champs.push('lieu')
  if (demandeLien(s.modalite)) champs.push('lien')
  const erreurs = {}
  for (const k of champs) {
    if (!String(s[k]).trim()) erreurs[k] = OBLIGATOIRE
  }
  // Durée et places vides ou invalides : message précis (maquette SCRUM-166)
  if (!(Number(s.duree.replaceAll(',', '.')) > 0)) erreurs.duree = 'Saisissez une durée supérieure à 0.'
  if (!/^[1-9]\d*$/.test(s.places.trim())) erreurs.places = 'Saisissez un nombre entier supérieur à 0.'
  if (!erreurs.debut && !erreurs.fin && s.fin < s.debut) erreurs.fin = MSG_DATES
  return erreurs
}

// Champs de l'API -> champs du formulaire (erreurs renvoyées par le backend)
const CHAMPS_API = { formation: 'formation', date_debut: 'debut', date_fin: 'fin',
  duree_heures: 'duree', nombre_places: 'places', modalite: 'modalite', lieu: 'lieu', lien_classe_virtuelle: 'lien' }

// Refus du serveur à la création : étape à afficher, champs de l'étape 1 à signaler, ou message
export function erreurServeur(e) {
  if (e.code === 'FORMATEUR_REQUIS') return { etape: 2, message: e.message }
  if (e.code === 'APPRENANT_REQUIS' || e.code === 'TROP_APPRENANTS') return { etape: 3, message: e.message }
  const champs = Object.fromEntries(Object.entries(e.champs || {}).filter(([k]) => CHAMPS_API[k]).map(([k, v]) => [CHAMPS_API[k], [].concat(v)[0]]))
  if (e.code === 'DATES_INVALIDES') champs.fin = e.message
  if (Object.keys(champs).length) return { etape: 1, champs }
  return { etape: 3, message: e.message }
}

// ---- Choix des formateurs et des apprenants (SCRUM-166) ----

// Minuscules, sans accents : « Lefèvre » est trouvé avec « lefevre »
const normaliser = (texte) => (texte || '').normalize('NFD').replaceAll(/\p{Diacritic}/gu, '').toLowerCase()

// Personnes dont le nom, l'entreprise ou l'e-mail contient la recherche ; les personnes cochées en tête
export function filtrerPersonnes(personnes, recherche, choisis) {
  const r = normaliser(recherche.trim())
  const trouvees = personnes.filter((p) => !r || [`${p.prenom} ${p.nom}`, p.entreprise, p.email].some((t) => normaliser(t).includes(r)))
  return [...trouvees.filter((p) => choisis.includes(p.id)), ...trouvees.filter((p) => !choisis.includes(p.id))]
}

// Panneaux « Nouveau formateur » (SCRUM-26) et « Nouvel apprenant » (SCRUM-27) :
// prénom, nom et e-mail obligatoires, e-mail au format valide
export const MSG_EMAIL = "Format d'e-mail invalide"
const MESSAGES_PERSONNE = { prenom: 'Indiquez le prénom.', nom: 'Indiquez le nom.', email: "Indiquez l'e-mail." }
// Format attendu : texte@domaine.extension, sans espace
export function emailValide(email) {
  const parties = email.split('@')
  if (parties.length !== 2 || /\s/.test(email)) return false
  const [utilisateur, domaine] = parties
  const point = domaine.lastIndexOf('.')
  return utilisateur.length > 0 && point > 0 && point < domaine.length - 1
}
export function verifierPersonne(a) {
  const erreurs = {}
  for (const [k, message] of Object.entries(MESSAGES_PERSONNE)) {
    if (!a[k].trim()) erreurs[k] = message
  }
  if (!erreurs.email && !emailValide(a.email.trim())) erreurs.email = MSG_EMAIL
  return erreurs
}
