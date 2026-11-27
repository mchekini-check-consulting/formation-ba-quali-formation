import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import ErreurChargement from '../components/ErreurChargement'
import { messageFichiersNonEnregistres } from '../formateurs/formateurs'
import '../formateurs/formateurs.css'
import Icone from '../components/Icone'
import { MenuPartiesPrenantes, PanneauPartiePrenante } from '../sessions/PartiesPrenantes'
import { messageCreation } from '../sessions/typesPersonnes'
import { listerSessions } from '../sessions/serviceApi'
import {
  aujourdhuiParis, avancement, datesCourtes, etat, formateurs, inscrits, lieu, nombresOnglets, ONGLETS, remplissage, sessionsOnglet,
} from '../sessions/listeSessions'
import '../sessions/sessions.css'

// Page Sessions et planning (SCRUM-25, liste par onglets : SCRUM-167) : sessions du centre par onglet (Toutes, En cours,
// À venir, Passées, avec leur nombre), « + Nouvelle session » et « Parties prenantes » (apprenant, formateur, entreprise
// cliente, dans un panneau latéral). Après une création, le formulaire revient ici avec le message de confirmation
// (state.message) et la session créée mise en évidence (state.sessionId).
function SessionsPlanning() {
  const navigate = useNavigate()
  const location = useLocation()
  const [sessions, setSessions] = useState(null)
  const [erreur, setErreur] = useState(null)
  const [message, setMessage] = useState(location.state?.message || null)
  const [alerte, setAlerte] = useState(null) // SCRUM-119 : fichiers du formateur créé qui n'ont pas pu être enregistrés
  const nouvelleId = location.state?.sessionId
  const [panneau, setPanneau] = useState(null) // 'apprenant', 'formateur', 'entreprise' ou null
  const [onglet, setOnglet] = useState('toutes')
  const aujourdhui = aujourdhuiParis()

  useEffect(() => {
    listerSessions().then(setSessions).catch(setErreur)
  }, [])

  const nombres = sessions ? nombresOnglets(sessions, aujourdhui) : null
  const lignes = sessions ? sessionsOnglet(sessions, onglet, aujourdhui) : []

  return (
    <div className="wrap">
      {message && (
        <div className="sp-bandeau" role="status">
          <Icone nom="check" taille={18} epaisseur={2.4} /><span>{message}</span>
          <button type="button" className="sp-fermer" aria-label="Fermer le message" onClick={() => setMessage(null)}><Icone nom="x" taille={18} /></button>
        </div>
      )}
      {alerte && (
        <div className="app-bandeau-alerte" role="alert">
          <span>{alerte}</span>
          <button type="button" aria-label="Fermer l’alerte" onClick={() => setAlerte(null)}><Icone nom="x" taille={16} /></button>
        </div>
      )}
      <div className="page-head">
        <h1>Sessions et planning</h1>
        <div className="sp-actions">
          <MenuPartiesPrenantes onChoisir={setPanneau} />
          <button type="button" className="btn btn-primary" onClick={() => navigate('/sessions/nouvelle')}><Icone nom="plus" taille={18} epaisseur={2.4} />Nouvelle session</button>
        </div>
      </div>
      {panneau && (
        <PanneauPartiePrenante type={panneau} key={panneau} onFermer={() => setPanneau(null)}
          onCree={(p, nonEnregistres = []) => {
            setMessage(messageCreation(panneau, p))
            setAlerte(nonEnregistres.length ? messageFichiersNonEnregistres(p, nonEnregistres) : null)
            setPanneau(null)
          }} />
      )}

      {sessions === null && (erreur ? <ErreurChargement erreur={erreur} /> : <p className="chargement">Chargement des sessions…</p>)}
      {sessions && (
        <>
          <div className="sp-onglets" role="tablist" aria-label="Sessions">
            {ONGLETS.map(({ cle, titre }) => (
              <button type="button" role="tab" key={cle} id={`onglet-${cle}`} aria-selected={onglet === cle} aria-controls="sessions-onglet"
                      className={`sp-onglet${onglet === cle ? ' actif' : ''}`} onClick={() => setOnglet(cle)}>
                {titre}<span className="sp-onglet-nombre">{nombres[cle]}</span>
              </button>
            ))}
          </div>
          <div className="sp-tableau" role="tabpanel" id="sessions-onglet" aria-labelledby={`onglet-${onglet}`}>
            {lignes.length === 0
              ? <p className="sp-aucune">Aucune session</p>
              : (
                <table>
                  <thead>
                    <tr><th scope="col">Dates</th><th scope="col">Formation</th><th scope="col">Lieu</th><th scope="col">Formateur</th><th scope="col">Inscrits</th></tr>
                  </thead>
                  <tbody>
                    {lignes.map((s) => (
                      <tr key={s.id} className={s.id === nouvelleId ? 'nouvelle' : undefined}>
                        <td className="sp-dates">{datesCourtes(s)}</td>
                        <td>
                          <Link className="sp-formation" to={`/sessions/${s.id}`}>{s.formation_intitule}</Link>
                          <span className={`sp-avancement${etat(s, aujourdhui) === 'EN_COURS' ? ' en-cours' : ''}`}>{avancement(s, aujourdhui)}</span>
                        </td>
                        <td>{lieu(s)}</td>
                        <td>{formateurs(s)}</td>
                        <td>
                          <span className="sp-inscrits">{inscrits(s)}</span>
                          {s.nombre_places > 0 && (
                            <span className="sp-barre" role="progressbar" aria-label={`Inscrits : ${inscrits(s)}`}
                                  aria-valuemin={0} aria-valuemax={100} aria-valuenow={remplissage(s)}>
                              <span style={{ width: `${remplissage(s)}%` }} />
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
          </div>
        </>
      )}
    </div>
  )
}

export default SessionsPlanning
