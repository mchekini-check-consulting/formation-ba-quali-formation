// Catalogue des 13 blocs Qualiopi et règles de complétude (repris de la maquette validée).
// Une formation côté front : { id, ref, title, duree, modalite, statut, pub, version, organisme, prepare,
//   created, maj, values: {réponses aux questions, modules: [séquences]}, others: [{titre, contenu}], sess: [sessions] }

export const FORMATEURS = ['Sarah Benali — Business Analyst senior', 'Thomas Martin — consultant en management', 'Nadia Haddad — formatrice bureautique', 'Karim Lefèvre — formateur SST']

// RG07 : 13 blocs répartis en 3 parties (sec = index de la partie)
export const TILES = [
  { id: 'public', title: 'Public et prérequis', hint: "À qui s'adresse la formation, quel besoin elle résout et ce qu'il faut pour la suivre.", sec: 0, q: [
    { k: 'public', kind: 'chips', label: "À qui s'adresse la formation ?", options: ['Salariés', 'Managers', "Demandeurs d'emploi", 'Indépendants', 'Débutants', 'Tout public'] },
    { k: 'besoin', kind: 'area', label: 'Quel besoin professionnel la formation aide-t-elle à résoudre ?', ph: 'Ex. : managers nouvellement nommés qui doivent animer une équipe' },
    { k: 'prerequis', kind: 'area', label: 'Quels sont les prérequis ?', help: 'Écrivez « Aucun » s’il n’y en a pas.', ph: "Ex. : avoir suivi le niveau 1, ou 1 an d'expérience en encadrement" }] },
  { id: 'objectifs', title: 'Objectifs', hint: 'Ce que le stagiaire saura faire à la fin.', sec: 0, q: [
    { k: 'objectifs', kind: 'area', label: 'Quels sont les objectifs opérationnels ?', help: 'Des actions observables et évaluables : identifier, appliquer, réaliser, analyser…', ph: "À l'issue de la formation, le stagiaire sera capable de…" }] },
  { id: 'programme', title: 'Programme', hint: 'Le déroulé de la formation, séquence par séquence. Chaque séquence est reliée à un objectif.', sec: 0, wide: true, q: [
    { k: 'modules', kind: 'modules', label: 'Séquences du programme', help: 'Les champs marqués * sont obligatoires pour chaque séquence.' }] },
  { id: 'methodes', title: 'Méthodes et moyens', hint: 'Comment vous formez et avec quels outils.', sec: 0, q: [
    { k: 'methodes', kind: 'chips', label: 'Méthodes pédagogiques', options: ['Exposés', 'Démonstrations', 'Ateliers', 'Mises en situation', 'Études de cas', 'Classe inversée'] },
    { k: 'materiel', kind: 'chips', label: 'Moyens techniques', options: ['Salle équipée', 'Vidéoprojecteur', 'Logiciels', 'Classe virtuelle', 'Plateforme e-learning'] },
    { k: 'supports', kind: 'chips', label: 'Supports remis aux stagiaires', options: ['Support de cours', 'Fiches outils', 'Vidéos', 'Exercices corrigés', 'Bibliographie'] }] },
  { id: 'intervenants', title: 'Formateurs', hint: 'Qui anime la formation.', sec: 0, q: [
    { k: 'formateurs', kind: 'chips', label: 'Formateurs', help: 'Choisissez parmi vos formateurs.', options: FORMATEURS },
    // RG10 : visible seulement si la modalité n'est pas Présentiel
    { k: 'assistance_dist', kind: 'text', label: 'Assistance à distance : contact, horaires et délai de réponse', ph: 'Ex. : support@moncentre.fr, 9h–17h, réponse sous 24 h', showIf: (v, f) => f.modalite !== 'Présentiel' }] },
  { id: 'acces', title: 'Accès et inscription', hint: "Comment s'inscrire, dans quel délai, où, et qui contacter.", sec: 1, q: [
    { k: 'acces', kind: 'chips', label: "Comment s'inscrire ?", options: ['Inscription par le centre', 'Formulaire', 'Entretien préalable', 'Sur dossier', "Demande de l'employeur"] },
    { k: 'delai', kind: 'text', label: "Délai d'accès", help: 'Le temps entre la demande et le début de la formation.', ph: 'Ex. : 15 jours après la demande' },
    { k: 'lieu', kind: 'text', label: 'Lieu ou plateforme', ph: 'Ex. : 12 rue des Lilas, Lyon — ou Teams' },
    { k: 'contact', kind: 'text', label: 'Contact', help: 'Nom, e-mail et téléphone.', ph: 'Ex. : Camille Laurent — formation@moncentre.fr — 04 00 00 00 00' }] },
  { id: 'tarif', title: 'Tarif et financement', hint: 'Le prix et les financements possibles.', sec: 1, q: [
    { k: 'tarif', kind: 'money', label: 'Prix', ph: 'Ex. : 1 200' },
    { k: 'unite', kind: 'select', label: 'Le prix est…', options: ['Par apprenant', 'Par groupe', 'Par jour'] },
    { k: 'taxe', kind: 'select', label: 'Montant indiqué en…', options: ['HT', 'TTC'] },
    { k: 'financements', kind: 'chips', label: 'Financements possibles', help: 'Seulement ceux réellement mobilisables.', options: ['CPF', 'OPCO', 'France Travail', 'Entreprise', 'Personnel'] }] },
  { id: 'handicap', title: 'Accessibilité handicap', hint: 'Comment vous accueillez les personnes en situation de handicap.', sec: 1, q: [
    { k: 'ref_handicap', kind: 'select', label: 'Référent handicap', options: ['Yanis Morel', 'Camille Laurent'] },
    { k: 'amenagements', kind: 'chips', label: 'Adaptations possibles', options: ['Supports adaptés', 'Rythme aménagé', 'Formation à distance possible', 'Accompagnement individuel'] },
    { k: 'locaux', kind: 'area', label: 'Accessibilité des locaux et des outils', help: 'Précisez les limites éventuelles.', ph: 'Ex. : locaux PMR ; vidéos sous-titrées' }] },
  { id: 'positionnement', title: 'Évaluation avant la formation', hint: 'Comment vous évaluez le niveau et les besoins au départ.', sec: 2, q: [
    { k: 'positionnement', kind: 'chips', label: 'Comment évaluez-vous le niveau avant la formation ?', options: ['Questionnaire de positionnement', 'Entretien préalable', 'Test de niveau', 'Auto-évaluation', "Recueil des besoins avec l'entreprise"] }] },
  { id: 'evaluation', title: 'Évaluation des acquis', hint: 'Comment vous vérifiez que les objectifs sont atteints.', sec: 2, q: [
    { k: 'eval_pendant', kind: 'chips', label: 'Pendant la formation', options: ['Quiz', 'Exercices', 'Observations', 'Cas pratiques'] },
    { k: 'evaluation', kind: 'chips', label: 'En fin de formation', options: ['QCM', 'Mise en situation', 'Étude de cas', 'Évaluation orale', 'Projet'] },
    { k: 'criteres', kind: 'text', label: 'Critères de réussite', ph: 'Ex. : 70 % de bonnes réponses au QCM' }] },
  { id: 'suivi', title: 'Document remis', hint: 'Ce que reçoit le stagiaire à la fin.', sec: 2, q: [
    { k: 'document', kind: 'select', label: 'Document remis en fin de formation', options: ['Attestation de réalisation', 'Certificat de réalisation'] }] },
  { id: 'satisfaction', title: 'Satisfaction', hint: "Comment vous recueillez l'avis des participants.", sec: 2, q: [
    { k: 'satisfaction', kind: 'chips', label: "Comment recueillez-vous l'avis ?", options: ['À chaud (fin de formation)', 'À froid (3 mois après)', "Auprès de l'entreprise", 'Auprès du formateur'] }] },
  // RG09 : les deux questions forment un groupe, une seule réponse suffit
  { id: 'resultats', title: 'Indicateurs de résultats', hint: 'Les résultats communiqués au public. Remplissez au moins une des deux réponses.', sec: 2, q: [
    { k: 'resultats_mesures', kind: 'area', group: 'res', label: 'Résultats déjà mesurés', help: 'Période, résultat, nombre de participants et méthode.', ph: 'Ex. : satisfaction 2025 — 4,6/5 — 38 répondants — questionnaire à chaud' },
    { k: 'resultats_plan', kind: 'area', group: 'res', label: 'Pas encore de données ? Comment seront-ils collectés ?', ph: 'Ex. : questionnaire à chaud dès la première session, publication après 3 sessions' }] },
]
export const SECTIONS = ['La formation', 'Accès et tarif', 'Évaluation et suivi']
export const MODALITES = ['Présentiel', 'Distanciel', 'Mixte']

