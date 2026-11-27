import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PageEnChargement } from '../components/ErreurChargement'
import { ConfirmDialog } from '../components/Modal'
import { useToast } from '../components/toastContext'
import { pluriel } from '../formations/catalogue'
import { telechargerWord } from '../modeles/serviceApi'
import { adressePdf, dateFr, documentsSession, genererDocuments } from './serviceApi'
import './sessions.css'

// Colonne « Modèle utilisé » (RG20) : modèle de la formation, sinon modèle générique (ou d'origine)
const SOURCES = { FORMATION: 'Modèle de la formation', GENERIQUE: 'Modèle générique' }
// Documents d'un type au pluriel, avec l'accord de « généré » (fenêtre « Générer à nouveau ? »)
const PLURIELS = {
  CONVENTION: 'conventions déjà générées', CONTRAT: 'contrats déjà générés',
  CONVOCATION: 'convocations déjà générées', ATTESTATION: 'attestations déjà générées',
}
const jourMois = (iso) => dateFr(iso.slice(0, 10)).slice(0, 5)

// « 21 et 22/11/2026 · Lyon, salle A · Formateur : Nadia Benali » (maquette SCRUM-220-1)
function resume(session) {
  const dates = session.date_debut === session.date_fin ? dateFr(session.date_debut)
    : `${dateFr(session.date_debut)} au ${dateFr(session.date_fin)}`
  const formateurs = session.formateurs.length ? `${pluriel(session.formateurs.length, 'Formateur')} : ${session.formateurs.join(', ')}` : ''
  return [dates, session.modalite === 'DISTANCIEL' ? 'À distance' : session.lieu, formateurs].filter(Boolean).join(' · ')
}

// Un type de document : ligne du type (modèle utilisé, destinataires, statut, « Générer » / « Générer à nouveau »),
// puis une ligne par document généré (destinataire, « Télécharger »)
function TypeDocument({ sessionId, document, envoi, onGenerer, onTelecharger }) {
  const { type, nom, source, generes } = document
  const genere = generes.length > 0
  return (
    <>
      <div className="row sd-type" role="row">
        <span className="t" role="cell"><b>{nom}</b><span>{genere ? `Généré le ${jourMois(generes[0].date_generation)}` : 'Pas encore généré'}</span></span>
        <span role="cell"><span className={`sd-modele sd-modele-${source.toLowerCase()}`}>{SOURCES[source]}</span></span>
        <span role="cell" className="sd-dest">{genere ? `${generes.length} ${pluriel(generes.length, 'destinataire')}` : '—'}</span>
        <span role="cell"><span className={`pill ${genere ? 'st-validee' : 'st-brouillon'}`}>{genere ? 'Généré' : 'À générer'}</span></span>
        <span role="cell" className="sd-action">
          <button type="button" className={`btn btn-sm ${genere ? 'btn-line' : 'btn-primary'}`} disabled={envoi === type}
            onClick={() => onGenerer(document)}>
            {envoi === type ? 'Génération…' : (genere ? 'Générer à nouveau' : 'Générer')}
          </button>
        </span>
      </div>
      {generes.map((d) => (
        <div key={d.id} className="row sd-doc" role="row">
          <span className="t" role="cell"><span>{d.numero}</span></span>
          <span role="cell" />
          <span role="cell" className="sd-dest">{d.destinataire}</span>
          <span role="cell" />
          <span role="cell" className="sd-action">
            <button type="button" className="sd-telecharger" aria-label={`Télécharger ${nom} - ${d.destinataire}`}
              onClick={() => onTelecharger(adressePdf(sessionId, d.id), `${nom} - ${d.destinataire} - ${d.numero}.pdf`)}>
              Télécharger
            </button>
          </span>
        </div>
      ))}
    </>
  )
}

