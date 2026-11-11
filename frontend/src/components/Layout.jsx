import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { compteConnecte } from '../compte/serviceCompte'
import BarreHaut from './BarreHaut'
import Icone from './Icone'
import { ToastProvider } from './Toast'
import { FONCTIONNALITES, lienFonctionnalite } from '../pages/fonctionnalites'

// Icône du menu sur une pastille, du même vert que le logo
const IconeMenu = ({ nom }) => <span className="nav-ic"><Icone nom={nom} taille={17} /></span>

// Barre latérale + barre du haut, communes à toutes les pages
function Layout() {
  const [menuOuvert, setMenuOuvert] = useState(false)
  const sidebarRef = useRef(null)
  // Un clic sur un lien du menu referme le menu (téléphone)
  const fermerMenu = () => setMenuOuvert(false)
  const menuBtnRef = useRef(null)
  // Compte connecté (GET /auth/moi) : profil du haut de page ; null si personne n'est connecté
  const [compte, setCompte] = useState(null)

  useEffect(() => {
    let actif = true
    compteConnecte().then((c) => { if (actif) setCompte(c) })
    return () => { actif = false }
  }, [])

  // Menu dépliable sur téléphone : un clic en dehors le referme
  useEffect(() => {
    const fermer = (e) => {
      if (window.innerWidth <= 760 && !sidebarRef.current.contains(e.target) && !menuBtnRef.current.contains(e.target)) {
        setMenuOuvert(false)
      }
    }
    document.addEventListener('click', fermer)
    return () => document.removeEventListener('click', fermer)
  }, [])

  return (
    <ToastProvider>
      <div className="app">

        {/* ================= BARRE LATÉRALE ================= */}
        <aside className={`sidebar${menuOuvert ? ' ouverte' : ''}`} ref={sidebarRef}>
          {/* Le logo ramène à la landing page */}
          <Link className="logo" to="/" onClick={fermerMenu}><div className="logo-badge"><Icone nom="qualiopi" taille={18} epaisseur={2.2} /></div>Quali-formation</Link>

          {/* SCRUM-19 : tous les éléments sont cliquables ; une fonctionnalité pas encore développée
              ouvre sa page « Bientôt disponible » */}
          <nav className="nav" aria-label="Menu principal">
            {FONCTIONNALITES.map((f) => (
              <NavLink to={lienFonctionnalite(f)} end={f.code === 'tableau-de-bord'} onClick={fermerMenu} key={f.code}>
                <IconeMenu nom={f.icone} />{f.titre}
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* ================= CONTENU ================= */}
        <main className="contenu">
          <div className="topbar">
            <button className="menu-btn" ref={menuBtnRef} aria-label="Ouvrir le menu" onClick={() => setMenuOuvert((o) => !o)}>
              <Icone nom="menu" taille={20} />
            </button>
            <BarreHaut compte={compte} />
          </div>

          <Outlet />
        </main>
      </div>
    </ToastProvider>
  )
}

export default Layout
