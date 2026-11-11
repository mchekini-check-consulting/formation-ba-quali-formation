import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Icone from '../components/Icone'
import { Modal } from '../components/Modal'
import { LIENS } from '../landing/contenu'
import ChampMotDePasse from './ChampMotDePasse'
import { MSG_CONNECTE, MSG_DECONNECTE, PAGE_D_ACCUEIL, seConnecter } from './serviceCompte'

// SCRUM-16 « Se connecter à mon compte » : pop-up ouvert par-dessus la landing page
// (maquette docs/maquette-se-connecter-a-mon-compte.png).
// « Annuler », Échap et clic en dehors ferment le pop-up : retour à la landing page (RG-CX-07).
function ConnexionDialog() {
  const navigate = useNavigate()
  // Arrivée après « Se déconnecter » (SCRUM-17) : message de confirmation
  const deconnecte = useLocation().state?.deconnecte
  const [valeurs, setValeurs] = useState({ email: '', motDePasse: '' })
  const [erreurs, setErreurs] = useState({})
  const [envoi, setEnvoi] = useState(false)

  const fermer = () => navigate('/')

  // Une modification efface l'erreur du champ concerné et le message général
  const changer = (champ, valeur) => {
    setValeurs((v) => ({ ...v, [champ]: valeur }))
    setErreurs((avant) => {
      const reste = { ...avant }
      delete reste[champ]
      delete reste.general
      return reste
    })
  }

  const envoyer = async (e) => {
    e.preventDefault()
    // RG-CX-03 : un champ vide bloque la connexion et est signalé
    const manquants = {}
    if (!valeurs.email.trim()) manquants.email = "L'adresse e-mail est obligatoire."
    if (!valeurs.motDePasse) manquants.motDePasse = 'Le mot de passe est obligatoire.'
    setErreurs(manquants)
    if (Object.keys(manquants).length) return
    setEnvoi(true)
    try {
      await seConnecter(valeurs)
      await navigate(PAGE_D_ACCUEIL, { state: { message: MSG_CONNECTE } }) // RG-CX-06, SCRUM-19
    } catch (err) {
      setErreurs(err.erreurs || { general: 'La connexion a échoué. Réessayez.' })
      setEnvoi(false)
    }
  }

  const aide = (champ) => (erreurs[champ] ? { 'aria-invalid': true, 'aria-describedby': `cnx-erreur-${champ}` } : {})
  const erreur = (champ) => erreurs[champ] && <p className="cpt-erreur" id={`cnx-erreur-${champ}`}>{erreurs[champ]}</p>

  return (
    <Modal onFermer={fermer} classeFond="cnx-fond">
      <div className="cnx" role="dialog" aria-modal="true" aria-labelledby="cnx-titre">
        <span className="cnx-badge"><Icone nom="qualiopi" taille={22} epaisseur={2.2} /></span>
        <h2 id="cnx-titre">Se connecter</h2>
        <p className="cnx-sous-titre">Accédez à votre compte Quali-formation.</p>
        {deconnecte && <output className="cpt-bienvenue">{MSG_DECONNECTE}</output>}

        <form className="cpt-form" onSubmit={envoyer} noValidate>
          <div className="cnx-bloc">
            <label className="cpt-label" htmlFor="cnx-email">Adresse e-mail</label>
            <input id="cnx-email" type="email" autoComplete="email" placeholder="vous@organisme.fr" autoFocus
              value={valeurs.email} onChange={(e) => changer('email', e.target.value)} {...aide('email')} />
            {erreur('email')}
          </div>
          <div className="cnx-bloc">
            <label className="cpt-label" htmlFor="cnx-mdp">Mot de passe</label>
            <ChampMotDePasse id="cnx-mdp" autoComplete="current-password" value={valeurs.motDePasse}
              onChange={(e) => changer('motDePasse', e.target.value)} {...aide('motDePasse')} />
            {erreur('motDePasse')}
          </div>

          {erreurs.general && <p className="cpt-erreur cpt-erreur-generale" role="alert">{erreurs.general}</p>}

          <div className="cnx-boutons">
            <button type="button" className="cnx-annuler" onClick={fermer}>Annuler</button>
            <button type="submit" className="cpt-bouton" disabled={envoi} aria-busy={envoi}>
              {envoi ? 'Connexion…' : 'Se connecter'}
            </button>
          </div>
        </form>

        {/* RG-CX-08 : ouvre la création de compte (SCRUM-15) à la place du pop-up */}
        <p className="cnx-pied">Pas encore de compte ? <Link to={LIENS.inscription}>Créer un compte</Link></p>
      </div>
    </Modal>
  )
}

export default ConnexionDialog
