// Modèles de documents (épic SCRUM-125) : appels à l'API Django (/modeles/...).
// Adresse du backend : apiBase() (src/api.js), passerelle de l'environnement ou /api en local.
import { apiBase } from '../api'
import { pluriel } from '../formations/catalogue'
import { ErreurMetier } from '../formations/service'

// Statuts d'un modèle générique (RG4)
export const STATUTS = { ORIGINE: 'Modèle d’origine', PERSONNALISE: 'Personnalisé', IMPORTE: 'Mon document' }

// Appel avec le cookie de connexion : le backend ne lit et n'écrit que les données du compte connecté
async function lire(chemin, options = {}) {
  let reponse
  try {
    reponse = await fetch(`${apiBase()}${chemin}`, { credentials: 'include', ...options })
  } catch {
    throw new ErreurMetier('RESEAU', 'Le serveur ne répond pas : vérifiez que le backend est lancé.')
  }
  const json = await reponse.json().catch(() => null)
  // 401 NON_CONNECTE, 404 MODELE_INTROUVABLE, 400 CONTENU_INVALIDE : le message du backend (avec « Se connecter » pour le 401)
  if (!reponse.ok) throw new ErreurMetier(json?.code || 'ERREUR', json?.detail || 'Les modèles n’ont pas pu être chargés. Réessayez.')
  return json
}

// SCRUM-210 : GET /modeles/resume -> { nb_modeles, nb_formations } du compte connecté
export const resumeModeles = () => lire('/modeles/resume')

// SCRUM-211/212 : GET /modeles/ -> { modeles: [{ type, nom, statut, contenu, date_maj, variables }], parametres_complets }
export const listerModeles = () => lire('/modeles/')

// SCRUM-211 : GET /modeles/<type> -> { type, nom, statut, contenu, variables: [{ code, libelle }] }
export const obtenirModele = (type) => lire(`/modeles/${encodeURIComponent(type)}`)

// SCRUM-213 : PUT /modeles/<type> { contenu } -> le modèle enregistré (PERSONNALISE) + nb_formations_utilisant, nb_formations
export const enregistrerModele = (type, contenu) => lire(`/modeles/${encodeURIComponent(type)}`, {
  method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contenu }),
})

// Message après « Enregistrer » (maquette SCRUM-213-2, RG6) ; sans formation, seulement la confirmation
export function messageEnregistrement({ nb_formations_utilisant: utilisant, nb_formations: total }) {
  if (!total) return 'Modèle générique enregistré.'
  return `Modèle générique enregistré. ${utilisant} ${pluriel(utilisant, 'formation')} sur ${total} `
    + `${utilisant > 1 ? 'utilisent' : 'utilise'} automatiquement cette nouvelle version (celles qui n’ont pas adapté ce document).`
}
