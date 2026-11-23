// Modèles de documents (épic SCRUM-125) : appels à l'API Django (/modeles/...).
// Adresse du backend : apiBase() (src/api.js), passerelle de l'environnement ou /api en local.
import { apiBase } from '../api'
import { ErreurMetier } from '../formations/service'

// SCRUM-210 : GET /modeles/resume -> { nb_modeles, nb_formations } du compte connecté (cookie de connexion)
export async function resumeModeles() {
  let reponse
  try {
    reponse = await fetch(`${apiBase()}/modeles/resume`, { credentials: 'include' })
  } catch {
    throw new ErreurMetier('RESEAU', 'Le serveur ne répond pas : vérifiez que le backend est lancé.')
  }
  const json = await reponse.json().catch(() => null)
  // 401 NON_CONNECTE : le message du backend, avec le lien « Se connecter » (ErreurChargement)
  if (!reponse.ok) throw new ErreurMetier(json?.code || 'ERREUR', json?.detail || 'Les modèles n’ont pas pu être chargés. Réessayez.')
  return json
}
