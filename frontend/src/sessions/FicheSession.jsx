import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import ErreurChargement from '../components/ErreurChargement'
import { OngletApprenants } from './OngletApprenants'
import { datesEtLieu, ONGLETS_FICHE, resumeParticipants } from './regleFiche'
import { ficheSession } from './serviceApi'
import './sessions.css'

function Retour() {
  return <Link className="fs-retour" to="/sessions">‹ Sessions</Link>
}

function Fiche({ id }) {
  const [session, setSession] = useState(null)
  const [erreur, setErreur] = useState(null)
  const [onglet, setOnglet] = useState('apercu')

  useEffect(() => { ficheSession(id).then(setSession).catch(setErreur) }, [id])

  if (erreur?.code === 'SESSION_INTROUVABLE') {
    return (
      <div className="wrap fs-page">
        <Retour />
        <div className="card fs-vide fs-introuvable"><p>Session introuvable</p></div>
      </div>
    )
  }
  if (!session) {
    return (
      <div className="wrap fs-page">
        <Retour />
        {erreur ? <ErreurChargement erreur={erreur} /> : <p className="chargement">Chargement de la session…</p>}
      </div>
    )
  }
  return (
    <div className="wrap fs-page">
      <Retour />
      <header className="fs-tete">
        <h1>{session.formation_intitule}</h1>
        <p className="fs-ligne">{datesEtLieu(session)}</p>
        <p className="fs-ligne fs-infos">
          {resumeParticipants(session).map((texte, i) => <span key={i}>{texte}</span>)}
        </p>
      </header>
      <div className="fs-onglets" role="tablist" aria-label="Session">
        {ONGLETS_FICHE.map(({ cle, titre, nombre }) => (
          <button type="button" role="tab" key={cle} id={`fs-onglet-${cle}`} aria-selected={onglet === cle}
                  aria-controls="fs-panneau" className={`fs-onglet${onglet === cle ? ' actif' : ''}`} onClick={() => setOnglet(cle)}>
            {titre}{nombre && <span className="fs-nombre">{nombre(session)}</span>}
          </button>
        ))}
      </div>
      <div role="tabpanel" id="fs-panneau" aria-labelledby={`fs-onglet-${onglet}`}>
        {onglet === 'apprenants'
          // SCRUM-179 : après un ajout ou un retrait, l'en-tête et les nombres des onglets sont relus
          ? <OngletApprenants sessionId={id} titreSession={session.formation_intitule}
                              onModifie={() => ficheSession(id).then(setSession).catch(() => {})} />
          : <div className="card fs-vide"><p>Bientôt disponible</p></div>}
      </div>
    </div>
  )
}

// SCRUM-168 (maquettes SCRUM-168_01 à 04) : fiche d'une session, ouverte depuis la liste des sessions (SCRUM-167).
// En-tête et 9 onglets ; chaque onglet affiche « Bientôt disponible » (contenu : US suivantes). Changer d'onglet ne
// recharge pas la page. Remplace la page de la SCRUM-220 (SessionDetail, gardée pour le futur onglet Documents).
// `key` : une autre session repart de zéro (chargement, onglet « Aperçu »).
export function FicheSession() {
  const { id } = useParams()
  return <Fiche key={id} id={id} />
}
