// Appels de l'API des comptes (adresse du backend : apiBase()) :
// « Créer un compte » (SCRUM-15) POST /auth/register, « Se connecter » (SCRUM-16) POST /auth/login
import { apiBase } from '../api'

// Page d'accueil (SCRUM-19) pas encore développée : page provisoire = tableau de bord (RG-CC-09, RG-CX-06)
export const PAGE_D_ACCUEIL = '/tableau-de-bord'

export const IDENTIFIANTS_INCORRECTS = 'E-mail ou mot de passe incorrect'

// Nom des champs côté serveur -> côté écran
const CHAMPS = { email: 'email', mot_de_passe: 'motDePasse', confirmation: 'confirmation', cgu_acceptees: 'cgu' }

// Refus du serveur : `erreurs` = { champ de l'écran: message } ; `code` = code lisible (ex. EMAIL_DEJA_UTILISE)
export class ErreurInscription extends Error {
  constructor(code, erreurs) {
    super(Object.values(erreurs)[0] || code)
    this.code = code
    this.erreurs = erreurs
  }
}

// `credentials: 'include'` : le navigateur garde et renvoie le cookie de session du serveur (connexion mémorisée)
async function envoyer(route, corps) {
  try {
    return await fetch(`${apiBase()}${route}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corps),
    })
  } catch {
    throw new ErreurInscription('RESEAU', { general: 'Le serveur ne répond pas : réessayez dans un instant.' })
  }
}

// 400 : un message sous chaque champ en erreur ; autre refus : message général
function refus(json, messageParDefaut) {
  const liste = json?.erreurs || (json?.champ ? [{ champ: json.champ, message: json.detail }] : [])
  const erreurs = Object.fromEntries(liste.map((e) => [CHAMPS[e.champ] || 'general', e.message]))
  if (!liste.length) erreurs.general = messageParDefaut
  return new ErreurInscription(json?.code || 'ERREUR', erreurs)
}

export async function creerCompte({ email, motDePasse, confirmation, cgu }) {
  const reponse = await envoyer('/auth/register',
    { email: email.trim(), mot_de_passe: motDePasse, confirmation, cgu_acceptees: cgu })
  const json = await reponse.json().catch(() => null)
  if (reponse.ok) return json
  if (reponse.status === 409) {
    throw new ErreurInscription(json?.code || 'EMAIL_DEJA_UTILISE', { email: 'Un compte existe déjà avec cet e-mail.' })
  }
  throw refus(json, 'Le compte n’a pas pu être créé. Réessayez.')
}

export async function seConnecter({ email, motDePasse }) {
  const reponse = await envoyer('/auth/login', { email: email.trim(), mot_de_passe: motDePasse })
  const json = await reponse.json().catch(() => null)
  if (reponse.ok) return json
  // RG-CX-05 : un seul message, sans dire si c'est l'e-mail ou le mot de passe qui est faux
  if (reponse.status === 401) throw new ErreurInscription('IDENTIFIANTS_INVALIDES', { general: IDENTIFIANTS_INCORRECTS })
  throw refus(json, 'La connexion a échoué. Réessayez.')
}

// Connexion mémorisée : GET /auth/moi renvoie le compte connecté ({ id, email }), ou null si personne ne l'est
// (ou si le serveur ne répond pas)
export async function compteConnecte() {
  try {
    const reponse = await fetch(`${apiBase()}/auth/moi`, { credentials: 'include' })
    return reponse.ok ? await reponse.json() : null
  } catch {
    return null
  }
}
