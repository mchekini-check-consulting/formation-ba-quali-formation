import { useLocation } from 'react-router-dom'
import '../styles/compte.css'

// Tableau de bord : vide pour l'instant (son contenu sera défini plus tard)
function TableauDeBord() {
  // Arrivée depuis « Créer un compte » (SCRUM-15) ou « Se connecter » (SCRUM-16), en attendant la page d'accueil (SCRUM-19)
  const { compteCree, connecte } = useLocation().state || {}
  return (
    <>
      <div className="entete">
        <h1>Bienvenue dans Quali-formation</h1>
      </div>
      {compteCree && <output className="cpt-bienvenue">Votre compte a été créé. Bienvenue sur Quali-formation !</output>}
      {connecte && <output className="cpt-bienvenue">Vous êtes connecté. Bienvenue sur Quali-formation !</output>}
    </>
  )
}

export default TableauDeBord
