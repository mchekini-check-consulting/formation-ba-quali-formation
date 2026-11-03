// Textes de la landing page, repris de la maquette « Landing page Quali-formation — desktop » (SCRUM-14)

// Adresse ouverte par « Demander un devis » (CA4)
export const EMAIL_CONTACT = 'contact@quali-formation.fr'

// Destination des boutons « Se connecter » et « Essai gratuit ».
// Provisoire pour « Se connecter » : l'écran de connexion fait l'objet d'une autre US ;
// en attendant, ce bouton mène à l'application. Création de compte : SCRUM-15.
export const LIENS = {
  connexion: '/tableau-de-bord',
  inscription: '/creer-un-compte',
}

// Menu du haut : libellé -> section de la page (CA2)
export const MENU = [
  { libelle: 'Fonctionnalités', section: 'fonctionnalites' },
  { libelle: 'Avis clients', section: 'avis' },
  { libelle: 'Tarifs', section: 'tarifs' },
  { libelle: 'FAQ', section: 'faq' },
]

// Mot qui change dans le grand titre
export const MOTS_TITRE = ['formations', 'sessions', 'documents', 'émargements', 'signatures', 'évaluations']

export const ATOUTS = ['Utilisateurs illimités', 'Sans frais de mise en service', 'Sans engagement']

