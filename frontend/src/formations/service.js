// Accès aux formations. Tant que l'API n'est pas branchée, les données de démo sont gardées
// dans le navigateur (localStorage), comme dans la maquette. Les écrans n'appellent que ces fonctions.
import { hasProg, today } from './catalogue'
import { seed } from './demo'

// Erreur métier : `code` permet à l'écran d'ouvrir la bonne pop-up
export class ErreurMetier extends Error {
  constructor(code, message) { super(message || code); this.code = code }
}

const CLE = 'quali-formation-formations-v1'
let db = null

function charger() {
  if (db) return db
  try { db = JSON.parse(localStorage.getItem(CLE) || 'null') } catch { db = null }
  if (!Array.isArray(db)) db = seed()
  return db
}
function sauver() { try { localStorage.setItem(CLE, JSON.stringify(db)) } catch { /* navigation privée : on garde en mémoire */ } }
const copie = (x) => structuredClone(x)
function trouver(id) {
  const f = charger().find((x) => x.id === Number(id))
  if (!f) throw new ErreurMetier('INTROUVABLE', 'Formation introuvable.')
  return f
}

// RG29 : de la plus récemment mise à jour à la plus ancienne
export async function listerFormations() {
  return copie([...charger()].sort((a, b) => b.maj.localeCompare(a.maj) || b.id - a.id))
}

export async function obtenirFormation(id) { return copie(trouver(id)) }

// RG03 : référence FOR-AAAA-NNN, numéro suivant pour l'année en cours
function prochaineReference() {
  const annee = today().slice(0, 4)
  const nums = charger().map((f) => /^FOR-(\d{4})-(\d{3})$/.exec(f.ref || '')).filter((m) => m?.[1] === annee).map((m) => Number(m[2]))
  return `FOR-${annee}-${String(Math.max(0, ...nums) + 1).padStart(3, '0')}`
}

// SCRUM-20 : majuscules et espaces en trop ignorés pour comparer deux intitulés
const memeIntitule = (t) => String(t || '').trim().split(/\s+/).join(' ').toLocaleLowerCase('fr')

// Enregistre le formulaire avec le statut voulu (brouillon, incomplete, validee)
export async function enregistrerFormation(form, statut, { doublonAccepte = false } = {}) {
  const f = copie(form)
  // SCRUM-23 : une formation archivée ne se modifie pas, on la restaure d'abord
  if (f.id && trouver(f.id).statut === 'archivee') throw new ErreurMetier('ARCHIVEE', 'Une formation archivée ne se modifie pas : restaurez-la d’abord.')
  // RG02 : l'intitulé suffit pour un brouillon ; RG01 : intitulé, durée > 0 et modalité pour valider
  if (!String(f.title || '').trim()) throw new ErreurMetier('INTITULE_REQUIS', "L'intitulé est obligatoire.")
  if (statut !== 'brouillon' && !(Number(String(f.duree).replace(',', '.')) > 0 && f.modalite)) {
    throw new ErreurMetier('BASE_INCOMPLETE', "Renseignez l'intitulé et une durée supérieure à 0.")
  }
  // SCRUM-20 : une autre formation de l'organisme porte déjà cet intitulé
  const organisme = f.organisme || 'Cap Compétences'
  if (!doublonAccepte && charger().some((x) => x.id !== f.id && (x.organisme || 'Cap Compétences') === organisme && memeIntitule(x.title) === memeIntitule(f.title))) {
    throw new ErreurMetier('INTITULE_EXISTANT', 'Une formation portant le même nom existe déjà.')
  }
  f.statut = statut
  f.maj = today()
  // RG28 : une formation publiée qui repasse en brouillon redevient « À publier »
  if (statut === 'brouillon') { if (f.pub === 'publiee') f.pub = 'apublier' } else if (!f.pub) f.pub = 'apublier'
  const liste = charger()
  if (!f.id) {
    // RG03 + RG04 : référence attribuée au premier enregistrement, version 1
    f.id = Math.max(0, ...liste.map((x) => x.id)) + 1
    f.created = today(); f.version = 1; f.ref = prochaineReference(); f.sess = f.sess || []
    liste.push(f)
  } else {
    // RG04 : +1 à chaque enregistrement d'une modification
    const i = liste.findIndex((x) => x.id === f.id)
    f.version = (liste[i].version || 1) + 1
    f.sess = liste[i].sess // les sessions ne se modifient pas depuis le formulaire
    liste[i] = f
  }
  sauver()
  return copie(f)
}

// RG24 + RG26 + RG27 : publication
export async function publier(id, { confirmer = false } = {}) {
  const f = trouver(id)
  if (f.statut !== 'validee' && f.statut !== 'incomplete') throw new ErreurMetier('NON_PUBLIABLE', 'Seule une formation validée ou incomplète peut être publiée.')
  if (!hasProg(f)) throw new ErreurMetier('PROGRAMME_REQUIS', 'Une formation ne peut pas être publiée sans son programme.')
  if (f.statut === 'incomplete' && !confirmer) throw new ErreurMetier('CONFIRMATION_REQUISE', 'Confirmez la publication d’une formation incomplète.')
  f.pub = 'publiee'; f.maj = today(); sauver()
  return copie(f)
}

export async function retirerPublication(id) {
  const f = trouver(id)
  f.pub = 'apublier'; f.maj = today(); sauver()
  return copie(f)
}

// SCRUM-23 : la formation quitte « Toutes » pour le filtre « Archivées »
export async function archiver(id) {
  const f = trouver(id)
  f.statut = 'archivee'; f.maj = today(); sauver()
  return copie(f)
}

// SCRUM-23 : une formation restaurée revient en brouillon (RG28 : et donc « À publier »)
export async function restaurer(id) {
  const f = trouver(id)
  if (f.statut !== 'archivee') throw new ErreurMetier('NON_ARCHIVEE', 'Seule une formation archivée peut être restaurée.')
  f.statut = 'brouillon'; f.maj = today()
  if (f.pub === 'publiee') f.pub = 'apublier'
  sauver()
  return copie(f)
}

// SCRUM-23 : suppression définitive ; une formation qui a des sessions doit d'abord être archivée
export async function supprimer(id) {
  const f = trouver(id)
  if ((f.sess || []).length > 0 && f.statut !== 'archivee') throw new ErreurMetier('A_DES_SESSIONS', 'Cette formation a des sessions : archivez-la avant de la supprimer.')
  db = charger().filter((x) => x !== f); sauver()
}

// RG38 : début et fin obligatoires, fin ≥ début
export async function ajouterSession(id, { debut, fin, lieu, places }) {
  const f = trouver(id)
  if (f.statut === 'archivee') throw new ErreurMetier('ARCHIVEE', 'Une formation archivée ne reçoit plus de nouvelle session.')
  if (!debut || !fin || fin < debut) throw new ErreurMetier('DATES_INVALIDES', 'Indiquez une date de début et une date de fin (la fin après le début).')
  f.sess = [...(f.sess || []), { debut, fin, lieu: String(lieu || '').trim(), places: String(places || '').trim() }]
  sauver()
  return copie(f)
}

// Démo : recharger les exemples ou tout vider
export async function chargerExemples() { db = seed(); sauver() }
export async function viderDemo() { db = []; sauver() }
