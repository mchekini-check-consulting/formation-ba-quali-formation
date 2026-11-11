import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Icone from '../components/Icone'
import ChampMotDePasse from '../compte/ChampMotDePasse'
import { REGLES_MOT_DE_PASSE, verifier } from '../compte/regles'
import { creerCompte, MSG_COMPTE_CREE, PAGE_D_ACCUEIL } from '../compte/serviceCompte'
import { LIENS } from '../landing/contenu'
import '../styles/compte.css'

const AVANTAGES = ['Utilisateurs illimités', 'Sans frais de mise en service', 'Sans engagement']
const ERREUR_GENERALE = 'Le compte n’a pas pu être créé. Réessayez.'

// Message d'erreur affiché sous un champ
const Erreur = ({ id, message }) => (message ? <p className="cpt-erreur" id={id}>{message}</p> : null)

// Les 5 indicateurs du mot de passe, cochés en direct (RG-CC-03, RG-CC-04)
function ReglesMotDePasse({ motDePasse }) {
  return (
    <ul className="cpt-regles" aria-label="Règles du mot de passe">
      {REGLES_MOT_DE_PASSE.map((r) => {
        const ok = r.ok(motDePasse)
        return (
          <li key={r.id} className={ok ? 'ok' : undefined} data-ok={ok}>
            <span className="cpt-pastille">{ok && <Icone nom="check" taille={11} epaisseur={3} />}</span>{r.libelle}
          </li>
        )
      })}
    </ul>
  )
}

// SCRUM-15 « Créer un compte pour mon organisme de formation » (maquette docs/maquette-créer-compte.PNG)
function CreerCompte() {
  const navigate = useNavigate()
  const [valeurs, setValeurs] = useState({ email: '', motDePasse: '', confirmation: '', cgu: false })
  const [erreurs, setErreurs] = useState({})
  const [envoi, setEnvoi] = useState(false)

  // Une modification efface l'erreur du champ concerné
  const changer = (champ, valeur) => {
    setValeurs((v) => ({ ...v, [champ]: valeur }))
    setErreurs((avant) => {
      const reste = { ...avant }
      delete reste[champ]
      delete reste.general
      return reste
    })
  }

  // RG-CC-10 : les valeurs saisies restent, sauf les mots de passe
  const refuser = (trouvees) => {
    setErreurs(trouvees)
    setValeurs((v) => ({ ...v, motDePasse: '', confirmation: '' }))
  }

  const envoyer = async (e) => {
    e.preventDefault()
    const trouvees = verifier(valeurs)
    if (Object.keys(trouvees).length) {
      refuser(trouvees)
      return
    }
    setEnvoi(true)
    try {
      await creerCompte(valeurs)
      await navigate(PAGE_D_ACCUEIL, { state: { message: MSG_COMPTE_CREE } })
    } catch (err) {
      refuser(err.erreurs || { general: ERREUR_GENERALE })
      setEnvoi(false)
    }
  }

  const aide = (champ) => (erreurs[champ] ? { 'aria-invalid': true, 'aria-describedby': `erreur-${champ}` } : {})

  return (
    <div className="cpt">
      <header className="cpt-entete">
        <Link className="logo" to="/"><div className="logo-badge"><Icone nom="qualiopi" taille={18} epaisseur={2.2} /></div>Quali-formation</Link>
        <div className="cpt-connexion">
          <span>Déjà un compte ?</span>
          <Link className="btn" to={LIENS.connexion}>Se connecter</Link>
        </div>
      </header>

      <div className="cpt-corps">
        <aside className="cpt-panneau">
          <span className="cpt-badge"><span className="cpt-point" />15 jours d&apos;essai gratuit · sans carte bancaire</span>
          <h2>Créez votre compte et démarrez votre essai</h2>
          <p>Programmes, sessions, documents, émargement, signatures et évaluations : tout est réuni dans un seul outil.</p>
          <ul className="cpt-avantages">
            {AVANTAGES.map((a) => <li key={a}><Icone nom="check" taille={16} epaisseur={2.4} />{a}</li>)}
          </ul>
        </aside>

        <main className="cpt-zone">
          <form className="cpt-form" onSubmit={envoyer} noValidate>
            <h1>Créer votre compte</h1>
            <p className="cpt-sous-titre">Pour le responsable de l&apos;organisme de formation.</p>

            <div className="cpt-bloc">
              <label className="cpt-label" htmlFor="cpt-email">Adresse e-mail</label>
              <input id="cpt-email" type="email" autoComplete="email" placeholder="vous@organisme.fr" value={valeurs.email}
                onChange={(e) => changer('email', e.target.value)} {...aide('email')} />
              <Erreur id="erreur-email" message={erreurs.email} />
            </div>

            <div className="cpt-bloc">
              <label className="cpt-label" htmlFor="cpt-mdp">Mot de passe</label>
              <ChampMotDePasse id="cpt-mdp" autoComplete="new-password" value={valeurs.motDePasse}
                onChange={(e) => changer('motDePasse', e.target.value)} {...aide('motDePasse')} />
              <ReglesMotDePasse motDePasse={valeurs.motDePasse} />
              <Erreur id="erreur-motDePasse" message={erreurs.motDePasse} />
            </div>

            <div className="cpt-bloc">
              <label className="cpt-label" htmlFor="cpt-confirmation">Confirmer le mot de passe</label>
              <input id="cpt-confirmation" type="password" autoComplete="new-password" value={valeurs.confirmation}
                onChange={(e) => changer('confirmation', e.target.value)} {...aide('confirmation')} />
              <Erreur id="erreur-confirmation" message={erreurs.confirmation} />
            </div>

            <div className="cpt-bloc">
              <label className="cpt-cgu">
                <input type="checkbox" checked={valeurs.cgu} onChange={(e) => changer('cgu', e.target.checked)} {...aide('cgu')} />
                <span>J&apos;accepte les <a href="#cgu">CGU / CGV</a> et la <a href="#confidentialite">politique de confidentialité</a>.</span>
              </label>
              <Erreur id="erreur-cgu" message={erreurs.cgu} />
            </div>

            {erreurs.general && <p className="cpt-erreur cpt-erreur-generale" role="alert">{erreurs.general}</p>}

            {/* RG-CC-06 : validation impossible tant que les CGU ne sont pas acceptées */}
            <button type="submit" className="cpt-bouton" disabled={!valeurs.cgu || envoi} aria-busy={envoi}>
              {envoi ? 'Création en cours…' : 'Créer mon compte'}
            </button>
            <p className="cpt-rgpd">Vos données restent protégées, conformément au RGPD.</p>
          </form>
        </main>
      </div>
    </div>
  )
}

export default CreerCompte
