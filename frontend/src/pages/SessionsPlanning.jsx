import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Icone from '../components/Icone'
import { MenuPartiesPrenantes, PanneauApprenant } from '../sessions/PartiesPrenantes'
import { jour, listerSessions, MODALITES, moisCourt, periode, STATUTS } from '../sessions/serviceApi'
import '../sessions/sessions.css'

// Page Sessions et planning (SCRUM-25) : liste des sessions et bouton « Nouvelle session ».
// « Parties prenantes » : création d'un apprenant dans un panneau latéral (SCRUM-27).
// Après une création, le formulaire revient ici avec le message de confirmation (state.message).
function SessionsPlanning() {
  const navigate = useNavigate()
  const location = useLocation()
  const [sessions, setSessions] = useState(null)
  const [erreur, setErreur] = useState(null)
  const [message, setMessage] = useState(location.state?.message || null)
  const nouvelleId = location.state?.sessionId
  const [panneau, setPanneau] = useState(false)

  useEffect(() => {
    listerSessions().then(setSessions).catch((e) => setErreur(e.message))
  }, [])

  return (
    <div className="wrap">
      {message && (
        <div className="sp-bandeau" role="status">
          <Icone nom="check" taille={18} epaisseur={2.4} /><span>{message}</span>
          <button type="button" className="sp-fermer" aria-label="Fermer le message" onClick={() => setMessage(null)}><Icone nom="x" taille={18} /></button>
        </div>
      )}
      <div className="page-head">
        <div><h1>Sessions et planning</h1><p className="sub">Retrouvez ici toutes vos sessions de formation et leur planning.</p></div>
        <div className="sp-actions">
          <MenuPartiesPrenantes onNouvelApprenant={() => setPanneau(true)} />
          <button type="button" className="btn btn-primary" onClick={() => navigate('/sessions/nouvelle')}><Icone nom="plus" taille={18} epaisseur={2.4} />Nouvelle session</button>
        </div>
      </div>
      {panneau && (
        <PanneauApprenant onFermer={() => setPanneau(false)}
          onCree={(a) => { setPanneau(false); setMessage(`L’apprenant « ${a.prenom} ${a.nom} » a été créé. Vous pouvez maintenant l’ajouter à une session.`) }} />
      )}

      {sessions === null && <p className="chargement" role={erreur ? 'alert' : undefined}>{erreur || 'Chargement des sessions…'}</p>}
      {sessions?.length === 0 && <div className="card empty"><p className="sub">Aucune session programmée pour le moment.</p></div>}
      {sessions?.length > 0 && (
        <ul className="sp-liste" aria-label="Sessions">
          {sessions.map((s) => (
            <li key={s.id} className={`sp-ligne${s.id === nouvelleId ? ' nouvelle' : ''}`}>
              <span className="sp-date"><small>{moisCourt(s.date_debut)}</small><b>{jour(s.date_debut)}</b></span>
              <span className="sp-titre"><b>{s.formation_intitule}</b><span>{periode(s)}</span></span>
              <span className="sp-col">{MODALITES[s.modalite]}</span>
              <span className="sp-col">{s.nombre_places ? `${s.nombre_apprenants} / ${s.nombre_places}` : s.nombre_apprenants} apprenants</span>
              <span className="sp-statut">{STATUTS[s.statut] || s.statut}</span>
              <span className="sp-chev" aria-hidden="true"><Icone nom="chev" taille={18} /></span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default SessionsPlanning
