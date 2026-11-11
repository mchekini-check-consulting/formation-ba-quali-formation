import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import ErreurChargement from '../components/ErreurChargement'
import Icone from '../components/Icone'
import { dateFr, heureFr, initiales, lireSession, MODALITES, STATUTS } from '../sessions/serviceApi'
import '../sessions/sessions.css'

// Fiche d'une session (SCRUM-36), ouverte depuis Sessions et planning : informations, apprenants et formateurs,
// bouton « Modifier ». Après une modification, la page « Modifier la session » revient ici avec state.message.

// Lieu affiché : l'adresse en présentiel, le lien en classe virtuelle
function lieu(s) {
  if (s.modalite !== 'CLASSE_VIRTUELLE') return s.lieu || '—'
  return s.lien_classe_virtuelle
    ? <a href={s.lien_classe_virtuelle} target="_blank" rel="noreferrer">{MODALITES.CLASSE_VIRTUELLE}</a>
    : MODALITES.CLASSE_VIRTUELLE
}

function Personnes({ titre, personnes, detail, classe }) {
  return (
    <section className={`card fs-bloc ${classe}`}>
      <h2>{titre}</h2>
      <ul aria-label={titre}>
        {personnes.map((p) => (
          <li key={p.id}>
            <span className="ns-avatar" aria-hidden="true">{initiales(p)}</span>
            <span className="ns-nom"><b>{p.prenom} {p.nom}</b>{detail(p) && <span>{detail(p)}</span>}</span>
          </li>
        ))}
        {personnes.length === 0 && <li className="ns-vide">Aucune personne rattachée.</li>}
      </ul>
    </section>
  )
}

function FicheSession() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [session, setSession] = useState(null)
  const [erreur, setErreur] = useState(null)
  const [message, setMessage] = useState(location.state?.message || null)

  useEffect(() => {
    lireSession(id).then(setSession).catch(setErreur)
  }, [id])

  const retour = <Link to="/sessions" className="ns-retour"><Icone nom="back" taille={16} />Sessions et planning</Link>
  if (!session) {
    return <div className="wrap">{retour}{erreur ? <ErreurChargement erreur={erreur} /> : <p className="chargement">Chargement de la session…</p>}</div>
  }

  const s = session
  const heures = s.heure_debut && s.heure_fin ? `${heureFr(s.heure_debut)} – ${heureFr(s.heure_fin)}` : '—'
  const places = s.nombre_places ? `${s.nombre_apprenants} / ${s.nombre_places}` : String(s.nombre_apprenants)
  const infos = [
    ['Dates', <>{dateFr(s.date_debut)} →<br />{dateFr(s.date_fin)}</>],
    ['Horaires', heures],
    ['Durée', s.duree_heures === null ? '—' : `${Number(s.duree_heures)} h`],
    [s.modalite === 'CLASSE_VIRTUELLE' ? 'Modalité' : 'Lieu', lieu(s)],
    ['Places', places],
  ]

  return (
    <div className="wrap">
      {message && (
        <div className="sp-bandeau" role="status">
          <Icone nom="check" taille={18} epaisseur={2.4} /><span>{message}</span>
          <button type="button" className="sp-fermer" aria-label="Fermer le message" onClick={() => setMessage(null)}><Icone nom="x" taille={18} /></button>
        </div>
      )}
      {retour}
      <div className="page-head">
        <div className="fs-titre"><h1>{s.formation_intitule}</h1><span className="sp-statut">{STATUTS[s.statut] || s.statut}</span></div>
        <button type="button" className="btn btn-primary" onClick={() => navigate(`/sessions/${s.id}/modifier`)}>
          <Icone nom="pen" taille={18} />Modifier
        </button>
      </div>

      <dl className="fs-infos">
        {infos.map(([titre, valeur]) => (
          <div key={titre} className="card"><dt>{titre}</dt><dd>{valeur}</dd></div>
        ))}
      </dl>

      <div className="fs-personnes">
        <Personnes titre={`Apprenants · ${s.apprenants.length}`} personnes={s.apprenants} detail={(p) => p.email} classe="fs-apprenants" />
        <Personnes titre="Formateur(s)" personnes={s.formateurs} detail={() => ''} classe="fs-formateurs" />
      </div>
    </div>
  )
}

export default FicheSession