// RG23 : statuts ; le libellé et la classe de la pastille
export const STATUS = { brouillon: ['Brouillon', 'st-brouillon'], incomplete: ['Incomplète selon Qualiopi', 'st-incomplete'], validee: ['Validée', 'st-validee'], archivee: ['Archivée', 'st-archivee'] }

export const filled = (v) => Array.isArray(v) ? v.some((x) => String(x ?? '').trim() !== '') : String(v ?? '').trim() !== ''

// RG18 : champs obligatoires d'une séquence
export const MOD_REQ = ['seq', 'objectif', 'contenu', 'duree', 'modalite', 'activites']
export const MOD_LBL = { seq: 'Titre de la séquence', duree: 'Durée', objectif: 'Objectif visé', modalite: 'Modalité', contenu: 'Contenu abordé', activites: 'Méthodes et activités' }
export const modDone = (m) => MOD_REQ.every((k) => filled(m[k]))
export const SEQ_MODES = ['Présentiel', 'Distanciel synchrone (classe virtuelle)', 'Distanciel asynchrone (e-learning)']
export const SEQ_EVAL = ['Quiz', 'Exercice', 'Cas pratique', 'Mise en situation', 'Pas d’évaluation pour cette séquence']

// RG19 : la liste des objectifs saisis dans le bloc Objectifs (un par ligne ou séparés par « ; »)
export const objList = (v) => String(v.objectifs || '').split(/\n|;/).map((x) => x.trim().replace(/\.$/, '')).filter(Boolean).map((x) => x[0].toUpperCase() + x.slice(1))

