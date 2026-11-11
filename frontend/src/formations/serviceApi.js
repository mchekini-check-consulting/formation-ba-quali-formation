// Accès aux formations par l'API Django (/formations/...). Mêmes fonctions que service.js (mode démo) :
// les écrans travaillent sur le format « maquette », traduit ici depuis / vers le format de l'API.
// Adresse du backend : apiBase() (src/api.js), passerelle de l'environnement ou /api en local.
import { apiBase } from '../api'
import { num, SEQ_MODES } from './catalogue'
import { ErreurMetier } from './service'

const MODALITE = { Présentiel: 'PRESENTIEL', Distanciel: 'DISTANCIEL', Mixte: 'MIXTE' }
const MODALITE_SEQ = { [SEQ_MODES[0]]: 'PRESENTIEL', [SEQ_MODES[1]]: 'DISTANCIEL_SYNCHRONE', [SEQ_MODES[2]]: 'DISTANCIEL_ASYNCHRONE' }
const PUBLICATION = { A_PUBLIER: 'apublier', PUBLIEE: 'publiee' }
const inverse = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [v, k]))
const MODALITE_FRONT = inverse(MODALITE), MODALITE_SEQ_FRONT = inverse(MODALITE_SEQ)

// "3.50" -> "3,5" ; null -> ""
const heures = (d) => (d === null || d === undefined || d === '' ? '' : String(Number(d)).replace('.', ','))
const decimal = (x) => (String(x ?? '').trim() === '' ? null : String(num(x)))

export function depuisApi(a) {
  return {
    id: a.id, ref: a.reference, version: a.version, title: a.intitule, duree: heures(a.duree_heures),
    modalite: MODALITE_FRONT[a.modalite], statut: a.statut.toLowerCase(), pub: PUBLICATION[a.publication],
    organisme: a.organisme, prepare: a.preparee_par,
    created: a.date_creation.slice(0, 10), maj: a.date_mise_a_jour.slice(0, 10),
    values: {
      ...a.valeurs,
      modules: a.sequences.map((s) => ({ seq: s.titre, duree: heures(s.duree_heures), objectif: s.objectif_vise, modalite: MODALITE_SEQ_FRONT[s.modalite],
        contenu: s.contenu, activites: s.methodes_activites, supports: s.supports || '', evalseq: s.evaluation || '' })),
    },
    others: a.autres_informations,
    sess: a.sessions.map((s) => ({ id: s.id, debut: s.date_debut, fin: s.date_fin, lieu: s.lieu, places: s.nombre_places === null ? '' : String(s.nombre_places) })),
  }
}

export function versApi(f) {
  const { modules = [], ...valeurs } = f.values || {}
  return {
    intitule: f.title || '', duree_heures: decimal(f.duree), modalite: MODALITE[f.modalite] || 'PRESENTIEL',
    organisme: f.organisme, preparee_par: f.prepare, valeurs, autres_informations: f.others || [],
    sequences: modules.map((m) => ({ titre: m.seq, duree_heures: decimal(m.duree), objectif_vise: m.objectif, modalite: MODALITE_SEQ[m.modalite] || m.modalite,
      contenu: m.contenu, methodes_activites: m.activites, supports: m.supports || '', evaluation: m.evalseq || '' })),
  }
}

async function appel(chemin, { method = 'GET', corps } = {}) {
  let reponse
  try {
    reponse = await fetch(`${apiBase()}${chemin}`, {
      method,
      credentials: 'include', // cookie de connexion (SCRUM-16) : le backend ne renvoie que les formations du compte
      headers: corps ? { 'Content-Type': 'application/json' } : {},
      body: corps ? JSON.stringify(corps) : undefined,
    })
  } catch {
    throw new ErreurMetier('RESEAU', 'Le serveur ne répond pas : vérifiez que le backend est lancé.')
  }
  if (reponse.status === 204) return null
  const json = await reponse.json().catch(() => null)
  if (!reponse.ok) {
    if (reponse.status === 404) throw new ErreurMetier('INTROUVABLE', 'Formation introuvable.')
    if (json?.code) throw new ErreurMetier(json.code, json.detail)
    throw new ErreurMetier('VALIDATION', `Certaines informations sont invalides (${Object.keys(json || {}).join(', ') || 'réponse du serveur'}).`)
  }
  return json
}

export const listerFormations = async () => (await appel('/formations/')).map(depuisApi)
export const obtenirFormation = async (id) => depuisApi(await appel(`/formations/${id}/`))

// statut voulu par l'écran : brouillon, validee, ou incomplete (« Valider quand même »)
// doublonAccepte : même intitulé qu'une autre formation accepté (SCRUM-20)
export async function enregistrerFormation(form, statut, { doublonAccepte = false } = {}) {
  const valider = statut === 'validee' || statut === 'incomplete'
  const corps = { ...versApi(form), action: valider ? 'valider' : 'brouillon', forcer: statut === 'incomplete', doublon_accepte: doublonAccepte }
  return depuisApi(await appel(form.id ? `/formations/${form.id}/` : '/formations/', { method: form.id ? 'PUT' : 'POST', corps }))
}

export const publier = async (id, { confirmer = false } = {}) => depuisApi(await appel(`/formations/${id}/publier/`, { method: 'POST', corps: { confirmer } }))
export const retirerPublication = async (id) => depuisApi(await appel(`/formations/${id}/retirer-publication/`, { method: 'POST', corps: {} }))
// SCRUM-23
export const archiver = async (id) => depuisApi(await appel(`/formations/${id}/archiver/`, { method: 'PATCH', corps: {} }))
export const restaurer = async (id) => depuisApi(await appel(`/formations/${id}/restaurer/`, { method: 'PATCH', corps: {} }))
export const supprimer = async (id) => { await appel(`/formations/${id}/`, { method: 'DELETE' }) }

export async function ajouterSession(id, { debut, fin, lieu, places }) {
  const n = String(places || '').trim()
  const corps = { date_debut: debut || null, date_fin: fin || null, lieu: String(lieu || '').trim(), nombre_places: /^\d+$/.test(n) ? Number(n) : null }
  return depuisApi(await appel(`/formations/${id}/sessions/`, { method: 'POST', corps }))
}
