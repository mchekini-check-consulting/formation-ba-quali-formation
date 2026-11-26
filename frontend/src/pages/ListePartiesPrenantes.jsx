import { useEffect, useRef, useState } from 'react'
import {
  classeBulle, libelleStatut, telephoneFr, texteSessions, VIDE,
} from '../apprenants/apprenants'
import ErreurChargement from '../components/ErreurChargement'
import { messageFichiersNonEnregistres } from '../formateurs/formateurs'
import '../formateurs/formateurs.css'
import Icone from '../components/Icone'
import { PanneauPartiePrenante } from '../sessions/PartiesPrenantes'
import { initiales, listerApprenants, listerFormateurs } from '../sessions/serviceApi'
import '../apprenants/apprenants.css'
import '../sessions/sessions.css'

const ONGLETS = [
  { cle: 'apprenants', titre: 'Apprenants' }, // SCRUM-112
  { cle: 'formateurs', titre: 'Formateurs' }, // SCRUM-119
  { cle: 'entreprises', titre: 'Entreprises clientes' }, // SCRUM-120
]
const DELAI_RECHERCHE = 250 // ms : la liste se met à jour quand on arrête de taper

// Page « Parties prenantes » (SCRUM-209, onglets et apprenants : SCRUM-112, formateurs : SCRUM-119) : seulement les personnes du centre.
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

// Onglet Formateurs (SCRUM-119) : carte « Formateurs · N » (N : tous les formateurs du centre), « + Nouveau formateur »,
// recherche par nom ou e-mail et une ligne par formateur (bulle, prénom et nom, e-mail, nombre de sessions)
function Formateurs() {
  const [formateurs, setFormateurs] = useState(null)
  const [total, setTotal] = useState(null)
  const [erreur, setErreur] = useState(null)
  const [recherche, setRecherche] = useState('')
  const [panneau, setPanneau] = useState(false)
  const [nouveau, setNouveau] = useState(null) // identifiant du formateur qui vient d'être ajouté
  const [alerte, setAlerte] = useState(null) // fichiers non enregistrés après la création
  const derniere = useRef(0) // ignore les réponses d'une recherche déjà remplacée

  const charger = (texte) => {
    const numero = ++derniere.current
    return listerFormateurs(texte)
      .then((liste) => {
        if (numero !== derniere.current) return
        setFormateurs(liste)
        setErreur(null)
        if (!texte.trim()) setTotal(liste.length)
      })
      .catch((e) => { if (numero === derniere.current) setErreur(e) })
  }

  useEffect(() => {
    const minuteur = setTimeout(() => { void charger(recherche) }, recherche ? DELAI_RECHERCHE : 0)
    return () => clearTimeout(minuteur)
  }, [recherche]) // eslint-disable-line react-hooks/exhaustive-deps

  // Le formateur ajouté apparaît en tête de liste, mis en évidence (la recherche est vidée pour le montrer)
  const cree = (f, nonEnregistres = []) => {
    setPanneau(false)
    setNouveau(f.id)
    setAlerte(nonEnregistres.length ? messageFichiersNonEnregistres(f, nonEnregistres) : null)
    if (recherche) setRecherche('')
    else void charger('')
  }
  const lignes = formateurs && nouveau !== null
    ? [...formateurs.filter((f) => f.id === nouveau), ...formateurs.filter((f) => f.id !== nouveau)]
    : formateurs

  return (
    <>
      {alerte && (
        <div className="app-bandeau-alerte" role="alert">
          <span>{alerte}</span>
          <button type="button" aria-label="Fermer le message" onClick={() => setAlerte(null)}><Icone nom="x" taille={16} /></button>
        </div>
      )}
      <section className="app-carte" aria-labelledby="frm-liste-titre">
        <div className="app-carte-tete">
          <h2 id="frm-liste-titre">Formateurs{total !== null && <span className="app-nombre"> · {total}</span>}</h2>
          <button type="button" className="app-btn app-btn-principal" onClick={() => setPanneau(true)}>+ Nouveau formateur</button>
        </div>
        <input type="search" className="app-inp app-recherche" aria-label="Rechercher un formateur"
               placeholder="Rechercher par nom ou e-mail" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        {panneau && <PanneauPartiePrenante type="formateur" onFermer={() => setPanneau(false)} onCree={cree} />}

        {formateurs === null && (erreur ? <ErreurChargement erreur={erreur} /> : <p className="chargement">Chargement des formateurs…</p>)}
        {formateurs?.length === 0 && (recherche.trim()
          ? <p className="app-vide-texte">Aucun formateur ne correspond à votre recherche.</p>
          : (
            <div className="app-vide">
              <h3>Aucun formateur pour le moment</h3>
              <p>Ajoutez votre premier formateur avec « + Nouveau formateur ».</p>
            </div>
          ))}
        {lignes?.length > 0 && (
          <ul className="app-liste" aria-label="Formateurs">
            {lignes.map((f) => (
              <li key={f.id} className={`app-ligne frm-ligne${f.id === nouveau ? ' app-ligne-nouvelle' : ''}`}
                  aria-current={f.id === nouveau ? 'true' : undefined}>
                <span className={classeBulle(f.id)} aria-hidden="true">{initiales(f)}</span>
                <span className="app-col-nom"><b>{f.prenom} {f.nom}</b><small>{f.email}</small></span>
                <span className="app-col app-sessions">{texteSessions(f.nombre_sessions)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

export default ListePartiesPrenantes
