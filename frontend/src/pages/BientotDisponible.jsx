import { Link, useParams } from 'react-router-dom'
import Icone from '../components/Icone'
import { FONCTIONNALITES, PAGES_PROFIL } from './fonctionnalites'

// Page « Bientôt disponible » (SCRUM-19) : fonctionnalité du menu ou du profil pas encore développée
function BientotDisponible() {
  const { code } = useParams()
  const page = [...FONCTIONNALITES, ...PAGES_PROFIL].find((f) => f.code === code)
  return (
    <div className="wrap">
      <div className="page-head"><h1>{page ? page.titre : 'Bientôt disponible'}</h1></div>
      <section className="card bientot">
        <span className="bientot-ic" aria-hidden="true"><Icone nom={page?.icone || 'clock'} taille={26} /></span>
        <h2>Bientôt disponible</h2>
        <p className="sub">Cette fonctionnalité est en cours de préparation. Elle sera disponible dans une prochaine version.</p>
        <Link className="btn btn-line" to="/sessions">Retour à Sessions et planning</Link>
      </section>
    </div>
  )
}

export default BientotDisponible
