// Les 9 fonctionnalités de l'application (tableau de bord et barre latérale).
// `couleur` : couleur de son icône dans le menu.
// `lien` : la fonctionnalité est disponible et a sa propre entrée dans le menu principal.
export const FONCTIONNALITES = [
  { icone: 'formations', titre: 'Formations', couleur: '#2563EB', detail: 'Créer et suivre vos formations', lien: '/formations' },
  { icone: 'sessions', titre: 'Sessions & planning', couleur: '#7C3AED', detail: '5 sessions à venir' },
  { icone: 'apprenants', iconeModule: 'inscription', titre: 'Apprenants & inscriptions', couleur: '#0D9488', detail: '9 dossiers incomplets' },
  { icone: 'documents', titre: 'Modèles de documents', couleur: '#EA580C', detail: '16 modèles' },
  { icone: 'signature', titre: 'Signature électronique', couleur: '#DB2777', detail: '8 en attente' },
  { icone: 'emargement', titre: 'Émargement', couleur: '#16A34A', detail: '2 signatures manquantes' },
  { icone: 'elearning', titre: 'E-learning', couleur: '#0891B2', detail: '18 modules en ligne' },
  { icone: 'evaluations', titre: 'Évaluations & satisfaction', couleur: '#D97706', detail: '142 réponses' },
  { icone: 'qualiopi', titre: 'Suivi Qualiopi', couleur: '#CA8A04', detail: '4 indicateurs à traiter' },
]
