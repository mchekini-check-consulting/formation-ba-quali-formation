// Modèles de documents (épic SCRUM-125) : appels à l'API Django (/modeles/...).
// Adresse du backend : apiBase() (src/api.js), passerelle de l'environnement ou /api en local.
import { apiBase } from '../api'
import { ErreurMetier } from '../formations/service'

// Statuts d'un modèle générique (RG4)
export const STATUTS = { ORIGINE: 'Modèle d’origine', PERSONNALISE: 'Personnalisé', IMPORTE: 'Mon document' }

// GET avec le cookie de connexion : le backend ne renvoie que les données du compte connecté
async function lire(chemin) {
  let reponse
  try {
    reponse = await fetch(`${apiBase()}${chemin}`, { credentials: 'include' })
  } catch {
    throw new ErreurMetier('RESEAU', 'Le serveur ne répond pas : vérifiez que le backend est lancé.')
  }
  const json = await reponse.json().catch(() => null)
  // 401 NON_CONNECTE, 404 MODELE_INTROUVABLE : le message du backend (avec « Se connecter » pour le 401)
  if (!reponse.ok) throw new ErreurMetier(json?.code || 'ERREUR', json?.detail || 'Les modèles n’ont pas pu être chargés. Réessayez.')
  return json
}

// SCRUM-210 : GET /modeles/resume -> { nb_modeles, nb_formations } du compte connecté
export const resumeModeles = () => lire('/modeles/resume')

// SCRUM-211/212 : GET /modeles/ -> { modeles: [{ type, nom, statut, contenu, date_maj, variables }], parametres_complets }
export const listerModeles = () => lire('/modeles/')

// SCRUM-211 : GET /modeles/<type> -> { type, nom, statut, contenu, variables: [{ code, libelle }] }
export const obtenirModele = (type) => lire(`/modeles/${encodeURIComponent(type)}`)
