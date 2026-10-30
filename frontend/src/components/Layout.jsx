import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import Icone from './Icone'
import { ToastProvider } from './Toast'
import { FONCTIONNALITES } from '../pages/fonctionnalites'

// Fonctionnalités affichées dans le menu, dans cet ordre
const MENU = ['Sessions & planning', 'Émargement', 'Signature électronique', 'Modèles de documents', 'E-learning', 'Suivi Qualiopi']

// Barre latérale + barre du haut, communes à toutes les pages
function Layout() {
  const [menuOuvert, setMenuOuvert] = useState(false)
  const sidebarRef = useRef(null)
  const menuBtnRef = useRef(null)

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
        {/* Un clic sur un lien du menu referme le menu (téléphone) */}
        <aside className={`sidebar${menuOuvert ? ' ouverte' : ''}`} ref={sidebarRef} onClick={(e) => { if (e.target.closest('a')) setMenuOuvert(false) }}>
          <div className="logo"><div className="logo-badge"><Icone nom="qualiopi" taille={18} epaisseur={2.2} /></div>Quali-formation</div>

          <nav className="nav" aria-label="Menu principal">
            <NavLink to="/" end><Icone nom="tableau" />Tableau de bord</NavLink>
            <NavLink to="/formations"><Icone nom="formations" />Formations</NavLink>
            {/* Fonctionnalités à venir (pas encore de page) */}
            {MENU.map((titre) => FONCTIONNALITES.find((f) => f.titre === titre)).map((f) => (
              <a href="#" key={f.titre}><Icone nom={f.icone} />{f.titre}</a>
            ))}
          </nav>

          <nav className="nav nav-bas">
            <a href="#"><Icone nom="parametres" />Paramètres</a>
          </nav>
        </aside>

        {/* ================= CONTENU ================= */}
        <main className="contenu">
          <div className="topbar">
            <button className="menu-btn" ref={menuBtnRef} aria-label="Ouvrir le menu" onClick={() => setMenuOuvert((o) => !o)}>
              <Icone nom="menu" taille={20} />
            </button>
            <label className="recherche"><Icone nom="recherche" /><input type="search" placeholder="Rechercher…" /></label>
            <div className="topbar-droite">
              <div className="icone-btn" title="Notifications"><Icone nom="notifications" taille={20} /><span className="pastille"></span></div>
              <div className="avatar" title="Nassiba B. — Responsable de centre">NB</div>
            </div>
          </div>

          <Outlet />
        </main>
      </div>
    </ToastProvider>
  )
}

export default Layout
