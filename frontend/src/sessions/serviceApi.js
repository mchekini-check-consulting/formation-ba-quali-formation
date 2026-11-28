// Sessions et planning (SCRUM-25) : appels à l'API Django (/sessions/, /formateurs/, /apprenants/, /formations/).
// Adresse du backend : apiBase() (src/api.js), passerelle de l'environnement ou /api en local.
import { apiBase } from '../api'
import { demandeLieu, demandeLien } from './regles'

// `credentials: 'include'` : cookie de connexion (SCRUM-16), le backend ne renvoie que les sessions et formations du compte
// Erreur renvoyée à l'écran : `code` (règle métier du backend) et `champs` (champs refusés)
export class ErreurSession extends Error {
  constructor(code, message, champs = {}) { super(message); this.code = code; this.champs = champs }
}

// `methode` : 'DELETE' pour un retrait (sans corps) ; sinon POST si `corps` est donné, GET sinon
async function appel(chemin, corps, methode) {
  let options = { credentials: 'include' }
  if (corps) options = { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) }
  if (methode) options = { ...options, method: methode }
  let reponse
  try {
    reponse = await fetch(`${apiBase()}${chemin}`, options)
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
// SCRUM-168 : fiche d'une session. GET -> en-tête (formation, dates, modalité, lieu, places, formateurs, entreprises) et
// nombres des onglets ; 404 SESSION_INTROUVABLE si la session n'existe pas ou appartient à un autre centre
export const ficheSession = (id) => appel(`/sessions/${encodeURIComponent(id)}/`)
// SCRUM-179 : onglet Apprenants. Chaque appel renvoie { nombre_places, apprenants: [{ id, prenom, nom, email, statut,
// entreprise, poste }] } ; 400 TROP_APPRENANTS (ajout au-delà des places), 400 DERNIER_APPRENANT (retrait du dernier)
const urlApprenants = (id) => `/sessions/${encodeURIComponent(id)}/apprenants/`
export const apprenantsSession = (id) => appel(urlApprenants(id))
export const ajouterApprenantsSession = (id, apprenants) => appel(urlApprenants(id), { apprenants })
export const retirerApprenantSession = (id, apprenant) =>
  appel(`${urlApprenants(id)}${encodeURIComponent(apprenant)}/`, null, 'DELETE')

// SCRUM-220 : onglet Documents d'une session. GET -> { session, documents: [{ type, nom, source, generes }] } ;
// source : FORMATION (modèle de la formation) ou GENERIQUE (modèle générique, ou d'origine) (RG20)
export const documentsSession = (id) => appel(`/sessions/${encodeURIComponent(id)}/documents/`)
// POST -> 201 { type, source, nombre } ; 400 session sans apprenant / convention sans entreprise cliente
export const genererDocuments = (id, type) => appel(`/sessions/${encodeURIComponent(id)}/documents/${encodeURIComponent(type)}/generer`, {})
// PDF figé (RG22), téléchargé avec le cookie de connexion : jamais de lien public
export const adressePdf = (id, document) => `/sessions/${encodeURIComponent(id)}/documents/${encodeURIComponent(document)}/pdf`
// SCRUM-119 : formateurs du centre triés par nom, avec leur nombre de sessions, filtrés par `recherche` (nom ou e-mail)
export const listerFormateurs = (recherche = '') =>
  appel(recherche.trim() ? `/formateurs/?recherche=${encodeURIComponent(recherche.trim())}` : '/formateurs/')
// SCRUM-112 : apprenants du centre triés par nom, filtrés par `recherche` (nom, e-mail ou entreprise)
export const listerApprenants = (recherche = '') =>
  appel(recherche.trim() ? `/apprenants/?recherche=${encodeURIComponent(recherche.trim())}` : '/apprenants/')
// Entreprises clientes du centre (liste « Entreprise » de « Nouvel apprenant », SCRUM-112), triées par raison sociale,
// avec SIRET, ville, OPCO, interlocuteur et nombre de salariés, filtrées par `recherche` (raison sociale, SIRET ou ville, SCRUM-120)
export const listerEntreprises = (recherche = '') =>
  appel(recherche.trim() ? `/entreprises/?recherche=${encodeURIComponent(recherche.trim())}` : '/entreprises/')
// SCRUM-113 : jusqu'à 10 établissements de l'annuaire officiel (raison sociale, SIRET, forme juridique, code NAF,
// adresse, code postal, ville) dont la raison sociale ou le SIRET correspond au texte (3 caractères au moins)
export const rechercherAnnuaire = (texte) => appel(`/annuaire-entreprises/?recherche=${encodeURIComponent(texte.trim())}`)
// SCRUM-113 : POST /entreprises/ ; 409 SIRET_DEJA_ENREGISTRE si le SIRET est déjà enregistré dans le centre
export const creerEntreprise = (entreprise) => appel('/entreprises/', entreprise)

// POST {prenom, nom, email} : formateur (SCRUM-26) ou apprenant (SCRUM-27)
const identite = (p) => ({ prenom: p.prenom.trim(), nom: p.nom.trim(), email: p.email.trim() })
// Formateur : + statut et NDA, facultatifs ; le NDA n'est envoyé que pour un sous-traitant (SCRUM-119)
export function creerFormateur(p) {
  const statut = p.statut || ''
  return appel('/formateurs/', {
    ...identite(p), statut, numero_nda: statut === 'SOUS_TRAITANT' ? (p.numero_nda || '').trim() : '',
  })
}

// SCRUM-119 : POST /formateurs/<id>/documents/ (multipart : « fichier » et « type » CV ou DIPLOME), un fichier par appel
export async function ajouterDocumentFormateur(id, type, fichier) {
  const formulaire = new FormData()
  formulaire.append('type', type)
  formulaire.append('fichier', fichier)
  let reponse
  try {
    reponse = await fetch(`${apiBase()}/formateurs/${id}/documents/`, { method: 'POST', credentials: 'include', body: formulaire })
  } catch {
    throw new ErreurSession('RESEAU', 'Le serveur ne répond pas : vérifiez que le backend est lancé.')
  }
  const json = await reponse.json().catch(() => null)
  if (!reponse.ok) throw new ErreurSession(json?.code || 'ERREUR', json?.detail || 'Le fichier n’a pas pu être enregistré.')
  return json
}
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
