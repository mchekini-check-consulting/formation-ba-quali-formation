// Sessions et planning (SCRUM-25) : appels à l'API Django (/sessions/, /formateurs/, /apprenants/, /formations/).
// Adresse du backend : apiBase() (src/api.js), passerelle de l'environnement ou /api en local.
import { apiBase } from '../api'
import { demandeLieu, demandeLien } from './regles'

// `credentials: 'include'` : cookie de connexion (SCRUM-16), le backend ne renvoie que les sessions et formations du compte
// Erreur renvoyée à l'écran : `code` (règle métier du backend) et `champs` (champs refusés)
export class ErreurSession extends Error {
  constructor(code, message, champs = {}) { super(message); this.code = code; this.champs = champs }
}

async function appel(chemin, corps) {
  let reponse
  try {
    reponse = await fetch(`${apiBase()}${chemin}`, corps
      ? { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) }
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
// SCRUM-112 : apprenants du centre triés par nom, filtrés par `recherche` (nom, e-mail ou entreprise)
export const listerApprenants = (recherche = '') =>
  appel(recherche.trim() ? `/apprenants/?recherche=${encodeURIComponent(recherche.trim())}` : '/apprenants/')
// Entreprises clientes du centre (liste « Entreprise » de « Nouvel apprenant », SCRUM-112)
export const listerEntreprises = () => appel('/entreprises/')
// POST {prenom, nom, email} : formateur (SCRUM-26) ou apprenant (SCRUM-27)
const identite = (p) => ({ prenom: p.prenom.trim(), nom: p.nom.trim(), email: p.email.trim() })
export const creerFormateur = (p) => appel('/formateurs/', identite(p))
// Apprenant : + téléphone, statut, entreprise cliente et poste (ces deux derniers pour un salarié seulement, SCRUM-112)
export function creerApprenant(p) {
  const salarie = p.statut === 'SALARIE'
  return appel('/apprenants/', {
    ...identite(p), telephone: p.telephone.trim(), statut: p.statut,
    entreprise_id: salarie && p.entreprise_id ? Number(p.entreprise_id) : null, poste: salarie ? p.poste.trim() : '',
  })
}

// Formations proposées dans le formulaire : identifiant, intitulé, durée et modalité (reprises dans la session, SCRUM-166)
export async function listerFormations() {
  return (await appel('/formations/')).map((f) => ({
    id: f.id, intitule: f.intitule, duree: f.duree_heures === null ? '' : String(Number(f.duree_heures)), modalite: f.modalite || '',
  }))
}

// s : valeurs du formulaire (chaînes), formateurs et apprenants : identifiants cochés
export function creerSession(s, formateurs, apprenants) {
  return appel('/sessions/', {
    formation: Number(s.formation), date_debut: s.debut, date_fin: s.fin,
    duree_heures: s.duree.replaceAll(',', '.'), modalite: s.modalite,
    lieu: demandeLieu(s.modalite) ? s.lieu.trim() : '', lien_classe_virtuelle: demandeLien(s.modalite) ? s.lien.trim() : '',
    nombre_places: Number(s.places), formateurs, apprenants,
  })
}

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

// « Du 18/11/2026 au 20/11/2026 · 09 h – 17 h » (heures : seulement pour les sessions créées avant SCRUM-166)
export function periode({ date_debut, date_fin, heure_debut, heure_fin }) {
  const heures = heure_debut && heure_fin ? ` · ${heureFr(heure_debut)} – ${heureFr(heure_fin)}` : ''
  return `Du ${dateFr(date_debut)} au ${dateFr(date_fin)}${heures}`
}

export const MODALITES = { PRESENTIEL: 'Présentiel', DISTANCIEL: 'Distanciel', MIXTE: 'Mixte' }
export const STATUTS = { PREVUE: 'Prévue' }
export const initiales = (p) => `${p.prenom[0] || ''}${p.nom[0] || ''}`.toUpperCase()
