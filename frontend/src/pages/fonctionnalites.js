// Les 9 fonctionnalités de l'application (tableau de bord et barre latérale).
// `lien` : la fonctionnalité est disponible et a sa propre entrée dans le menu principal.
export const FONCTIONNALITES = [
  { icone: 'formations', titre: 'Formations', detail: 'Créer et suivre vos formations', lien: '/formations' },
  { icone: 'sessions', titre: 'Sessions & planning', detail: '5 sessions à venir', lien: '/sessions' },
  { icone: 'apprenants', iconeModule: 'inscription', titre: 'Apprenants & inscriptions', detail: '9 dossiers incomplets' },
  { icone: 'documents', titre: 'Modèles de documents', detail: '16 modèles' },
  { icone: 'signature', titre: 'Signature électronique', detail: '8 en attente' },
  { icone: 'emargement', titre: 'Émargement', detail: '2 signatures manquantes' },
  { icone: 'elearning', titre: 'E-learning', detail: '18 modules en ligne' },
  { icone: 'evaluations', titre: 'Évaluations & satisfaction', detail: '142 réponses' },
  { icone: 'qualiopi', titre: 'Suivi Qualiopi', detail: '4 indicateurs à traiter' },
]