// d = tracé de l'icône (SVG 24 x 24)
export const FONCTIONNALITES = [
  { d: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5', fond: '#F0FDFA', couleur: '#115E59', titre: 'Formations et programmes', texte: "Créez des programmes complets en quelques clics : objectifs, prérequis, modalités… Rien n'est oublié, et vous les réutilisez à l'infini." },
  { d: 'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM3 10h18M8 3v4M16 3v4', fond: '#EFF6FF', couleur: '#1D4ED8', titre: 'Sessions et planning', texte: "Visualisez toutes vos sessions dans un planning clair, évitez les doublons et suivez les places restantes en un coup d'œil." },
  { d: 'M6 3h8l5 5v13H6zM14 3v5h5M9 13h7M9 17h7', fond: '#FFF7ED', couleur: '#C2410C', titre: 'Documents', texte: 'Conventions, convocations, attestations : générées et pré-remplies automatiquement. Fini le copier-coller dans Word.' },
  { d: 'M9 3h6v3H9zM7 4.5H5V21h14V4.5h-2M9 14l2 2 4-4', fond: '#F0F9FF', couleur: '#0369A1', titre: 'Émargement', texte: "Feuilles de présence dématérialisées et horodatées. Vos preuves d'assiduité sont archivées sans effort." },
  { d: 'M3 5h18v11H3zM8 20h8M12 16v4M10 8.5v5l4-2.5z', fond: '#FDF4FF', couleur: '#A21CAF', titre: 'E-learning', texte: 'Intégrez vos modules en ligne à vos parcours et suivez leur réalisation pour proposer du blended learning.' },
  { d: 'M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6zM8.5 12l2.5 2.5 4.5-5', fond: '#F0FDFA', couleur: '#115E59', titre: 'Qualiopi', texte: "Chaque action est rattachée AUTOMATIQUEMENT aux 32 indicateurs : vous savez en temps réel où vous en êtes et arrivez serein à l'audit." },
  { d: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z', fond: '#FEFCE8', couleur: '#A16207', titre: 'Évaluations et satisfaction', texte: 'Questionnaires à chaud et à froid envoyés automatiquement, résultats consolidés et prêts à présenter.' },
  { d: 'M4 20h16M14.5 4.5l5 5L9 20H4v-5z', fond: '#ECFDF5', couleur: '#047857', titre: 'Signature électronique', texte: "Faites signer conventions et contrats à distance en quelques secondes, avec valeur légale. Plus d'impressions ni de scans." },
]

export const ETAPES = [
  { titre: 'Créez votre compte', texte: 'En 2 minutes, sans carte bancaire. Votre essai de 15 jours démarre aussitôt.' },
  { titre: 'Ajoutez vos formations', texte: 'Décrivez vos programmes une fois, réutilisez-les pour toutes vos sessions.' },
  { titre: 'Lancez vos sessions', texte: 'Planifiez, ajoutez formateurs et apprenants : documents et preuves suivent automatiquement.' },
]

export const GARANTIES = [
  { titre: 'Référentiel Qualiopi intégré', texte: 'Les 7 critères et 32 indicateurs guident chaque étape.', fond: '#F0FDFA', couleur: '#134E4A' },
  { titre: 'Conforme RGPD', texte: 'Vos données et celles de vos apprenants restent protégées.', fond: '#ECFDF5', couleur: '#065F46' },
  { titre: 'Support humain et réactif', texte: 'Du lundi au vendredi, de 9h à 18h, par chat, e-mail ou téléphone.', fond: '#FFF7ED', couleur: '#9A3412' },
  { titre: 'Accompagnement au démarrage', texte: 'Une session de prise en main offerte pour bien commencer.', fond: '#F0F9FF', couleur: '#075985' },
]

// Témoignages fictifs de la maquette : à remplacer par de vrais avis clients avant la mise en production
export const TEMOIGNAGES = [
  { citation: "Avant, préparer l'audit nous prenait des semaines. Avec Quali-formation, toutes nos preuves étaient rangées et prêtes en quelques jours.", nom: 'Sophie Martin', role: 'Directrice, Cap Compétences', initiales: 'SM', couleur: '#0F766E' },
  { citation: "La génération automatique des conventions et des attestations a changé notre quotidien. L'équipe a enfin du temps pour la pédagogie.", nom: 'Karim Benali', role: 'Responsable pédagogique, Atelier Pro Formation', initiales: 'KB', couleur: '#2563EB' },
  { citation: 'Simple, clair, et le support répond vite. Je gère mes sessions et mes émargements sans stress, même en déplacement.', nom: 'Julie Lefèvre', role: 'Formatrice indépendante', initiales: 'JL', couleur: '#B45309' },
  { citation: "On a remplacé plusieurs outils et une dizaine de tableurs. Tout est au même endroit et l'équipe s'y est mise en une journée.", nom: 'Thomas Girard', role: 'Gérant, Horizon Langues', initiales: 'TG', couleur: '#7C3AED' },
  { citation: "Les feuilles d'émargement signées en ligne, c'est un vrai soulagement. Plus de papiers perdus ni de relances interminables.", nom: 'Nadia Ouali', role: 'Assistante administrative, Forma Santé Conseil', initiales: 'NO', couleur: '#BE185D' },
  { citation: "Le suivi des indicateurs nous montre tout de suite ce qu'il manque. Notre auditeur a apprécié la clarté de nos preuves.", nom: 'Marc Dubois', role: 'Directeur, Institut Sécurité Pro', initiales: 'MD', couleur: '#0369A1' },
]

export const INCLUS_DANS_CHAQUE_FORMULE = ['Les 8 fonctionnalités', 'Utilisateurs illimités', 'Support inclus']

export const QUESTIONS = [
  { question: "Comment fonctionne l'essai gratuit ?", reponse: 'Vous profitez de toutes les fonctionnalités pendant 15 jours, sans carte bancaire. À la fin, vous choisissez de continuer ou non.' },
  { question: "Que se passe-t-il si je dépasse ma tranche d'apprenants ?", reponse: 'Vous bénéficiez d\'une tolérance de 10 %. Au-delà, vous passez simplement à la formule suivante.' },
  { question: "Les apprenants ont-ils accès à l'application ?", reponse: 'Non. Votre centre gère toutes les inscriptions et ajoute les apprenants dans les sessions.' },
  { question: 'Quali-formation garantit-il la certification Qualiopi ?', reponse: 'La certification est délivrée par un organisme certificateur. Quali-formation vous aide à produire et organiser toutes les preuves demandées.' },
]
