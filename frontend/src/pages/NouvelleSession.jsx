import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ErreurChargement from '../components/ErreurChargement'
import Icone from '../components/Icone'
import {
  creerSession, dateFr, heureFr, initiales, listerApprenants, listerFormateurs, listerFormations,
} from '../sessions/serviceApi'
import { CLASSE_VIRTUELLE, erreurServeur, MSG_APPRENANT, MSG_FORMATEUR, PRESENTIEL, verifierInformations } from '../sessions/regles'
import '../sessions/sessions.css'

// Formulaire « Nouvelle session » (SCRUM-25), en 3 étapes : informations, formateur(s), apprenant(s).
// Tous les champs s'affichent vides à l'ouverture : aucune valeur proposée, ni par l'écran ni par le navigateur.
const ETAPES = ['Informations', 'Formateur(s)', 'Apprenant(s)']
const VIDE = { formation: '', debut: '', fin: '', heureDebut: '', heureFin: '', duree: '', places: '', modalite: '', lieu: '', lien: '' }
function Champ({ id, label, erreur, children }) {
  return (
    <div className="field">
      <label className="lbl" htmlFor={id}>{label} <span className="req" aria-hidden="true">*</span></label>
      {children}
      {erreur && <span className="errtxt" id={`${id}-err`}>{erreur}</span>}
    </div>
  )
}

// Liste à cocher des formateurs ou des apprenants
function ListePersonnes({ titre, personnes, choisis, onBasculer, detail }) {
  return (
    <ul className="ns-personnes" aria-label={titre}>
      {personnes.map((p) => (
        <li key={p.id} className={choisis.includes(p.id) ? 'on' : ''}>
          <label>
            <input type="checkbox" checked={choisis.includes(p.id)} onChange={() => onBasculer(p.id)} />
            <span className="ns-avatar" aria-hidden="true">{initiales(p)}</span>
            <span className="ns-nom"><b>{p.prenom} {p.nom}</b><span>{detail(p)}</span></span>
          </label>
        </li>
      ))}
      {personnes.length === 0 && <li className="ns-vide">Aucune personne enregistrée pour le moment.</li>}
    </ul>
  )
}

// Bandeau des 3 étapes : étape en cours, étapes faites (coche)
function Etapes({ etape }) {
  return (
    <ol className="ns-etapes" aria-label="Étapes">
      {ETAPES.map((nom, i) => {
        const n = i + 1
        const faite = n < etape
        let etat = faite ? 'faite' : ''
        if (n === etape) etat = 'active'
        return (
          <li key={nom} className={etat} aria-current={n === etape ? 'step' : undefined}>
            <span className="ns-num">{faite ? <Icone nom="check" taille={14} epaisseur={2.6} /> : n}</span>
            <span><small>Étape {n}</small><b>{nom}</b></span>
          </li>
        )
      })}
    </ol>
  )
}

// Étape 1 : informations de la session
function EtapeInformations({ s, erreurs, saisie, formations, changer }) {
  const radio = (valeur) => ({
    type: 'radio', name: 'modalite', checked: s.modalite === valeur, onChange: () => changer('modalite', valeur),
    'aria-invalid': erreurs.modalite ? true : undefined, 'aria-describedby': erreurs.modalite ? 'ns-modalite-err' : undefined,
  })
  return (
    <>
      <h2>Informations de la session</h2>
      <p className="sub">Les champs marqués <span className="req">*</span> sont obligatoires.</p>
      <div className="ns-grille">
        <div className="ns-plein">
          <Champ id="ns-formation" label="Formation" erreur={erreurs.formation}>
            <select {...saisie('formation')}>
              <option value="">Choisir une formation</option>
              {formations.map((f) => <option key={f.id} value={f.id}>{f.intitule}</option>)}
            </select>
          </Champ>
        </div>
        <Champ id="ns-debut" label="Date de début" erreur={erreurs.debut}><input type="date" {...saisie('debut')} /></Champ>
        <Champ id="ns-fin" label="Date de fin" erreur={erreurs.fin}><input type="date" {...saisie('fin')} /></Champ>
        <Champ id="ns-heureDebut" label="Heure de début" erreur={erreurs.heureDebut}><input type="time" {...saisie('heureDebut')} /></Champ>
        <Champ id="ns-heureFin" label="Heure de fin" erreur={erreurs.heureFin}><input type="time" {...saisie('heureFin')} /></Champ>
        <Champ id="ns-duree" label="Durée (heures)" erreur={erreurs.duree}><input inputMode="decimal" {...saisie('duree')} /></Champ>
        <Champ id="ns-places" label="Nombre de places" erreur={erreurs.places}><input inputMode="numeric" {...saisie('places')} /></Champ>
      </div>
      <fieldset className="ns-modalite">
        <legend className="lbl">Modalité <span className="req" aria-hidden="true">*</span></legend>
        <div className="radios">
          <label className="radio"><input {...radio(PRESENTIEL)} />Présentiel</label>
          <label className="radio"><input {...radio(CLASSE_VIRTUELLE)} />Classe virtuelle</label>
        </div>
        {erreurs.modalite && <span className="errtxt" id="ns-modalite-err">{erreurs.modalite}</span>}
      </fieldset>
      {/* Le lieu ou le lien n'apparaît qu'une fois la modalité choisie */}
      {s.modalite === PRESENTIEL && <Champ id="ns-lieu" label="Lieu" erreur={erreurs.lieu}><input placeholder="Adresse ou salle" {...saisie('lieu')} /></Champ>}
      {s.modalite === CLASSE_VIRTUELLE && <Champ id="ns-lien" label="Lien de la classe virtuelle" erreur={erreurs.lien}><input type="url" placeholder="https://…" {...saisie('lien')} /></Champ>}
    </>
  )
}

