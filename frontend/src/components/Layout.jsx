import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { compteConnecte, initiales } from '../compte/serviceCompte'
import BarreHaut from './BarreHaut'
import Icone from './Icone'
import { ToastProvider } from './Toast'
import { lienBientot, SECTIONS_MENU } from '../pages/fonctionnalites'

// Entrée du menu : lien vers sa page, mis en évidence sur la page en cours (CA3) ;
// « Bientôt » : grisée, non cliquable (CA2)
function EntreeMenu({ entree, onClick }) {
  if (entree.bientot) {
    return (
      <span className="nav-a nav-bientot" aria-disabled="true">
        <Icone nom={entree.icone} taille={18} />{entree.titre}<span className="nav-badge">Bientôt</span>
      </span>
    )
  }
  return (
    <NavLink to={entree.lien} end={entree.code === 'tableau-de-bord'} onClick={onClick}>
      <Icone nom={entree.icone} taille={18} />{entree.titre}
    </NavLink>
  )
}

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

          {/* SCRUM-209 : menu rangé par sections (maquette) */}
          <nav className="nav" aria-label="Menu principal">
            {SECTIONS_MENU.map((section) => (
              <div className="nav-section" key={section.titre || 'accueil'}>
                {section.titre && <p className="nav-titre">{section.titre}</p>}
                {section.entrees.map((e) => <EntreeMenu entree={e} onClick={fermerMenu} key={e.code} />)}
              </div>
            ))}
          </nav>

          {/* En bas : Paramètres, puis le compte connecté. Le compte n'a pas encore de nom ni d'organisme : initiales et « Mon compte » ;
              l'e-mail n'apparaît que dans la liste du profil (SCRUM-19, CA5) */}
          <div className="nav nav-bas">
            <NavLink to={lienBientot('parametres')} onClick={fermerMenu}><Icone nom="parametres" taille={18} />Paramètres</NavLink>
            {compte && (
              <div className="nav-compte">
                <span className="avatar" aria-hidden="true">{initiales(compte.email)}</span>
                <span className="nav-compte-nom">Mon compte</span>
              </div>
            )}
          </div>
        </aside>

        {/* ================= CONTENU ================= */}
        <main className="contenu">
          <div className="topbar">
            <button className="menu-btn" ref={menuBtnRef} aria-label="Ouvrir le menu" onClick={() => setMenuOuvert((o) => !o)}>
              <Icone nom="menu" taille={18} />
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
