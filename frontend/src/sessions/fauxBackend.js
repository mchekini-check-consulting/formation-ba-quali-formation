// Faux backend des tests Sessions et planning : remplace fetch par des réponses en mémoire.
import { vi } from 'vitest'

export const FORMATIONS = [
  { id: 1, intitule: 'Excel avancé', duree_heures: '14.00', modalite: 'DISTANCIEL' },
  { id: 2, intitule: 'Management d’équipe — les fondamentaux', duree_heures: '21.00', modalite: 'PRESENTIEL' },
  { id: 3, intitule: 'Anglais professionnel', duree_heures: null, modalite: 'MIXTE' },
]
// SCRUM-119 : triés par nom, avec statut, NDA et nombre de sessions
export const FORMATEURS = [
  { id: 1, prenom: 'Sarah', nom: 'Dubois', email: 'sarah.dubois@exemple.fr', specialites: 'Management, bureautique', entreprise: '',
    statut: '', numero_nda: '', nombre_sessions: 3 },
  { id: 4, prenom: 'Julien', nom: 'Lefèvre', email: 'julien.lefevre@exemple.fr', specialites: 'Management', entreprise: 'Cap Conseil',
    statut: 'SALARIE', numero_nda: '', nombre_sessions: 1 },
]
// SCRUM-112 : triés par nom, avec téléphone, statut, entreprise (cliente ou ancien texte), poste et nombre de sessions
const apprenant = (id, prenom, nom, email, entreprise, autres = {}) => ({
  id, prenom, nom, email, entreprise, telephone: '', statut: '', entreprise_id: null, poste: '', nombre_sessions: 0, ...autres,
})
export const APPRENANTS = [
  apprenant(1, 'Camille', 'Martin', 'camille.martin@acme.fr', 'Acme',
    { telephone: '0745213698', statut: 'SALARIE', poste: 'Cheffe de projet', nombre_sessions: 2 }),
  apprenant(2, 'Hugo', 'Bernard', 'hugo.bernard@acme.fr', 'Acme', { nombre_sessions: 1 }),
  apprenant(3, 'Léa', 'Moreau', 'lea.moreau@gmail.com', '', { statut: 'DEMANDEUR_EMPLOI' }),
  apprenant(5, 'Yanis', 'Petit', 'yanis.petit@marine.fr', 'Globex', { telephone: '0612345678', statut: 'PARTICULIER', nombre_sessions: 1 }),
]
// SCRUM-120 : triées par raison sociale, avec SIRET, ville, OPCO, interlocuteur et nombre de salariés
// SCRUM-113 : établissements de l'annuaire officiel
export const ANNUAIRE = [
  { siret: '38945612300034', raison_sociale: 'SOCIETE DURAND', forme_juridique: 'SAS', code_naf: '47.11B', adresse: '12 RUE DE LA PAIX',
    code_postal: '75002', ville: 'PARIS' },
  { siret: '51287496300027', raison_sociale: 'DURAND ET FILS', forme_juridique: 'SARL', code_naf: '', adresse: '3 QUAI DU RHONE',
    code_postal: '69002', ville: 'LYON' },
]
export const ENTREPRISES = [
  { id: 8, raison_sociale: 'Globex', siret: '52874196300015', ville: 'Nantes', opco: 'AKTO', interlocuteur: '', nombre_salaries: 1 },
  { id: 7, raison_sociale: 'Société Durand', siret: '38945612300034', ville: 'Paris', opco: '', interlocuteur: 'Hugo Weber', nombre_salaries: 2 },
]

// Même recherche que le backend, sans tenir compte des majuscules : prénom et nom, e-mail, et entreprise pour un apprenant
const rechercher = (personnes, texte, avecEntreprise) => {
  const r = texte.toLowerCase()
  return personnes.filter((p) => [`${p.prenom} ${p.nom}`, p.email, avecEntreprise ? p.entreprise : '']
    .some((t) => (t || '').toLowerCase().includes(r)))
}
export const SESSION_EXCEL = {
  id: 1, formation: 1, formation_intitule: 'Excel avancé', date_debut: '2026-11-18', date_fin: '2026-11-19', heure_debut: '09:00:00', heure_fin: '17:00:00',
  duree_heures: '14.00', modalite: 'PRESENTIEL', lieu: 'Lyon', lien_classe_virtuelle: '', nombre_places: 8, statut: 'PREVUE', formateurs: [1], apprenants: [1, 2, 3], nombre_apprenants: 3,
}

