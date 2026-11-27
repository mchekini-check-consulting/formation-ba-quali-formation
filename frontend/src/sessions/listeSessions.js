// SCRUM-167 : règles de la liste des sessions (onglets, tri, dates, avancement, inscrits).
// Les dates des sessions sont des jours "AAAA-MM-JJ" ; « aujourd'hui » est calculé à l'heure de Paris.

// "AAAA-MM-JJ" du jour à Paris (en-CA écrit les dates dans ce format)
export const aujourdhuiParis = (maintenant = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(maintenant)

// Nombre de jours de `debut` à `fin` (0 si c'est le même jour)
function jours(debut, fin) {
  const utc = (iso) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)))
  return Math.round((utc(fin) - utc(debut)) / 86400000)
}

// EN_COURS : début ≤ aujourd'hui ≤ fin ; A_VENIR : début > aujourd'hui ; PASSEE : fin < aujourd'hui
export function etat(session, aujourdhui) {
  if (session.date_fin < aujourdhui) return 'PASSEE'
  if (session.date_debut > aujourdhui) return 'A_VENIR'
  return 'EN_COURS'
}

export const ONGLETS = [
  { cle: 'toutes', titre: 'Toutes' },
  { cle: 'en-cours', titre: 'En cours' },
  { cle: 'a-venir', titre: 'À venir' },
  { cle: 'passees', titre: 'Passées' },
]
const GARDER = {
  toutes: (e) => e !== 'PASSEE', // sessions en cours et à venir
  'en-cours': (e) => e === 'EN_COURS',
  'a-venir': (e) => e === 'A_VENIR',
  passees: (e) => e === 'PASSEE',
}
const parDebut = (a, b) => a.date_debut.localeCompare(b.date_debut) || a.id - b.id
// Passées : la plus récente d'abord
const parFinDecroissante = (a, b) => b.date_fin.localeCompare(a.date_fin) || b.date_debut.localeCompare(a.date_debut) || b.id - a.id

// Sessions de l'onglet, triées par date de début croissante (Passées : de la plus récente à la plus ancienne)
export function sessionsOnglet(sessions, onglet, aujourdhui) {
  return sessions.filter((s) => GARDER[onglet](etat(s, aujourdhui)))
    .sort(onglet === 'passees' ? parFinDecroissante : parDebut)
}

// Nombre de sessions de chaque onglet
export const nombresOnglets = (sessions, aujourdhui) =>
  Object.fromEntries(ONGLETS.map(({ cle }) => [cle, sessionsOnglet(sessions, cle, aujourdhui).length]))

// « Dans N jours », « Demain », « Jour X sur Y » ou « Terminée »
export function avancement(session, aujourdhui) {
  const e = etat(session, aujourdhui)
  if (e === 'PASSEE') return 'Terminée'
  if (e === 'A_VENIR') {
    const n = jours(aujourdhui, session.date_debut)
    return n === 1 ? 'Demain' : `Dans ${n} jours`
  }
  return `Jour ${jours(session.date_debut, aujourdhui) + 1} sur ${jours(session.date_debut, session.date_fin) + 1}`
}

const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
const jourMois = (iso) => `${Number(iso.slice(8, 10))} ${MOIS[Number(iso.slice(5, 7)) - 1]}`

// « 28 nov. » (un jour), « 26 – 28 nov. » (même mois), « 30 nov. – 2 déc. »
export function datesCourtes({ date_debut, date_fin }) {
  if (date_debut === date_fin) return jourMois(date_debut)
  if (date_debut.slice(0, 7) === date_fin.slice(0, 7)) return `${Number(date_debut.slice(8, 10))} – ${jourMois(date_fin)}`
  return `${jourMois(date_debut)} – ${jourMois(date_fin)}`
}

// Lieu, ou « Distanciel » pour une classe virtuelle
export const lieu = (session) => (session.modalite === 'DISTANCIEL' ? 'Distanciel' : session.lieu || '—')

// « Prénom Nom », séparés par des virgules
export const formateurs = (session) =>
  (session.formateurs_noms || []).map((f) => `${f.prenom} ${f.nom}`).join(', ') || '—'

// « N / places » et le remplissage de la barre (en %, 100 au plus)
export const inscrits = ({ nombre_apprenants: n, nombre_places: places }) => (places ? `${n} / ${places}` : String(n))
export const remplissage = ({ nombre_apprenants: n, nombre_places: places }) =>
  (places ? Math.min(100, Math.round((n / places) * 100)) : 0)
