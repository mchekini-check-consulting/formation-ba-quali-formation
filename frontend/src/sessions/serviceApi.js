// Sessions et planning (SCRUM-25) : appels à l'API Django (/sessions/, /formateurs/, /apprenants/, /formations/).
// Adresse du backend : apiBase() (src/api.js), passerelle de l'environnement ou /api en local.
import { apiBase } from '../api'
import { PRESENTIEL } from './regles'

// `credentials: 'include'` : cookie de connexion (SCRUM-16), le backend ne renvoie que les sessions et formations du compte
// Erreur renvoyée à l'écran : `code` (règle métier du backend) et `champs` (champs refusés)
export class ErreurSession extends Error {
  constructor(code, message, champs = {}) { super(message); this.code = code; this.champs = champs }
}

// corps : envoyé en JSON avec `methode` (POST par défaut) ; sans corps : lecture (GET)
async function appel(chemin, corps, methode = 'POST') {
  let reponse
  try {
    reponse = await fetch(`${apiBase()}${chemin}`, corps
      ? { method: methode, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) }
      : { credentials: 'include' })
  } catch {
    throw new ErreurSession('RESEAU', 'Le serveur ne répond pas : vérifiez que le backend est lancé.')
  }
  const json = await reponse.json().catch(() => null)
  if (!reponse.ok) {
    if (json?.code) throw new ErreurSession(json.code, json.detail)
    throw new ErreurSession('VALIDATION', 'Certaines informations sont invalides.', json || {})
  }
  return json
}

export const listerSessions = () => appel('/sessions/')
export const listerFormateurs = () => appel('/formateurs/')
export const listerApprenants = () => appel('/apprenants/')
// POST {prenom, nom, email} : formateur (SCRUM-26) ou apprenant (SCRUM-27)
const creerPersonne = (chemin) => (p) => appel(chemin, { prenom: p.prenom.trim(), nom: p.nom.trim(), email: p.email.trim() })
export const creerFormateur = creerPersonne('/formateurs/')
export const creerApprenant = creerPersonne('/apprenants/')

// Formations proposées dans le formulaire : identifiant, intitulé et durée (reprise dans la session)
export async function listerFormations() {
  return (await appel('/formations/')).map((f) => ({ id: f.id, intitule: f.intitule, duree: f.duree_heures === null ? '' : String(Number(f.duree_heures)) }))
}

// s : valeurs du formulaire (chaînes), formateurs et apprenants : identifiants cochés
function corpsSession(s, formateurs, apprenants) {
  const presentiel = s.modalite === PRESENTIEL
  return {
    formation: Number(s.formation), date_debut: s.debut, date_fin: s.fin, heure_debut: s.heureDebut, heure_fin: s.heureFin,
    duree_heures: s.duree.replaceAll(',', '.'), modalite: s.modalite,
    lieu: presentiel ? s.lieu.trim() : '', lien_classe_virtuelle: presentiel ? '' : s.lien.trim(),
    nombre_places: Number(s.places), formateurs, apprenants,
  }
}
export const creerSession = (s, formateurs, apprenants) => appel('/sessions/', corpsSession(s, formateurs, apprenants))

// Fiche d'une session (SCRUM-36), avec ses formateurs et apprenants détaillés ; 404 SESSION_INTROUVABLE
export const lireSession = (id) => appel(`/sessions/${id}/`)
// PUT : mêmes données qu'à la création ; le statut ne change pas
export const modifierSession = (id, s, formateurs, apprenants) =>
  appel(`/sessions/${id}/`, corpsSession(s, formateurs, apprenants), 'PUT')

// Session de l'API -> valeurs du formulaire (chaînes), pour pré-remplir « Modifier la session »
const texte = (v) => (v === null || v === undefined ? '' : String(v))
export const versFormulaire = (session) => ({
  formation: texte(session.formation), debut: session.date_debut, fin: session.date_fin,
  heureDebut: texte(session.heure_debut).slice(0, 5), heureFin: texte(session.heure_fin).slice(0, 5),
  duree: session.duree_heures === null ? '' : String(Number(session.duree_heures)), places: texte(session.nombre_places),
  modalite: session.modalite, lieu: session.lieu, lien: session.lien_classe_virtuelle,
})

// ---- Affichage ----

// "2026-11-18" -> "18/11/2026"
export const dateFr = (iso) => (iso ? iso.split('-').reverse().join('/') : '')
// "09:00:00" -> "09 h" ; "09:30" -> "09 h 30"
export function heureFr(h) {
  if (!h) return ''
  const [hh, mm] = h.split(':')
  return mm && mm !== '00' ? `${hh} h ${mm}` : `${hh} h`
}
const MOIS = ['JANV.', 'FÉVR.', 'MARS', 'AVR.', 'MAI', 'JUIN', 'JUIL.', 'AOÛT', 'SEPT.', 'OCT.', 'NOV.', 'DÉC.']
export const moisCourt = (iso) => MOIS[Number(iso.slice(5, 7)) - 1]
export const jour = (iso) => String(Number(iso.slice(8, 10)))

// « Du 18/11/2026 au 20/11/2026 · 09 h – 17 h »
export function periode({ date_debut, date_fin, heure_debut, heure_fin }) {
  const heures = heure_debut && heure_fin ? ` · ${heureFr(heure_debut)} – ${heureFr(heure_fin)}` : ''
  return `Du ${dateFr(date_debut)} au ${dateFr(date_fin)}${heures}`
}

export const MODALITES = { PRESENTIEL: 'Présentiel', CLASSE_VIRTUELLE: 'Classe virtuelle' }
export const STATUTS = { PREVUE: 'Prévue' }
export const initiales = (p) => `${p.prenom[0] || ''}${p.nom[0] || ''}`.toUpperCase()
