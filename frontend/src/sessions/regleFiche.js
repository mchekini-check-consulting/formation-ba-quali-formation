// SCRUM-168 : règles d'affichage de la fiche d'une session (onglets et textes de l'en-tête)
import { pluriel } from '../formations/catalogue'
import { dateFr, MODALITES } from './serviceApi'

// Onglets de la fiche, dans l'ordre des maquettes ; `nombre` : nombre affiché dans la pastille
export const ONGLETS_FICHE = [
  { cle: 'apercu', titre: 'Aperçu' },
  { cle: 'apprenants', titre: 'Apprenants', nombre: (s) => s.nombre_apprenants },
  { cle: 'formateurs', titre: 'Formateurs', nombre: (s) => s.nombre_formateurs },
  { cle: 'entreprises', titre: 'Entreprises', nombre: (s) => s.nombre_entreprises },
  { cle: 'planning', titre: 'Planning', nombre: (s) => `${s.nombre_jours} j` },
  { cle: 'documents', titre: 'Documents' },
  { cle: 'questionnaires', titre: 'Questionnaires' },
  { cle: 'quiz', titre: 'Quiz' },
  { cle: 'suivi-envois', titre: 'Suivi des envois' },
]

// « Du 03/12/2026 au 05/12/2026 · Présentiel · Lyon » ; « … · Distanciel » pour une session à distance
export function datesEtLieu(s) {
  const lieu = s.modalite === 'DISTANCIEL' ? null : s.lieu
  return [`Du ${dateFr(s.date_debut)} au ${dateFr(s.date_fin)}`, MODALITES[s.modalite] || s.modalite, lieu]
    .filter(Boolean).join(' · ')
}

// « 3 / 8 inscrits », « Formateur : Nadia Haddad », « Atelier Leroy, Société Durand ». Aucune entreprise : rien n'est
// affiché à la place (choix de la BA, à la place du « — » prévu au CA3)
export function resumeParticipants(s) {
  const inscrits = s.nombre_places
    ? `${s.nombre_apprenants} / ${s.nombre_places} inscrits`
    : `${s.nombre_apprenants} ${pluriel(s.nombre_apprenants, 'inscrit')}`
  const noms = s.formateurs.map((f) => `${f.prenom} ${f.nom}`).join(', ') || '—'
  return [inscrits, `${pluriel(s.formateurs.length, 'Formateur')} : ${noms}`, s.entreprises.join(', ')].filter(Boolean)
}

// ---- Onglet Apprenants (SCRUM-179) ----
const LIBELLES_STATUT = {
  SALARIE: 'Salarié', DEMANDEUR_EMPLOI: 'Demandeur d’emploi', INDEPENDANT: 'Indépendant', PARTICULIER: 'Particulier',
}

// Places restantes ; null pour une session sans nombre de places (pas de limite)
export const placesRestantes = ({ nombre_places: places, apprenants }) =>
  (places ? Math.max(places - apprenants.length, 0) : null)

// « 3 / 8 · 5 places restantes » ; « 3 inscrits » sans nombre de places
export function resumePlaces(donnees) {
  const n = donnees.apprenants.length
  const restantes = placesRestantes(donnees)
  if (restantes === null) return `${n} ${pluriel(n, 'inscrit')}`
  return `${n} / ${donnees.nombre_places} · ${restantes} ${pluriel(restantes, 'place restante', 'places restantes')}`
}

// Colonne « Inscrit via » : l'entreprise et « Salarié · poste », sinon « Individuel » et le statut
export function inscritVia(a) {
  const statut = LIBELLES_STATUT[a.statut] || ''
  if (a.entreprise) return { titre: a.entreprise, detail: [statut, a.poste].filter(Boolean).join(' · ') }
  return { titre: 'Individuel', detail: statut }
}