// Libellé « N apprenant(s) sélectionné(s) »
const compteur = (n) => (n > 1 ? `${n} apprenants sélectionnés` : `${n} apprenant sélectionné`)

function NouvelleSession() {
  const navigate = useNavigate()
  const [listes, setListes] = useState(null) // { formations, formateurs, apprenants }
  const [erreurChargement, setErreurChargement] = useState(null)
  const [etape, setEtape] = useState(1)
  const [s, setS] = useState(VIDE)
  const [erreurs, setErreurs] = useState({})
  const [formateurs, setFormateurs] = useState([])
  const [apprenants, setApprenants] = useState([])
  const [erreurEtape, setErreurEtape] = useState(null)
  const [envoi, setEnvoi] = useState(false)

  useEffect(() => {
    Promise.all([listerFormations(), listerFormateurs(), listerApprenants()])
      .then(([f, fo, a]) => setListes({ formations: f, formateurs: fo, apprenants: a }))
      .catch(setErreurChargement)
  }, [])

  const annuler = () => navigate('/sessions')
  const changer = (k, v) => {
    setS({ ...s, [k]: v })
    if (erreurs[k]) setErreurs({ ...erreurs, [k]: undefined })
  }
  const saisie = (k) => ({
    id: `ns-${k}`, value: s[k], autoComplete: 'off', onChange: (e) => changer(k, e.target.value),
    className: `inp${erreurs[k] ? ' err' : ''}`, 'aria-invalid': erreurs[k] ? true : undefined,
    'aria-describedby': erreurs[k] ? `ns-${k}-err` : undefined,
  })
  const basculer = (liste, setListe) => (id) => { setErreurEtape(null); setListe(liste.includes(id) ? liste.filter((x) => x !== id) : [...liste, id]) }
  const allerA = (n) => { setErreurEtape(null); setEtape(n) }

  const suivant = () => {
    if (etape === 1) {
      const e = verifierInformations(s)
      setErreurs(e)
      if (Object.keys(e).length === 0) allerA(2)
    } else if (formateurs.length === 0) {
      setErreurEtape(MSG_FORMATEUR)
    } else {
      allerA(3)
    }
  }

  const creer = async () => {
    if (apprenants.length === 0) { setErreurEtape(MSG_APPRENANT); return }
    setEnvoi(true)
    try {
      const session = await creerSession(s, formateurs, apprenants)
      const message = `La session « ${session.formation_intitule} » du ${dateFr(session.date_debut)} a été créée avec le statut « Prévue ».`
      void navigate('/sessions', { state: { message, sessionId: session.id } })
    } catch (e) {
      // Refus du serveur : retour à l'étape concernée (champs de l'étape 1 signalés)
      const refus = erreurServeur(e)
      setEnvoi(false)
      setEtape(refus.etape)
      setErreurEtape(refus.message || null)
      if (refus.champs) setErreurs(refus.champs)
    }
  }

  const entete = (
    <>
      <Link to="/sessions" className="ns-retour"><Icone nom="back" taille={16} />Sessions et planning</Link>
      <div className="page-head"><h1>Nouvelle session</h1></div>
    </>
  )
  if (!listes) {
    return <div className="wrap">{entete}{erreurChargement ? <ErreurChargement erreur={erreurChargement} /> : <p className="chargement">Chargement…</p>}</div>
  }

  const resume = `Du ${dateFr(s.debut)} au ${dateFr(s.fin)} · ${heureFr(s.heureDebut)} – ${heureFr(s.heureFin)}`

  return (
    <div className="wrap">
      {entete}
      <Etapes etape={etape} />

      <section className="card ns-carte">
        {etape === 1 && <EtapeInformations s={s} erreurs={erreurs} saisie={saisie} formations={listes.formations} changer={changer} />}

        {etape === 2 && (
          <>
            <h2>Formateur(s) <span className="req">*</span></h2>
            <p className="sub ns-large">{resume} — au moins un formateur est nécessaire.</p>
            <ListePersonnes titre="Formateurs" personnes={listes.formateurs} choisis={formateurs} onBasculer={basculer(formateurs, setFormateurs)} detail={(p) => p.specialites} />
          </>
        )}

        {etape === 3 && (
          <>
            <div className="ns-titre3">
              <div><h2>Apprenant(s) <span className="req">*</span></h2><p className="sub">Au moins un apprenant est nécessaire pour créer la session.</p></div>
              <span className="ns-compteur">{compteur(apprenants.length)}</span>
            </div>
            <ListePersonnes titre="Apprenants" personnes={listes.apprenants} choisis={apprenants} onBasculer={basculer(apprenants, setApprenants)} detail={(p) => p.email} />
          </>
        )}

        {erreurEtape && <p className="errtxt ns-erreur" role="alert">{erreurEtape}</p>}

        <div className="ns-pied">
          <button type="button" className="btn btn-line" onClick={annuler}>Annuler</button>
          <span className="ns-pied-droite">
            {etape > 1 && <button type="button" className="btn btn-line" onClick={() => allerA(etape - 1)}>Précédent</button>}
            {etape < 3
              ? <button type="button" className="btn btn-primary" onClick={suivant}>Suivant</button>
              : <button type="button" className="btn btn-primary" onClick={creer} disabled={envoi}>Créer la session</button>}
          </span>
        </div>
      </section>
    </div>
  )
}

export default NouvelleSession
