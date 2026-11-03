// Appel de l'API « Créer un compte » (SCRUM-15) : POST /auth/register (adresse du backend : apiBase())
import { apiBase } from '../api'

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

export async function creerCompte({ email, motDePasse, confirmation, cgu }) {
  let reponse
  try {
    reponse = await fetch(`${apiBase()}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), mot_de_passe: motDePasse, confirmation, cgu_acceptees: cgu }),
    })
  } catch {
    throw new ErreurInscription('RESEAU', { general: 'Le serveur ne répond pas : réessayez dans un instant.' })
  }
  const json = await reponse.json().catch(() => null)
  if (reponse.ok) return json
  if (reponse.status === 409) {
    throw new ErreurInscription(json?.code || 'EMAIL_DEJA_UTILISE', { email: 'Un compte existe déjà avec cet e-mail.' })
  }
  const liste = json?.erreurs || (json?.champ ? [{ champ: json.champ, message: json.detail }] : [])
  const erreurs = Object.fromEntries(liste.map((e) => [CHAMPS[e.champ] || 'general', e.message]))
  if (!liste.length) erreurs.general = 'Le compte n’a pas pu être créé. Réessayez.'
  throw new ErreurInscription(json?.code || 'ERREUR', erreurs)
}