// SCRUM-220 (maquette SCRUM-220-1) : page d'une session, onglet Documents : pour chaque document, le modèle utilisé
// (RG20), la génération des PDF remplis (un par apprenant, un par entreprise cliente pour la convention) et leur
// téléchargement. Les documents générés sont figés (RG22). Participants et Émargement : autres US (grisés).
// La signature (Yousign) de la maquette n'est pas dans cette US.
export function SessionDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [donnee, setDonnee] = useState(null)
  const [erreurChargement, setErreurChargement] = useState(null)
  const [erreur, setErreur] = useState(null)
  const [envoi, setEnvoi] = useState(null) // type en cours de génération
  const [aConfirmer, setAConfirmer] = useState(null) // « Générer à nouveau ? »

  const charger = useCallback(() => documentsSession(id).then(setDonnee), [id])
  useEffect(() => { charger().catch(setErreurChargement) }, [charger])

  async function generer({ type }) {
    setAConfirmer(null)
    setEnvoi(type)
    setErreur(null)
    try {
      const { nombre } = await genererDocuments(id, type)
      toast(`${nombre} ${pluriel(nombre, 'document')} ${pluriel(nombre, 'généré', 'générés')}.`)
      await charger()
    } catch (e) {
      setErreur(e.message)
    } finally {
      setEnvoi(null)
    }
  }

  async function telecharger(adresse, nomFichier) {
    setErreur(null)
    try {
      await telechargerWord(adresse, nomFichier, 'Le PDF n’a pas pu être téléchargé. Réessayez.')
    } catch (e) {
      setErreur(e.message)
    }
  }

  if (!donnee) return <PageEnChargement erreur={erreurChargement} texte="Chargement de la session…" />
  const { session, documents } = donnee
  return (
    <div className="wrap session-detail">
      <div className="sd-fil">
        <button type="button" className="btn btn-line btn-sm" onClick={() => navigate('/sessions')}>← Retour</button>
        <nav aria-label="Fil d'Ariane"><Link to="/sessions">Sessions</Link><span aria-hidden="true"> › </span><b aria-current="page">{session.formation}</b></nav>
      </div>
      <div className="page-head sd-tete">
        <h1>{session.formation}</h1>
        <p>{resume(session)}</p>
      </div>
      <section className="card sd-carte">
        <div className="toolbar">
          <div className="tabs" role="tablist" aria-label="Session">
            <button type="button" className="tab" role="tab" aria-selected="false" disabled title="Bientôt disponible">Participants</button>
            <button type="button" className="tab" role="tab" aria-selected="true">Documents</button>
            <button type="button" className="tab" role="tab" aria-selected="false" disabled title="Bientôt disponible">Émargement</button>
          </div>
        </div>
        {erreur && <p className="sd-erreur" role="alert">{erreur}</p>}
        <div className="rows sd-table" role="table" aria-label="Documents de la session">
          <div className="row head" role="row">
            <span role="columnheader">Document</span>
            <span role="columnheader">Modèle utilisé</span>
            <span role="columnheader">Destinataire</span>
            <span role="columnheader">Statut</span>
            <span role="columnheader" aria-label="Action" />
          </div>
          {documents.map((d) => (
            <TypeDocument key={d.type} sessionId={session.id} document={d} envoi={envoi}
              onGenerer={(doc) => (doc.generes.length ? setAConfirmer(doc) : generer(doc))} onTelecharger={telecharger} />
          ))}
        </div>
      </section>
      {aConfirmer && (
        <ConfirmDialog titre="Générer à nouveau ?" action="Générer à nouveau" icone="alert"
          fondIcone="var(--warn-soft)" couleurIcone="var(--warn)"
          texte={`Les ${PLURIELS[aConfirmer.type]} pour cette session seront remplacé${aConfirmer.type === 'CONTRAT' ? 's' : 'es'} par de nouvelles versions, créées avec le modèle actuel.`}
          onAnnuler={() => setAConfirmer(null)} onOk={() => generer(aConfirmer)} />
      )}
    </div>
  )
}
