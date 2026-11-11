import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { initiales, seDeconnecter } from '../compte/serviceCompte'
import { lienBientot, PAGES_PROFIL } from '../pages/fonctionnalites'
import Icone from './Icone'

// Haut de page (SCRUM-19) : cloche de notifications et profil du compte connecté.
// Le profil n'affiche que les initiales : l'e-mail n'apparaît qu'en ouvrant la liste.
// Un clic sur l'un ouvre sa liste (et ferme l'autre) ; un clic à côté ou Échap la referme.
// « Se déconnecter » (SCRUM-17) ferme la connexion puis ramène à la page de connexion.
function BarreHaut({ compte }) {
  const navigate = useNavigate()
  const [ouvert, setOuvert] = useState(null) // 'notifications', 'profil' ou null
  const [erreur, setErreur] = useState(null)
  const zone = useRef(null)

  useEffect(() => {
    if (!ouvert) return undefined
    const clic = (e) => { if (!zone.current.contains(e.target)) setOuvert(null) }
    const touche = (e) => { if (e.key === 'Escape') setOuvert(null) }
    document.addEventListener('mousedown', clic)
    document.addEventListener('keydown', touche)
    return () => { document.removeEventListener('mousedown', clic); document.removeEventListener('keydown', touche) }
  }, [ouvert])

  const basculer = (liste) => { setErreur(null); setOuvert(ouvert === liste ? null : liste) }

  const deconnecter = async () => {
    try {
      await seDeconnecter()
      // replace : le bouton « retour » du navigateur ne ramène pas sur la page quittée
      void navigate('/se-connecter', { replace: true, state: { deconnecte: true } })
    } catch (e) {
      setErreur(e.message)
    }
  }

  return (
    <div className="topbar-droite" ref={zone}>
      <div className="bh-zone">
        <button type="button" className="icone-btn" aria-label="Notifications" aria-haspopup="true"
          aria-expanded={ouvert === 'notifications'} onClick={() => basculer('notifications')}>
          <Icone nom="notifications" taille={20} />
        </button>
        {ouvert === 'notifications' && (
          <section className="bh-panneau bh-notifications" aria-label="Notifications">
            <h2>Notifications</h2>
            <p className="bh-vide">Aucune notification</p>
          </section>
        )}
      </div>

      {compte && (
        <div className="bh-zone">
          <button type="button" className="bh-profil" aria-label="Profil" aria-haspopup="menu"
            aria-expanded={ouvert === 'profil'} onClick={() => basculer('profil')}>
            <span className="avatar" aria-hidden="true">{initiales(compte.email)}</span>
            <span className={`bh-chev${ouvert === 'profil' ? ' ouvert' : ''}`} aria-hidden="true"><Icone nom="chev" taille={16} /></span>
          </button>
          {ouvert === 'profil' && (
            <div className="bh-panneau bh-menu" role="menu" aria-label="Profil">
              <p className="bh-compte">{compte.email}</p>
              {PAGES_PROFIL.map((p) => (
                <Link key={p.code} role="menuitem" to={lienBientot(p.code)} onClick={() => setOuvert(null)}>{p.titre}</Link>
              ))}
              <button type="button" role="menuitem" className="bh-deconnexion" onClick={deconnecter}>Se déconnecter</button>
              {erreur && <p className="bh-erreur" role="alert">{erreur}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default BarreHaut
