// Thème d'une formation, déduit de son intitulé : choisit l'icône, le libellé et les couleurs de son bandeau
// (l'ordre compte : « Product Owner … agile Scrum » est un thème PO, pas Gestion de projet)

const SCENE_OF = [
  [/business|analyst|\bba\b|besoin|exigence/i, 'ba'],
  [/product owner|\bpo\b|backlog/i, 'po'],
  [/testeur|\btests?\b|qualité logicielle|\bqa\b|selenium|cypress/i, 'test'],
  [/devops|ci\s*\/\s*cd|intégration continue|déploiement continu|docker|kubernetes/i, 'devops'],
  [/architect/i, 'archi'],
  [/\bia\b|intelligence artificielle|prompt|\bia générative|\bai\b|machine learning/i, 'ia'],
  [/manag|équipe|leader/i, 'mgmt'],
  [/excel|bureautique|tableur|word|informatique/i, 'excel'],
  [/projet|agile|scrum/i, 'projet'],
  [/secour|sst|sécurité|santé/i, 'sst'],
  [/parole|communication|oral|présent/i, 'parole'],
  [/anglais|langue|english|espagnol/i, 'langue'],
]

// Dégradé vif du bandeau par thème : couleur de départ (aussi l'accent de la carte) → couleur d'arrivée → touche lumineuse
export const ART_COL = {
  ba: ['#059669', '#06B6D4', '#A7F3D0'], po: ['#4F46E5', '#EC4899', '#FBCFE8'], test: ['#EA580C', '#FACC15', '#FEF08A'],
  devops: ['#2563EB', '#06B6D4', '#A5F3FC'], archi: ['#1E1B4B', '#6366F1', '#C7D2FE'], ia: ['#7C3AED', '#F43F5E', '#FBCFE8'],
  mgmt: ['#DB2777', '#F97316', '#FED7AA'], excel: ['#16A34A', '#A3E635', '#ECFCCB'], projet: ['#0891B2', '#22C55E', '#BBF7D0'],
  sst: ['#DC2626', '#FB923C', '#FED7AA'], parole: ['#9333EA', '#3B82F6', '#DDD6FE'], langue: ['#0EA5E9', '#A855F7', '#E9D5FF'],
  def: ['#0D9488', '#6366F1', '#C7D2FE'],
}

// Libellé du métier affiché dans le bandeau
export const THEME_LIBELLE = {
  ba: 'Business Analyst', po: 'Product Owner', test: 'Test et qualité', devops: 'DevOps', archi: 'Architecture',
  ia: 'Intelligence artificielle', mgmt: 'Management', excel: 'Bureautique', projet: 'Gestion de projet',
  sst: 'Santé et sécurité', parole: 'Prise de parole', langue: 'Langues', def: 'Formation',
}

export const themeDe = (titre) => (SCENE_OF.find(([re]) => re.test(titre || '')) || [0, 'def'])[1]

// Couleur d'accent de la carte (bordure et ombre)
export const artAccent = (f) => ART_COL[themeDe(f.title)][0]
