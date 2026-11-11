import { Link } from 'react-router-dom'

// Échec du chargement d'une page : le message, avec « Se connecter » si personne n'est connecté (API : 401 NON_CONNECTE)
// et « Retour aux formations » si la formation est introuvable (inexistante ou créée par un autre compte : 404)
function ErreurChargement({ erreur }) {
  return (
    <p className="chargement" role="alert">
      {erreur.message}
      {erreur.code === 'NON_CONNECTE' && <>{' '}<Link to="/se-connecter">Se connecter</Link></>}
      {erreur.code === 'INTROUVABLE' && <>{' '}<Link to="/formations">Retour aux formations</Link></>}
    </p>
  )
}

// Page pas encore chargée : le message d'attente, ou l'erreur si le chargement a échoué
export function PageEnChargement({ erreur, texte }) {
  return <div className="wrap">{erreur ? <ErreurChargement erreur={erreur} /> : <p className="chargement">{texte}</p>}</div>
}

export default ErreurChargement
