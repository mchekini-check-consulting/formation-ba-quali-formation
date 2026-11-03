import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import Icone from './Icone'
import { ToastProvider } from './Toast'
import { FONCTIONNALITES } from '../pages/fonctionnalites'

// Fonctionnalités affichées dans le menu, dans cet ordre
const MENU = ['Sessions & planning', 'Émargement', 'Signature électronique', 'Modèles de documents', 'E-learning', 'Suivi Qualiopi']

// Icône du menu sur une pastille, du même vert que le logo
const IconeMenu = ({ nom }) => <span className="nav-ic"><Icone nom={nom} taille={17} /></span>

// Barre latérale + barre du haut, communes à toutes les pages
function Layout() {
  const [menuOuvert, setMenuOuvert] = useState(false)
  const sidebarRef = useRef(null)
  // Un clic sur un lien du menu referme le menu (téléphone)
  const fermerMenu = () => setMenuOuvert(false)
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
        <aside className={`sidebar${menuOuvert ? ' ouverte' : ''}`} ref={sidebarRef}>
          <div className="logo"><div className="logo-badge"><Icone nom="qualiopi" taille={18} epaisseur={2.2} /></div>Quali-formation</div>

          <nav className="nav" aria-label="Menu principal">
            <NavLink to="/tableau-de-bord" end onClick={fermerMenu}><IconeMenu nom="tableau" />Tableau de bord</NavLink>
            <NavLink to="/formations" onClick={fermerMenu}><IconeMenu nom="formations" />Formations</NavLink>
            {/* Fonctionnalités avec leur page (`lien`), puis celles à venir (grisées) */}
            {MENU.map((titre) => FONCTIONNALITES.find((f) => f.titre === titre)).map((f) => (f.lien
              ? <NavLink to={f.lien} onClick={fermerMenu} key={f.titre}><IconeMenu nom={f.icone} />{f.titre}</NavLink>
              : <span className="nav-a" aria-disabled="true" key={f.titre}><IconeMenu nom={f.icone} />{f.titre}</span>
            ))}
          </nav>

          <nav className="nav nav-bas">
            <span className="nav-a" aria-disabled="true"><IconeMenu nom="parametres" />Paramètres</span>
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