// RG20 : modalité proposée pour une nouvelle séquence
export const modaliteSequence = (modaliteFormation) => modaliteFormation === 'Distanciel' ? SEQ_MODES[1] : SEQ_MODES[0]

export const visibleQs = (t, v, f) => t.q.filter((q) => !q.showIf || q.showIf(v, f || {}))

export function qFilled(q, v) {
  if (q.kind === 'modules') { const m = v.modules || []; return m.length > 0 && m.every(modDone) }
  return filled(v[q.k])
}

// RG08 : un bloc est complet quand toutes ses questions visibles ont une réponse (RG09 pour les groupes)
export function tileDone(t, v, f) {
  const groups = {}
  for (const q of visibleQs(t, v, f).filter((x) => !x.optional)) {
    if (q.group) groups[q.group] = groups[q.group] || qFilled(q, v)
    else if (!qFilled(q, v)) return false
  }
  return Object.values(groups).every(Boolean)
}
export const missingTiles = (f) => TILES.filter((t) => !tileDone(t, f.values || {}, f))

// RG16 / RG26 : la formation a un programme dès qu'une séquence a un titre
export const hasProg = (f) => ((f.values || {}).modules || []).some((m) => String(m.seq || '').trim())

// État affiché d'une formation sur sa carte (« apublier » = validée)
export const life = (f) => f.statut === 'archivee' ? 'archivee' : f.statut === 'brouillon' ? 'brouillon' : f.statut === 'validee' ? 'apublier' : 'incomplete'
// RG24 : seule une formation validée ou incomplète peut être publiée
export const isPub = (f) => f.pub === 'publiee' && (f.statut === 'validee' || f.statut === 'incomplete')

// État affiché sur la carte : libellé, icône, classe CSS et aide au survol
export const LC = {
  brouillon: { lab: 'Brouillon', ic: 'pen', cls: 'lc-draft', help: 'Enregistrée pour plus tard' },
  incomplete: { lab: 'Incomplète selon Qualiopi', ic: 'alert', cls: 'lc-inc', help: 'Des informations Qualiopi manquent' },
  apublier: { lab: 'Validée', ic: 'check', cls: 'lc-ready', help: 'Toutes les informations Qualiopi sont remplies' },
  publiee: { lab: 'Publiée', ic: 'globe', cls: 'lc-pub', help: 'Visible dans votre catalogue' },
  archivee: { lab: 'Archivée', ic: 'box', cls: 'lc-arch', help: 'Retirée du catalogue' },
}

// Utilitaires d'affichage
export const today = () => new Date().toISOString().slice(0, 10)
export const frDate = (iso) => { const [y, m, d] = String(iso || '').split('-'); return d ? `${d}/${m}/${y}` : '' }
export const num = (x) => Number(String(x ?? '').replace(',', '.')) || 0
export const fmt = (n) => String(Math.round(n * 100) / 100).replace('.', ',')
export const one = (x) => Array.isArray(x) ? x.filter((y) => String(y).trim()) : (String(x ?? '').trim() ? [String(x)] : [])
export const money = (f) => { const v = f.values || {}; return v.tarif ? `${v.tarif} € ${one(v.taxe)[0] || ''}`.trim() : '' }
export const pluriel = (n, mot, motPluriel = `${mot}s`) => (n > 1 ? motPluriel : mot)
