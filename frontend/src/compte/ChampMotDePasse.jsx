import { useState } from 'react'
import Icone from '../components/Icone'

// Champ mot de passe avec le bouton œil (afficher / masquer), commun à « Créer un compte » et « Se connecter »
function ChampMotDePasse({ id, ...props }) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="cpt-mdp">
      <input id={id} type={visible ? 'text' : 'password'} {...props} />
      <button type="button" className="cpt-oeil" onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>
        <Icone nom={visible ? 'oeilBarre' : 'oeil'} taille={19} />
      </button>
    </div>
  )
}

export default ChampMotDePasse
