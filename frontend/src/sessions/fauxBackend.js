// Faux backend des tests Sessions et planning : remplace fetch par des réponses en mémoire.
import { vi } from 'vitest'

export const FORMATIONS = [
  { id: 1, intitule: 'Excel avancé', duree_heures: '14.00' },
  { id: 2, intitule: 'Management d’équipe — les fondamentaux', duree_heures: '21.00' },
  { id: 3, intitule: 'Anglais professionnel', duree_heures: null },
]
export const FORMATEURS = [
  { id: 1, prenom: 'Sarah', nom: 'Dubois', email: 'sarah.dubois@exemple.fr', specialites: 'Management, bureautique' },
  { id: 4, prenom: 'Julien', nom: 'Lefèvre', email: 'julien.lefevre@exemple.fr', specialites: 'Management' },
]
export const APPRENANTS = [
  { id: 1, prenom: 'Camille', nom: 'Martin', email: 'camille.martin@acme.fr' },
  { id: 2, prenom: 'Hugo', nom: 'Bernard', email: 'hugo.bernard@acme.fr' },
]
export const SESSION_EXCEL = {
  id: 1, formation: 1, formation_intitule: 'Excel avancé', date_debut: '2026-11-18', date_fin: '2026-11-19', heure_debut: '09:00:00', heure_fin: '17:00:00',
  duree_heures: '14.00', modalite: 'PRESENTIEL', lieu: 'Lyon', lien_classe_virtuelle: '', nombre_places: 8, statut: 'PREVUE', formateurs: [1], apprenants: [1, 2, 3], nombre_apprenants: 3,
}

export const repondre = (status, corps) => ({ ok: status < 400, status, json: async () => corps })

// reponsePost(corps) : réponse du POST /sessions/ (par défaut 201 avec la session créée)
// reponseApprenant(corps) : réponse du POST /apprenants/ (par défaut 201, ajouté à la liste)
export function installerFauxBackend({ sessions = [SESSION_EXCEL], reponsePost, reponseApprenant } = {}) {
  const liste = [...sessions]
  const apprenants = [...APPRENANTS]
  const fetch = vi.fn(async (url, options) => {
    const chemin = url.replace(/^\/api/, '')
    if (options?.method === 'POST' && chemin === '/apprenants/') {
      const corps = JSON.parse(options.body)
      if (reponseApprenant) return reponseApprenant(corps)
      const cree = { ...corps, id: 50 }
      apprenants.push(cree)
      return repondre(201, cree)
    }
    if (options?.method === 'POST') {
      const corps = JSON.parse(options.body)
      if (reponsePost) return reponsePost(corps)
      const f = FORMATIONS.find((x) => x.id === corps.formation)
      const creee = { ...corps, id: 99, formation_intitule: f.intitule, statut: 'PREVUE', nombre_apprenants: corps.apprenants.length }
      liste.push(creee)
      return repondre(201, creee)
    }
    const donnees = { '/sessions/': liste, '/formateurs/': FORMATEURS, '/apprenants/': apprenants, '/formations/': FORMATIONS }[chemin]
    return donnees ? repondre(200, donnees) : repondre(404, {})
  })
  vi.stubGlobal('fetch', fetch)
  return fetch
}
