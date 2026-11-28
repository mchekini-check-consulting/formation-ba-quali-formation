// Menu latéral rangé par sections (SCRUM-209, évolution du menu SCRUM-19), dans l'ordre de la maquette.
// `lien` : page disponible ; `bientot` : entrée grisée « Bientôt », non cliquable (CA2).
export const SECTIONS_MENU = [
  {
    titre: null,
    entrees: [{ code: 'tableau-de-bord', icone: 'tableau', titre: 'Tableau de bord', lien: '/tableau-de-bord' }],
  },
  {
    titre: 'Organiser',
    entrees: [
      { code: 'formations', icone: 'formations', titre: 'Formations', lien: '/formations' },
      { code: 'sessions', icone: 'sessions', titre: 'Sessions', lien: '/sessions' },
      { code: 'parties-prenantes', icone: 'apprenants', titre: 'Parties prenantes', lien: '/parties-prenantes' },
      { code: 'e-learning', icone: 'elearning', titre: 'E-learning', bientot: true },
    ],
  },
  {
    titre: 'Documents',
    entrees: [
      { code: 'modeles', icone: 'documents', titre: 'Modèles', lien: '/modeles' }, // SCRUM-210
      { code: 'signature', icone: 'signature', titre: 'Signature électronique', bientot: true },
    ],
  },
  {
    titre: 'Qualité',
    entrees: [{ code: 'qualiopi', icone: 'medaille', titre: 'Qualiopi', bientot: true }],
  },
]

// Toutes les entrées du menu, sans les sections
export const FONCTIONNALITES = SECTIONS_MENU.flatMap((s) => s.entrees)

// Pages pas encore développées du bas du menu et du menu du profil (SCRUM-19)
export const PAGES_PROFIL = [
  { code: 'mon-profil', titre: 'Mon profil' },
  { code: 'parametres', icone: 'parametres', titre: 'Paramètres' },
]

export const lienBientot = (code) => `/bientot-disponible/${code}`
