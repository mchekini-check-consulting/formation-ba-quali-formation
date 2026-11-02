// Formations d'exemple de la maquette (utilisées tant que l'API n'est pas branchée, et pour les tests)

function fullValues(extra) {
  return {
    public: ['Managers'], besoin: 'Managers de proximité qui doivent animer et faire progresser une équipe.',
    prerequis: "Avoir suivi le niveau 1 ou 1 an d'expérience en encadrement.",
    objectifs: 'Fixer des objectifs SMART ; déléguer une tâche ; conduire un entretien individuel.',
    modules: [
      { seq: 'Fédérer son équipe', contenu: 'Rôle du manager, objectifs SMART', objectif: 'Fixer des objectifs SMART', duree: '3,5', modalite: 'Présentiel', activites: 'Études de cas', supports: 'Fiche outil SMART', evalseq: 'Exercice' },
      { seq: 'Déléguer', contenu: 'Délégation, suivi, feedback', objectif: 'Déléguer une tâche', duree: '3,5', modalite: 'Présentiel', activites: 'Jeux de rôle', supports: '', evalseq: 'Mise en situation' },
      { seq: 'Entretien individuel', contenu: 'Préparer et mener un entretien', objectif: 'Conduire un entretien individuel', duree: '7', modalite: 'Présentiel', activites: 'Mises en situation filmées', supports: 'Grille d’entretien', evalseq: 'Mise en situation' }],
    methodes: ['Exposés', 'Études de cas', 'Mises en situation'], materiel: ['Salle équipée', 'Vidéoprojecteur'], supports: ['Support de cours', 'Fiches outils'],
    formateurs: ['Thomas Martin — consultant en management'], assistance_dist: 'support@capcompetences.fr — 9h–17h — réponse sous 24 h',
    lieu: '12 rue des Lilas, 69003 Lyon',
    acces: ['Inscription par le centre', 'Entretien préalable'], delai: '15 jours après la demande', contact: 'Camille Laurent — formation@capcompetences.fr — 04 72 00 00 00',
    tarif: '1 200', unite: 'Par apprenant', taxe: 'HT', financements: ['OPCO', 'Entreprise'],
    ref_handicap: 'Yanis Morel', amenagements: ['Supports adaptés', 'Rythme aménagé'], locaux: 'Locaux accessibles PMR ; supports disponibles en gros caractères.',
    positionnement: ['Questionnaire de positionnement'], eval_pendant: ['Exercices', 'Cas pratiques'], evaluation: ['QCM', 'Mise en situation'], criteres: '70 % de bonnes réponses au QCM final',
    document: 'Attestation de réalisation', satisfaction: ['À chaud (fin de formation)', 'À froid (3 mois après)'],
    resultats_mesures: 'Satisfaction 2025 : 4,6/5 — 38 répondants — questionnaire à chaud',
    ...extra,
  }
}
const clear = (vals, keys) => { keys.forEach((k) => { vals[k] = Array.isArray(vals[k]) ? [] : '' }); return vals }

// Sessions d'exemple : n sessions de 2 jours, espacées de 2 mois à partir de septembre 2026
const mk = (n, lieu) => Array.from({ length: n }, (_, i) => {
  const d = new Date(2026, 8 + i * 2, 6 + i * 3)
  const debut = d.toISOString().slice(0, 10), fin = new Date(d.getTime() + 86400000).toISOString().slice(0, 10)
  return { debut, fin, lieu: lieu || 'Lyon', places: '12' }
})

