import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ErreurChargement from '../components/ErreurChargement'
import Icone from '../components/Icone'
import { BlocInformations, ListePersonnes } from '../sessions/FormulaireSession'
import { basculerDans, compteur, useSaisieSession } from '../sessions/saisieSession'
import { creerSession, dateFr, heureFr, listerApprenants, listerFormateurs, listerFormations } from '../sessions/serviceApi'
import { erreurServeur, MSG_APPRENANT, MSG_FORMATEUR, PRESENTIEL, verifierInformations } from '../sessions/regles'
import '../sessions/sessions.css'

// Formulaire « Nouvelle session » (SCRUM-25), en 3 étapes : informations, formateur(s), apprenant(s).
const ETAPES = ['Informations', 'Formateur(s)', 'Apprenant(s)']
const VIDE = { formation: '', debut: '', fin: '', heureDebut: '09:00', heureFin: '17:00', duree: '', places: '10', modalite: PRESENTIEL, lieu: '', lien: '' }

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

function NouvelleSession() {
  const navigate = useNavigate()
  const [listes, setListes] = useState(null) // { formations, formateurs, apprenants }
  const [erreurChargement, setErreurChargement] = useState(null)
  const [etape, setEtape] = useState(1)
  const { s, erreurs, setErreurs, changer, saisie } = useSaisieSession(VIDE, listes?.formations || [])
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
  const basculer = (liste, setListe) => (id) => { setErreurEtape(null); setListe(basculerDans(liste, id)) }
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
        {etape === 1 && <BlocInformations s={s} erreurs={erreurs} saisie={saisie} formations={listes.formations} changer={changer} />}

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
