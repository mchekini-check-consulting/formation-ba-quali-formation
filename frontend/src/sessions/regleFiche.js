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
