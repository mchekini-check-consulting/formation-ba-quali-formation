import { useEffect, useState } from 'react'
import ErreurChargement from '../components/ErreurChargement'
import Icone from '../components/Icone'
import { PanneauPartiePrenante } from '../sessions/PartiesPrenantes'
import { initiales, listerApprenants, listerFormateurs } from '../sessions/serviceApi'
import { messageCreation, PARTIES_PRENANTES } from '../sessions/typesPersonnes'
import '../sessions/sessions.css'

const GROUPES = [
  { type: 'formateur', titre: 'Formateurs', vide: 'Aucun formateur pour l’instant.' },
  { type: 'apprenant', titre: 'Apprenants', vide: 'Aucun apprenant pour l’instant.' },
]

// Page « Parties prenantes » (SCRUM-209) : formateurs et apprenants (GET /formateurs/, GET /apprenants/ : pour l’instant communs à tous les comptes),
// avec la création d'un formateur (SCRUM-26) ou d'un apprenant (SCRUM-27) dans le panneau de « Sessions et planning ».
function ListePartiesPrenantes() {
  const [personnes, setPersonnes] = useState(null) // { formateur: [...], apprenant: [...] }
  const [erreur, setErreur] = useState(null)
  const [panneau, setPanneau] = useState(null) // 'formateur', 'apprenant' ou null
  const [message, setMessage] = useState(null)

  const charger = () => Promise.all([listerFormateurs(), listerApprenants()])
    .then(([formateur, apprenant]) => setPersonnes({ formateur, apprenant }))
    .catch(setErreur)

  useEffect(() => { void charger() }, [])

  const cree = (p) => {
    setMessage(messageCreation(panneau, p))
    setPanneau(null)
    void charger()
  }

  return (
    <div className="wrap">
      {message && (
        <div className="sp-bandeau" role="status">
          <Icone nom="check" taille={18} epaisseur={2.4} /><span>{message}</span>
          <button type="button" className="sp-fermer" aria-label="Fermer le message" onClick={() => setMessage(null)}><Icone nom="x" taille={18} /></button>
        </div>
      )}
      <div className="page-head">
        <div><h1>Parties prenantes</h1><p className="sub">Retrouvez ici les formateurs et les apprenants de vos sessions.</p></div>
        <div className="sp-actions">
          {GROUPES.map(({ type }) => (
            <button type="button" className={`btn ${type === 'apprenant' ? 'btn-primary' : 'btn-outline'}`} key={type} onClick={() => setPanneau(type)}>
              <Icone nom="plus" taille={18} epaisseur={2.4} />{PARTIES_PRENANTES[type].titre}
            </button>
          ))}
        </div>
      </div>
      {panneau && <PanneauPartiePrenante type={panneau} key={panneau} onFermer={() => setPanneau(null)} onCree={cree} />}

      {personnes === null && (erreur ? <ErreurChargement erreur={erreur} /> : <p className="chargement">Chargement des parties prenantes…</p>)}
      {personnes && GROUPES.map(({ type, titre, vide }) => (
        <section className="lpp-groupe" key={type} aria-labelledby={`lpp-${type}`}>
          <h2 id={`lpp-${type}`}>{titre} <span className="lpp-nombre">{personnes[type].length}</span></h2>
          {personnes[type].length === 0
            ? <p className="lpp-vide">{vide}</p>
            : (
              <ul className="sp-liste" aria-label={titre}>
                {personnes[type].map((p) => (
                  <li key={p.id} className="lpp-ligne">
                    <span className={`ns-avatar ns-av${p.id % 5}`} aria-hidden="true">{initiales(p)}</span>
                    <b>{p.prenom} {p.nom}</b>
                    <span className="lpp-col">{p.entreprise || '—'}</span>
                    <span className="lpp-col">{p.email}</span>
                  </li>
                ))}
              </ul>
            )}
        </section>
      ))}
    </div>
  )
}

export default ListePartiesPrenantes
