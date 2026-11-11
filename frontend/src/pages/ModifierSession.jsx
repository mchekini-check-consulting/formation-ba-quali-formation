import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ErreurChargement from '../components/ErreurChargement'
import Icone from '../components/Icone'
import { BlocInformations, ListePersonnes } from '../sessions/FormulaireSession'
import { basculerDans, compteur, useSaisieSession } from '../sessions/saisieSession'
import { erreurServeur, MSG_APPRENANT, MSG_FORMATEUR, verifierInformations } from '../sessions/regles'
import {
  dateFr, heureFr, listerApprenants, listerFormateurs, listerFormations, lireSession, modifierSession, versFormulaire,
} from '../sessions/serviceApi'
import '../sessions/sessions.css'

// « Modifier la session » (SCRUM-36) : une seule page, pré-remplie avec les données actuelles de la session.
// Mêmes règles qu'à la création (SCRUM-25) ; le statut ne change pas. « Annuler » revient à la fiche sans rien enregistrer.
export const MSG_CORRIGER = 'Corrigez les champs indiqués pour enregistrer les modifications.'

function Formulaire({ session, listes }) {
  const navigate = useNavigate()
  const fiche = `/sessions/${session.id}`
  const { s, erreurs, setErreurs, changer, saisie } = useSaisieSession(versFormulaire(session), listes.formations)
  const [formateurs, setFormateurs] = useState(session.formateurs.map((p) => p.id))
  const [apprenants, setApprenants] = useState(session.apprenants.map((p) => p.id))
  const [erreurFormateurs, setErreurFormateurs] = useState(null)
  const [erreurApprenants, setErreurApprenants] = useState(null)
  const [erreurGenerale, setErreurGenerale] = useState(null)
  const [envoi, setEnvoi] = useState(false)

  const basculerFormateur = (id) => { setErreurFormateurs(null); setFormateurs(basculerDans(formateurs, id)) }
  const basculerApprenant = (id) => { setErreurApprenants(null); setApprenants(basculerDans(apprenants, id)) }

  const enregistrer = async () => {
    // Toutes les erreurs de la page sont signalées en même temps
    const e = verifierInformations(s)
    setErreurs(e)
    setErreurFormateurs(formateurs.length ? null : MSG_FORMATEUR)
    setErreurApprenants(apprenants.length ? null : MSG_APPRENANT)
    setErreurGenerale(null)
    if (Object.keys(e).length || !formateurs.length || !apprenants.length) return
    setEnvoi(true)
    try {
      const modifiee = await modifierSession(session.id, s, formateurs, apprenants)
      const message = `Les modifications de la session « ${modifiee.formation_intitule} » ont été enregistrées.`
      void navigate(fiche, { state: { message } })
    } catch (err) {
      // Refus du serveur : le champ ou la liste concernés sont signalés
      setEnvoi(false)
      if (err.code === 'FORMATEUR_REQUIS') setErreurFormateurs(err.message)
      else if (err.code === 'APPRENANT_REQUIS') setErreurApprenants(err.message)
      else {
        const refus = erreurServeur(err)
        if (refus.champs) setErreurs(refus.champs)
        else setErreurGenerale(refus.message)
      }
    }
  }

  const aCorriger = Object.values(erreurs).some(Boolean)
  const resume = `Du ${dateFr(s.debut)} au ${dateFr(s.fin)} · ${heureFr(s.heureDebut)} – ${heureFr(s.heureFin)}`

  return (
    <section className="card ns-carte">
      <BlocInformations s={s} erreurs={erreurs} saisie={saisie} formations={listes.formations} changer={changer}
        alerte={aCorriger ? MSG_CORRIGER : null} />

      <div className="ms-section">
        <h2>Formateur(s) <span className="req">*</span></h2>
        <p className="sub ns-large">{resume} — au moins un formateur est nécessaire.</p>
        {erreurFormateurs && <p className="pa-alerte" role="alert">{erreurFormateurs}</p>}
        <ListePersonnes titre="Formateurs" personnes={listes.formateurs} choisis={formateurs} onBasculer={basculerFormateur}
          detail={(p) => p.specialites} enErreur={Boolean(erreurFormateurs)} />
      </div>

      <div className="ms-section">
        <div className="ns-titre3">
          <div><h2>Apprenant(s) <span className="req">*</span></h2><p className="sub">Au moins un apprenant est nécessaire.</p></div>
          <span className="ns-compteur">{compteur(apprenants.length)}</span>
        </div>
        {erreurApprenants && <p className="pa-alerte" role="alert">{erreurApprenants}</p>}
        <ListePersonnes titre="Apprenants" personnes={listes.apprenants} choisis={apprenants} onBasculer={basculerApprenant}
          detail={(p) => p.email} enErreur={Boolean(erreurApprenants)} />
      </div>

      {erreurGenerale && <p className="errtxt ns-erreur" role="alert">{erreurGenerale}</p>}

      <div className="ns-pied">
        <button type="button" className="btn btn-line" onClick={() => navigate(fiche)}>Annuler</button>
        <button type="button" className="btn btn-primary" onClick={enregistrer} disabled={envoi}>Enregistrer les modifications</button>
      </div>
    </section>
  )
}

function ModifierSession() {
  const { id } = useParams()
  const [donnees, setDonnees] = useState(null) // { session, listes: { formations, formateurs, apprenants } }
  const [erreur, setErreur] = useState(null)

  useEffect(() => {
    Promise.all([lireSession(id), listerFormations(), listerFormateurs(), listerApprenants()])
      .then(([session, formations, formateurs, apprenants]) => setDonnees({ session, listes: { formations, formateurs, apprenants } }))
      .catch(setErreur)
  }, [id])

  let contenu = <p className="chargement">Chargement de la session…</p>
  if (erreur) contenu = <ErreurChargement erreur={erreur} />
  else if (donnees) contenu = <Formulaire session={donnees.session} listes={donnees.listes} />

  return (
    <div className="wrap">
      <Link to={`/sessions/${id}`} className="ns-retour"><Icone nom="back" taille={16} />Retour à la session</Link>
      <div className="page-head">
        <div>
          <h1>Modifier la session</h1>
          <p className="sub">Modifiez les champs souhaités puis cliquez sur « Enregistrer les modifications ». Le statut de la session ne change pas.</p>
        </div>
      </div>
      {contenu}
    </div>
  )
}

export default ModifierSession
