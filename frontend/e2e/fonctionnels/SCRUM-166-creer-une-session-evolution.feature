# language: fr
@SCRUM-166
Fonctionnalité: SCRUM-166 - Créer une session (évolution)
  En tant que gestionnaire du centre de formation,
  je veux créer une session avec ses dates, son lieu et ses participants,
  afin de planifier la formation et préparer ses envois.

  Les contrôles déjà en place (CA9) sont vérifiés par les scénarios de SCRUM-25.

  Contexte:
    Étant donné que je suis connecté
    Et que j'ai une formation «Management d'équipe» de 21 heures en «Présentiel»
    Et que j'ai une formation «Anglais professionnel» de 14 heures en «Distanciel»
    Et que je suis sur la page «Sessions et planning»

  Scénario: CA2 - La durée et la modalité sont reprises de la formation et restent modifiables
    Lorsque je clique sur «Nouvelle session»
    Et que je choisis «Anglais professionnel» dans le champ «Formation concernée»
    Alors le champ «Durée (en heures)» contient «14»
    Et le champ «Modalité» contient «Distanciel»
    Et le champ «Lien de la classe virtuelle» est affiché
    Et le champ «Lieu» n'est pas affiché
    Lorsque je saisis «10» dans le champ «Durée (en heures)»
    Et que je choisis «Mixte» dans le champ «Modalité»
    Alors le champ «Durée (en heures)» contient «10»
    Et le champ «Lieu» est affiché
    Et le champ «Lien de la classe virtuelle» est affiché

  Scénario: CA5 - La recherche filtre sur le nom, l'entreprise ou l'e-mail
    Étant donné que j'ai ouvert l'étape Apprenants d'une session de 10 places
    Lorsque je recherche «mar»
    Alors seules les personnes contenant «mar» sont affichées
    Et «Camille Martin» est affiché dans la liste
    Et «Hugo Bernard» n'est pas affiché dans la liste
    Lorsque je recherche «acme»
    Alors seules les personnes contenant «acme» sont affichées
    Et «Hugo Bernard» est affiché dans la liste

  Scénario: Chaque personne affiche son entreprise ou « Individuel » et son e-mail
    Étant donné que j'ai ouvert l'étape Apprenants d'une session de 10 places
    Alors la ligne de «Camille Martin» affiche «Acme · camille.martin@acme.fr»

  Scénario: Les personnes cochées remontent en tête, avec le compteur « N sélectionnés »
    Étant donné que j'ai ouvert l'étape Apprenants d'une session de 10 places
    Lorsque je coche «Malik Benali»
    Et que je coche «Inès Robert»
    Alors les personnes cochées sont en tête de la liste dans l'ordre :
      | Malik Benali |
      | Inès Robert  |
    Et je vois «2 sélectionnés»
    Et je vois «2 / 10 places»

  Scénario: CA6 - Trop d'apprenants pour le nombre de places
    Étant donné que j'ai ouvert l'étape Apprenants d'une session de 2 places
    Lorsque je coche «Camille Martin»
    Et que je coche «Hugo Bernard»
    Alors «2 / 2 places» n'est pas affiché en rouge
    Lorsque je coche «Léa Moreau»
    Alors «3 / 2 places» est affiché en rouge
    Et le message «Trop d’apprenants : 3 cochés pour 2 places.» s'affiche
    Lorsque je clique sur «Créer la session»
    Alors aucune session n'est créée
    Lorsque je décoche «Léa Moreau»
    Alors le message «Trop d’apprenants : 3 cochés pour 2 places.» ne s'affiche pas

  Scénario: Un message rappelle où déclarer une personne absente de la liste
    Étant donné que j'ai ouvert l'étape Apprenants d'une session de 10 places
    Alors je vois "Un apprenant ou un formateur absent de la liste ? Déclarez-le dans « Parties prenantes »."

  Scénario: Le message d'erreur disparaît dès que la personne manquante est cochée
    Étant donné que j'ai ouvert l'étape Formateurs d'une session de 10 places
    Lorsque je clique sur «Suivant»
    Alors le message «Une session doit avoir au moins un formateur.» s'affiche
    Lorsque je coche «Sarah Dubois»
    Alors le message «Une session doit avoir au moins un formateur.» ne s'affiche pas

  @fixme
  Scénario: CA8 - Après la création, la fiche session et le plan d'envoi s'ouvrent (en attente de SCRUM-168 et SCRUM-169)
    Étant donné que j'ai ouvert l'étape Apprenants d'une session de 10 places
    Lorsque je coche «Camille Martin»
    Et que je clique sur «Créer la session»
    Alors la fenêtre «Comment voulez-vous préparer les envois de cette session ?» s'ouvre

  Scénario: CA10 - Plus de champs « Heure de début » et « Heure de fin »
    Lorsque je clique sur «Nouvelle session»
    Alors le champ «Heure de début» n'est pas affiché
    Et le champ «Heure de fin» n'est pas affiché

  Scénario: Sans formation, un message invite à en créer une
    Étant donné que je me connecte avec un nouveau compte
    Et que je n'ai aucune formation
    Et que je suis sur la page «Sessions et planning»
    Lorsque je clique sur «Nouvelle session»
    Alors je vois «Aucune formation pour l'instant»
    Et je vois «Créer une formation»
