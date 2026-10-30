import { useEffect, useRef, useState } from 'react'

// Tracés SVG des icônes (viewBox 24x24, trait)
const ICONES = {
  tableau: <><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></>,
  programmes: <path d="M4 19.5A2.5 2.5 0 016.5 17H20V3H6.5A2.5 2.5 0 004 5.5z"/>,
  sessions: <><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></>,
  apprenants: <><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></>,
  inscription: <><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M20 8v6M23 11h-6"/></>,
  documents: <><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/></>,
  signature: <><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></>,
  emargement: <><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></>,
  elearning: <><rect x="2" y="4" width="20" height="14" rx="2"/><path d="M8 22h8M12 18v4"/></>,
  evaluations: <polygon points="12 2 15.1 8.3 22 9.3 17 14.1 18.2 21 12 17.8 5.8 21 7 14.1 2 9.3 8.9 8.3"/>,
  qualiopi: <><path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/><path d="M9 12l2 2 4-4"/></>,
  parametres: <><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M1 12h3M20 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></>,
  menu: <path d="M3 6h18M3 12h18M3 18h18"/>,
  recherche: <><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></>,
  notifications: <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0"/>,
  plus: <path d="M12 5v14M5 12h14"/>,
}

function Icone({ nom, taille = 18, epaisseur = 2 }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={epaisseur}>
      {ICONES[nom]}
    </svg>
  )
}

const FONCTIONNALITES = [
  { icone: 'programmes', titre: 'Programmes de formation', detail: '24 programmes' },
  { icone: 'sessions', titre: 'Sessions & planning', detail: '5 sessions à venir' },
  { icone: 'apprenants', iconeModule: 'inscription', titre: 'Apprenants & inscriptions', detail: '9 dossiers incomplets' },
  { icone: 'documents', titre: 'Modèles de documents', detail: '16 modèles' },
  { icone: 'signature', titre: 'Signature électronique', detail: '8 en attente' },
  { icone: 'emargement', titre: 'Émargement', detail: '2 signatures manquantes' },
  { icone: 'elearning', titre: 'E-learning', detail: '18 modules en ligne' },
  { icone: 'evaluations', titre: 'Évaluations & satisfaction', detail: '142 réponses' },
  { icone: 'qualiopi', titre: 'Suivi Qualiopi', detail: '4 indicateurs à traiter' },
]

const KPIS = [
  { label: 'Conformité Qualiopi', valeur: '87 %', miseEnAvant: true },
  { label: 'Sessions en cours', valeur: '12' },
  { label: 'Apprenants inscrits', valeur: '186' },
  { label: 'Satisfaction moyenne', valeur: '4,6/5' },
]

const SESSIONS = [
  { titre: "Management d'équipe", detail: '27 – 29 oct. · 10/12 inscrits', statut: 'Confirmée', couleur: 'vert' },
  { titre: 'Excel avancé', detail: '3 – 4 nov. · 6/12 inscrits', statut: 'À compléter', couleur: 'orange' },
  { titre: 'Gestion de projet agile', detail: '12 – 15 nov. · 8/8 inscrits', statut: 'Complète', couleur: 'vert' },
]

const TACHES = [
  { titre: 'Relancer 3 conventions non signées', module: 'Signature électronique' },
  { titre: 'Envoyer les convocations Excel avancé', module: 'Modèles de documents' },
  { titre: 'Ajouter une preuve — indicateur 23', module: 'Suivi Qualiopi' },
]

function App() {
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
    <div className="app">

      {/* ================= BARRE LATÉRALE ================= */}
      <aside className={`sidebar${menuOuvert ? ' ouverte' : ''}`} ref={sidebarRef}>
        <div className="logo"><div className="logo-badge">Q</div>Quali-formation</div>

        <nav className="nav">
          <a href="#" className="actif"><Icone nom="tableau" />Tableau de bord</a>
        </nav>

        <div>
          <div className="nav-titre">Fonctionnalités</div>
          <nav className="nav">
            {FONCTIONNALITES.map((f) => (
              <a href="#" key={f.titre}><Icone nom={f.icone} />{f.titre}</a>
            ))}
          </nav>
        </div>

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

        <div className="entete">
          <div>
            <h1>Bonjour Nassiba</h1>
            <p>Voici l'essentiel de votre centre aujourd'hui.</p>
          </div>
          <button className="btn"><Icone nom="plus" taille={16} epaisseur={2.5} />Nouvelle session</button>
        </div>

        {/* 4 indicateurs clés */}
        <section className="kpis">
          {KPIS.map((k) => (
            <div className={`kpi${k.miseEnAvant ? ' mise-en-avant' : ''}`} key={k.label}>
              <div className="kpi-label">{k.label}</div>
              <div className="kpi-valeur">{k.valeur}</div>
            </div>
          ))}
        </section>

        {/* Accès rapide aux 9 fonctionnalités */}
        <h2 className="section-titre">Vos fonctionnalités</h2>
        <section className="modules">
          {FONCTIONNALITES.map((f) => (
            <a href="#" className="module" key={f.titre}>
              <span className="module-icone"><Icone nom={f.iconeModule ?? f.icone} taille={20} /></span>
              <div><h3>{f.titre}</h3><small>{f.detail}</small></div>
              <span className="fleche">→</span>
            </a>
          ))}
        </section>

        {/* Prochaines sessions + À faire */}
        <section className="grille">
          <div className="carte">
            <div className="carte-titre"><h2>Prochaines sessions</h2><a href="#" className="lien">Voir le planning →</a></div>
            {SESSIONS.map((s) => (
              <div className="ligne" key={s.titre}>
                <div><b>{s.titre}</b><small>{s.detail}</small></div>
                <span className={`tag tag-${s.couleur}`}>{s.statut}</span>
              </div>
            ))}
          </div>

          <div className="carte">
            <div className="carte-titre"><h2>À faire</h2><span className="tag tag-orange">{TACHES.length}</span></div>
            {TACHES.map((t) => (
              <div className="ligne tache" key={t.titre}>
                <span className="puce"></span>
                <div><b>{t.titre}</b><small>{t.module}</small></div>
              </div>
            ))}
          </div>
        </section>

        <p className="demo">Maquette — données fictives.</p>
      </main>
    </div>
  )
}

export default App
