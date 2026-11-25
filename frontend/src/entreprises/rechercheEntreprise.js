import { apiBase } from '../api'

// Recherche d'une entreprise par SIRET (GET /entreprises/<siret>/ du backend, qui interroge l'API publique
// « Recherche d'entreprises » de l'État). Partagée : première connexion (SCRUM-221), entreprise cliente (SCRUM-113).
// Ne lève jamais d'erreur : la saisie manuelle doit toujours rester possible.
//   { statut: 'trouvee', entreprise: { siret, raison_sociale, adresse } }
//   { statut: 'introuvable' } : SIRET inconnu, invalide, service indisponible ou serveur injoignable
export async function rechercherEntreprise(siret) {
  try {
    const reponse = await fetch(`${apiBase()}/entreprises/${encodeURIComponent(siret)}/`, { credentials: 'include' })
    if (reponse.ok) return { statut: 'trouvee', entreprise: await reponse.json() }
  } catch {
    // serveur injoignable ou réponse illisible : même message que « non trouvé » (critère 4)
  }
  return { statut: 'introuvable' }
}