export function seed() {
  const base = (o) => ({ organisme: 'Cap Compétences', prepare: 'Camille Laurent', version: 1, created: o.maj, others: [], sess: [], ...o })
  return [
    base({ id: 8, ref: 'FOR-2026-019', title: 'Business Analyst — les fondamentaux en contexte agile', duree: '35', modalite: 'Mixte', statut: 'validee', pub: 'apublier', maj: '2026-10-28', values: {
      public: ['Salariés', "Demandeurs d'emploi", 'Chefs de projet et consultants fonctionnels', 'Personnes en reconversion vers le métier de BA'],
      besoin: "Comprendre et formaliser les besoins métier, puis les traduire en exigences claires pour l'équipe de développement.",
      prerequis: 'Aisance avec les outils bureautiques. Une première expérience en entreprise ou en projet est un plus, mais pas obligatoire.',
      objectifs: "Cadrer un projet (enjeux, périmètre, parties prenantes) ; animer un atelier de recueil des besoins ; modéliser un processus en BPMN ; rédiger des user stories avec critères d'acceptation ; préparer et suivre une recette.",
      modules: [
        { seq: 'Le rôle du BA et le cadrage', modalite: 'Présentiel', supports: 'Note de cadrage type', evalseq: 'Quiz', contenu: 'Missions du BA, parties prenantes, note de cadrage, périmètre', objectif: 'Cadrer un projet (enjeux, périmètre, parties prenantes)', duree: '7', activites: 'Étude de cas, matrice des parties prenantes' },
        { seq: 'Recueillir les besoins', modalite: 'Présentiel', supports: 'Guide d’entretien', evalseq: 'Mise en situation', contenu: 'Entretiens, ateliers, observation, questionnaire ; reformulation', objectif: 'Animer un atelier de recueil des besoins', duree: '7', activites: 'Jeux de rôle : entretien avec un « client »' },
        { seq: 'Modéliser processus et règles', modalite: 'Distanciel synchrone (classe virtuelle)', supports: 'Mémo BPMN', evalseq: 'Exercice', contenu: 'BPMN, règles de gestion, cas d’utilisation, maquettes', objectif: 'Modéliser un processus en BPMN', duree: '7', activites: 'Modélisation sur outil (draw.io / Bizagi)' },
        { seq: 'Le BA dans l’équipe agile', modalite: 'Distanciel synchrone (classe virtuelle)', supports: 'Modèle de user story', evalseq: 'Cas pratique', contenu: 'Scrum, user stories, critères d’acceptation, backlog, refinement, priorisation', objectif: "Rédiger des user stories avec critères d'acceptation", duree: '7', activites: 'Atelier Jira : construire un backlog' },
        { seq: 'Recette et cas fil rouge', modalite: 'Présentiel', supports: 'Cahier de recette type', evalseq: 'Mise en situation', contenu: 'Plan et cas de test, suivi des anomalies, présentation finale', objectif: 'Préparer et suivre une recette', duree: '7', activites: 'Soutenance du cas fil rouge' }],
      methodes: ['Exposés', 'Ateliers', 'Mises en situation', 'Études de cas'], materiel: ['Salle équipée', 'Vidéoprojecteur', 'Logiciels', 'Classe virtuelle'], supports: ['Support de cours', 'Fiches outils', 'Exercices corrigés'],
      formateurs: ['Sarah Benali — Business Analyst senior'],
      assistance_dist: 'support@capcompetences.fr — du lundi au vendredi, 9h–17h — réponse sous 24 h',
      lieu: 'Présentiel : 12 rue des Lilas, 69003 Lyon — Distanciel : Microsoft Teams (lien envoyé 48 h avant)',
      acces: ['Formulaire', 'Entretien préalable'], delai: "15 jours ouvrés entre la demande et l'entrée en formation",
      contact: 'Camille Laurent — formation@capcompetences.fr — 04 72 00 00 00',
      tarif: '2 450', unite: 'Par apprenant', taxe: 'HT', financements: ['CPF', 'OPCO', 'France Travail', 'Entreprise'],
      ref_handicap: 'Yanis Morel', amenagements: ['Supports adaptés', 'Rythme aménagé', 'Formation à distance possible', 'Accompagnement individuel'],
      locaux: 'Locaux accessibles PMR (ascenseur). Supports en gros caractères sur demande. Les vidéos sont sous-titrées.',
      positionnement: ['Questionnaire de positionnement', 'Entretien préalable'],
      eval_pendant: ['Quiz', 'Exercices', 'Cas pratiques'], evaluation: ['QCM', 'Étude de cas', 'Projet', 'Soutenance du dossier BA devant le formateur'],
      criteres: 'Au moins 70 % au QCM final et un dossier BA validé sur la grille de compétences',
      document: 'Certificat de réalisation', satisfaction: ['À chaud (fin de formation)', 'À froid (3 mois après)', "Auprès de l'entreprise"],
      resultats_plan: 'Questionnaire à chaud dès la 1re session (février 2027). Taux de satisfaction et de réussite publiés après 3 sessions.',
    }, others: [{ titre: 'Outils utilisés', contenu: 'Jira, Confluence, draw.io (comptes fournis pendant la formation).' }] }),
    base({ id: 1, ref: 'FOR-2026-018', title: "Management d'équipe — niveau 2", duree: '14', modalite: 'Présentiel', statut: 'incomplete', maj: '2026-10-27', values: clear(fullValues(), ['delai', 'positionnement', 'materiel', 'supports', 'criteres']) }),
    base({ id: 2, ref: 'FOR-2026-017', title: 'Excel avancé', duree: '7', modalite: 'Distanciel', statut: 'validee', pub: 'apublier', maj: '2026-10-25', values: fullValues({ public: ['Salariés'], lieu: 'Classe virtuelle (Teams)' }) }),
    base({ id: 3, ref: 'FOR-2026-012', title: "Management d'équipe — niveau 1", duree: '14', modalite: 'Présentiel', statut: 'validee', pub: 'publiee', sess: mk(3), maj: '2026-10-21', version: 3, values: fullValues(), others: [{ titre: 'Matériel à apporter', contenu: 'Un carnet et un stylo.' }] }),
    base({ id: 4, ref: 'FOR-2026-015', title: 'Sauveteur secouriste du travail (SST)', duree: '14', modalite: 'Présentiel', statut: 'brouillon', maj: '2026-10-15', values: clear(fullValues(), ['objectifs', 'modules', 'delai', 'contact', 'tarif', 'formateurs']) }),
    base({ id: 5, ref: 'FOR-2026-009', title: 'Prise de parole en public', duree: '21', modalite: 'Mixte', statut: 'validee', pub: 'publiee', sess: mk(1), maj: '2026-10-02', version: 2, values: fullValues() }),
    base({ id: 6, ref: 'FOR-2026-014', title: 'Anglais professionnel', duree: '30', modalite: 'Distanciel', statut: 'brouillon', maj: '2026-09-28', values: fullValues() }),
    base({ id: 9, ref: 'FOR-2026-016', title: 'Gestion de projet agile', duree: '21', modalite: 'Distanciel', statut: 'incomplete', pub: 'publiee', sess: mk(1), maj: '2026-10-20', values: clear(fullValues(), ['formateurs', 'tarif', 'financements', 'ref_handicap', 'amenagements', 'locaux', 'satisfaction', 'resultats_mesures', 'resultats_plan']) }),
    base({ id: 7, ref: 'FOR-2025-031', title: 'Bureautique — initiation', duree: '14', modalite: 'Présentiel', statut: 'validee', pub: 'apublier', sess: mk(4), maj: '2026-09-12', values: fullValues() }),
  ]
}