export const repondre = (status, corps) => ({ ok: status < 400, status, json: async () => corps })

// reponsePost(corps) : réponse du POST /sessions/ (par défaut 201 avec la session créée)
// reponsePersonne(corps) : réponse du POST /formateurs/ ou /apprenants/ (par défaut 201, ajouté à la liste)
// entreprises : entreprises clientes du centre (GET /entreprises/, SCRUM-112)
// reponseDocument(type, fichier) : réponse du POST /formateurs/<id>/documents/ (par défaut 201, SCRUM-119)
// annuaire : établissements de GET /annuaire-entreprises/ ; reponseEntreprise(corps) : réponse du POST /entreprises/
// (par défaut 201, ajoutée à la liste) (SCRUM-113)
export function installerFauxBackend({
  sessions = [SESSION_EXCEL], formations = FORMATIONS, entreprises: entreprisesDepart = ENTREPRISES, reponsePost, reponsePersonne,
  reponseDocument, annuaire = ANNUAIRE, reponseEntreprise,
} = {}) {
  const entreprises = [...entreprisesDepart]
  const liste = [...sessions]
  const personnes = { '/formateurs/': [...FORMATEURS], '/apprenants/': [...APPRENANTS] }
  const fetch = vi.fn(async (url, options) => {
    const [chemin, requete] = url.replace(/^\/api/, '').split('?')
    const documents = /^\/formateurs\/(\d+)\/documents\/$/.exec(chemin)
    if (documents) {
      const [type, fichier] = [options.body.get('type'), options.body.get('fichier')]
      if (reponseDocument) return reponseDocument(type, fichier)
      return repondre(201, { id: 1, type, nom_fichier: fichier.name, format: fichier.name.split('.').pop(), taille: fichier.size })
    }
    if (options?.method === 'POST' && personnes[chemin]) {
      const corps = JSON.parse(options.body)
      if (reponsePersonne) return reponsePersonne(corps)
      const entreprise = entreprises.find((e) => e.id === corps.entreprise_id)?.raison_sociale || ''
      const cree = { specialites: '', ...corps, entreprise, id: 50, nombre_sessions: 0 }
      if (chemin === '/formateurs/') cree.entreprise = ''
      personnes[chemin].push(cree)
      return repondre(201, cree)
    }
    if (chemin === '/annuaire-entreprises/') return annuaire instanceof Error ? repondre(503, { code: 'SERVICE_INDISPONIBLE' }) : repondre(200, annuaire)
    if (chemin === '/entreprises/' && options?.method === 'POST') {
      const corps = JSON.parse(options.body)
      if (reponseEntreprise) return reponseEntreprise(corps)
      const creee = { id: 60, raison_sociale: corps.raison_sociale, siret: corps.siret, ville: corps.ville, opco: '',
        interlocuteur: `${corps.interlocuteur_prenom} ${corps.interlocuteur_nom}`.trim(), nombre_salaries: 0 }
      entreprises.push(creee)
      entreprises.sort((a, b) => a.raison_sociale.localeCompare(b.raison_sociale))
      return repondre(201, creee)
    }
    if (chemin === '/entreprises/') {
      // Même recherche que le backend : raison sociale, SIRET (espaces ignorés) ou ville
      const r = (new URLSearchParams(requete).get('recherche') || '').toLowerCase()
      return repondre(200, entreprises.filter((e) => !r || [e.raison_sociale, e.ville].some((t) => t.toLowerCase().includes(r))
        || (r.replaceAll(' ', '') && e.siret.includes(r.replaceAll(' ', '')))))
    }
    const recherche = new URLSearchParams(requete).get('recherche')
    if (recherche && personnes[chemin]) return repondre(200, rechercher(personnes[chemin], recherche, chemin === '/apprenants/'))
    if (options?.method === 'POST') {
      const corps = JSON.parse(options.body)
      if (reponsePost) return reponsePost(corps)
      const f = FORMATIONS.find((x) => x.id === corps.formation)
      const creee = { ...corps, id: 99, formation_intitule: f.intitule, statut: 'PREVUE', nombre_apprenants: corps.apprenants.length }
      liste.push(creee)
      return repondre(201, creee)
    }
    const donnees = { '/sessions/': liste, ...personnes, '/formations/': formations }[chemin]
    return donnees ? repondre(200, donnees) : repondre(404, {})
  })
  vi.stubGlobal('fetch', fetch)
  return fetch
}
