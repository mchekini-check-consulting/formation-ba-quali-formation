import { useEffect, useRef, useState } from 'react'
import {
  classeBulle, libelleStatut, telephoneFr, texteSessions, VIDE,
} from '../apprenants/apprenants'
import ErreurChargement from '../components/ErreurChargement'
import Icone from '../components/Icone'
import { PanneauPartiePrenante } from '../sessions/PartiesPrenantes'
import { initiales, listerApprenants, listerFormateurs } from '../sessions/serviceApi'
import { messageCreation, PARTIES_PRENANTES } from '../sessions/typesPersonnes'
import '../apprenants/apprenants.css'
import '../sessions/sessions.css'

const ONGLETS = [
  { cle: 'apprenants', titre: 'Apprenants' }, // SCRUM-112
  { cle: 'formateurs', titre: 'Formateurs' }, // SCRUM-119 (en attendant : liste de SCRUM-209)
  { cle: 'entreprises', titre: 'Entreprises clientes' }, // SCRUM-120
]
const DELAI_RECHERCHE = 250 // ms : la liste se met à jour quand on arrête de taper

// Page « Parties prenantes » (SCRUM-209, onglets et apprenants : SCRUM-112) : seulement les personnes du centre.
function ListePartiesPrenantes() {
  const [onglet, setOnglet] = useState('apprenants')
  const [total, setTotal] = useState(null) // nombre d'apprenants du centre (onglet), sans la recherche
  return (
    <div className="wrap app-page">
      <div className="page-head">
        <div><h1>Parties prenantes</h1><p className="sub">Les apprenants, formateurs et entreprises clientes de votre organisme.</p></div>
      </div>
      <div className="app-onglets" role="tablist" aria-label="Parties prenantes">
        {ONGLETS.map(({ cle, titre }) => (
          <button type="button" role="tab" key={cle} id={`onglet-${cle}`} aria-selected={onglet === cle} aria-controls={`panneau-${cle}`}
                  className={`app-onglet${onglet === cle ? ' actif' : ''}`} onClick={() => setOnglet(cle)}>
            {titre}
            {cle === 'apprenants' && total !== null && <span className="app-onglet-nombre">{total}</span>}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panneau-${onglet}`} aria-labelledby={`onglet-${onglet}`}>
        {onglet === 'apprenants' && <Apprenants onTotal={setTotal} />}
        {onglet === 'formateurs' && <Formateurs />}
        {onglet === 'entreprises' && (
          <section className="app-carte app-bientot">
            <h2>Bientôt disponible</h2>
            <p>Les entreprises clientes de votre centre s’afficheront ici dans une prochaine version.</p>
          </section>
        )}
      </div>
    </div>
  )
}

// Onglet Apprenants : carte « Apprenants · N », « + Nouvel apprenant », recherche et une ligne par apprenant
function Apprenants({ onTotal }) {
  const [apprenants, setApprenants] = useState(null)
  const [erreur, setErreur] = useState(null)
  const [recherche, setRecherche] = useState('')
  const [panneau, setPanneau] = useState(false)
  const [nouveau, setNouveau] = useState(null) // identifiant de l'apprenant qui vient d'être ajouté
  const derniere = useRef(0) // ignore les réponses d'une recherche déjà remplacée

  const charger = (texte) => {
    const numero = ++derniere.current
    return listerApprenants(texte)
      .then((liste) => {
        if (numero !== derniere.current) return
        setApprenants(liste)
        setErreur(null)
        if (!texte.trim()) onTotal(liste.length)
      })
      .catch((e) => { if (numero === derniere.current) setErreur(e) })
  }

  useEffect(() => {
    const minuteur = setTimeout(() => { void charger(recherche) }, recherche ? DELAI_RECHERCHE : 0)
    return () => clearTimeout(minuteur)
  }, [recherche]) // eslint-disable-line react-hooks/exhaustive-deps

  // L'apprenant ajouté apparaît en tête de liste, mis en évidence (la recherche est vidée pour le montrer)
  const cree = (a) => {
    setPanneau(false)
    setNouveau(a.id)
    if (recherche) setRecherche('')
    else void charger('')
  }
  const lignes = apprenants && nouveau !== null
    ? [...apprenants.filter((a) => a.id === nouveau), ...apprenants.filter((a) => a.id !== nouveau)]
    : apprenants

  return (
    <section className="app-carte" aria-labelledby="app-liste-titre">
      <div className="app-carte-tete">
        <h2 id="app-liste-titre">Apprenants{apprenants && <span className="app-nombre"> · {apprenants.length}</span>}</h2>
        <button type="button" className="app-btn app-btn-principal" onClick={() => setPanneau(true)}>+ Nouvel apprenant</button>
      </div>
      <input type="search" className="app-inp app-recherche" aria-label="Rechercher un apprenant"
             placeholder="Rechercher par nom, e-mail ou entreprise" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
      {panneau && <PanneauPartiePrenante type="apprenant" onFermer={() => setPanneau(false)} onCree={cree} />}

      {apprenants === null && (erreur ? <ErreurChargement erreur={erreur} /> : <p className="chargement">Chargement des apprenants…</p>)}
      {apprenants?.length === 0 && (recherche.trim()
        ? <p className="app-vide-texte">Aucun apprenant ne correspond à votre recherche.</p>
        : (
          <div className="app-vide">
            <h3>Aucun apprenant pour le moment</h3>
            <p>Ajoutez votre premier apprenant avec « + Nouvel apprenant ».</p>
          </div>
        ))}
      {lignes?.length > 0 && (
        <ul className="app-liste" aria-label="Apprenants">
          {lignes.map((a) => (
            <li key={a.id} className={`app-ligne${a.id === nouveau ? ' app-ligne-nouvelle' : ''}`}
                aria-current={a.id === nouveau ? 'true' : undefined}>
              <span className={classeBulle(a.id)} aria-hidden="true">{initiales(a)}</span>
              <span className="app-col-nom"><b>{a.prenom} {a.nom}</b><small>{a.email}</small></span>
              <span className="app-col">{telephoneFr(a.telephone) || VIDE}</span>
              <span className="app-col">{a.statut ? <span className="app-pastille app-pastille-verte">{libelleStatut(a.statut)}</span> : VIDE}</span>
              <span className="app-col-nom">
                <b>{a.entreprise || VIDE}</b>
                {(a.entreprise || a.poste) && <small>{a.poste || VIDE}</small>}
              </span>
              <span className="app-col app-sessions">{texteSessions(a.nombre_sessions)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// Onglet Formateurs : liste et création d'un formateur telles qu'avant SCRUM-112 (refonte : SCRUM-119)
function Formateurs() {
  const [formateurs, setFormateurs] = useState(null)
  const [erreur, setErreur] = useState(null)
  const [panneau, setPanneau] = useState(false)
  const [message, setMessage] = useState(null)

  const charger = () => listerFormateurs().then(setFormateurs).catch(setErreur)
  useEffect(() => { void charger() }, [])

  const cree = (p) => {
    setMessage(messageCreation('formateur', p))
    setPanneau(false)
    void charger()
  }

  return (
    <>
      {message && (
        <div className="sp-bandeau" role="status">
          <Icone nom="check" taille={18} epaisseur={2.4} /><span>{message}</span>
          <button type="button" className="sp-fermer" aria-label="Fermer le message" onClick={() => setMessage(null)}><Icone nom="x" taille={18} /></button>
        </div>
      )}
      <section className="lpp-groupe" aria-labelledby="lpp-formateur">
        <div className="app-carte-tete">
          <h2 id="lpp-formateur">Formateurs {formateurs && <span className="lpp-nombre">{formateurs.length}</span>}</h2>
          <button type="button" className="btn btn-outline" onClick={() => setPanneau(true)}>
            <Icone nom="plus" taille={18} epaisseur={2.4} />{PARTIES_PRENANTES.formateur.titre}
          </button>
        </div>
        {panneau && <PanneauPartiePrenante type="formateur" onFermer={() => setPanneau(false)} onCree={cree} />}
        {formateurs === null && (erreur ? <ErreurChargement erreur={erreur} /> : <p className="chargement">Chargement des formateurs…</p>)}
        {formateurs?.length === 0 && <p className="lpp-vide">Aucun formateur pour l’instant.</p>}
        {formateurs?.length > 0 && (
          <ul className="sp-liste" aria-label="Formateurs">
            {formateurs.map((p) => (
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
    </>
  )
}

export default ListePartiesPrenantes
