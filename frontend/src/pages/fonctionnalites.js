// Menu latéral (SCRUM-19), dans l'ordre de l'US. Chaque élément est cliquable :
// `lien` = page disponible ; sinon, la page « Bientôt disponible » de la fonctionnalité (/bientot-disponible/<code>).
export const FONCTIONNALITES = [
  { code: 'tableau-de-bord', icone: 'tableau', titre: 'Tableau de bord', lien: '/tableau-de-bord' },
  { code: 'formations', icone: 'formations', titre: 'Formations et programmes', lien: '/formations' },
  { code: 'sessions', icone: 'sessions', titre: 'Sessions et planning', lien: '/sessions' },
  { code: 'documents', icone: 'documents', titre: 'Documents' },
  { code: 'emargement', icone: 'emargement', titre: 'Émargement' },
  { code: 'e-learning', icone: 'elearning', titre: 'E-learning' },
  { code: 'evaluations', icone: 'evaluations', titre: 'Évaluations et satisfaction' },
  { code: 'signature', icone: 'signature', titre: 'Signature électronique' },
  { code: 'qualiopi', icone: 'qualiopi', titre: 'Qualiopi' },
]

// Pages du menu du profil pas encore développées (SCRUM-19)
export const PAGES_PROFIL = [
  { code: 'mon-profil', titre: 'Mon profil' },
  { code: 'parametres', titre: 'Paramètres' },
]

export const lienBientot = (code) => `/bientot-disponible/${code}`
export const lienFonctionnalite = (f) => f.lien || lienBientot(f.code)
