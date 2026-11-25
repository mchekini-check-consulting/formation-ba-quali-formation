# language: fr
@SCRUM-25
Fonctionnalité: SCRUM-25 - Créer une session pour une formation
  En tant que gestionnaire du centre de formation,
  je veux créer une session pour une formation depuis la page Sessions et planning,
  afin de programmer une date de formation et d'y inscrire des participants.

  Comportement à jour de SCRUM-166 : plus d'heures de début ni de fin,
  formulaire dans une pop-up, contrôle du nombre de places.

  Contexte:
    Étant donné que je suis connecté
    Et que les formateurs et apprenants d'exemple sont enregistrés dans mon centre
    Et que j'ai une formation «Management d'équipe» de 21 heures en «Présentiel»
    Et que je suis sur la page «Sessions et planning»

  Scénario: CA1 - « Nouvelle session » ouvre l'étape 1 du formulaire
    Lorsque je clique sur «Nouvelle session»
    Alors la fenêtre «Nouvelle session» s'ouvre
    Et l'étape «Informations» est en cours

  Scénario: CA2 - Un champ obligatoire vide : on reste sur l'étape 1, chaque champ manquant est signalé
    Lorsque je clique sur «Nouvelle session»
    Et que je clique sur «Suivant»
    Alors l'étape «Informations» est en cours
    Et le message «Ce champ est obligatoire.» s'affiche sous le champ «Formation concernée»
    Et le message «Ce champ est obligatoire.» s'affiche sous le champ «Date de début»
    Et le message «Ce champ est obligatoire.» s'affiche sous le champ «Date de fin»
    Et le message «Saisissez une durée supérieure à 0.» s'affiche sous le champ «Durée (en heures)»
    Et le message «Ce champ est obligatoire.» s'affiche sous le champ «Lieu»
    Et le message «Saisissez un nombre entier supérieur à 0.» s'affiche sous le champ «Nombre de places»

  Scénario: CA3 - Une date de fin avant la date de début affiche un message d'erreur
    Lorsque je clique sur «Nouvelle session»
    Et que je remplis les champs :
      | Formation concernée | Management d'équipe |
      | Date de début       | 20/11/2026          |
      | Date de fin         | 18/11/2026          |
      | Lieu                | Lyon, salle 2       |
      | Nombre de places    | 10                  |
    Et que je clique sur «Suivant»
    Alors l'étape «Informations» est en cours
    Et le message «La date de fin doit être postérieure ou égale à la date de début.» s'affiche sous le champ «Date de fin»

  Scénario: CA4 - L'étape 1 complète affiche l'étape 2
    Lorsque je clique sur «Nouvelle session»
    Et que je remplis l'étape Informations avec 10 places
    Et que je clique sur «Suivant»
    Alors l'étape «Formateurs» est en cours
    Et l'étape «Informations» est cochée

  Scénario: CA5 - Un formateur sélectionné : l'étape 3 s'affiche
    Étant donné que j'ai ouvert l'étape Formateurs d'une session de 10 places
    Lorsque je coche «Julien Lefèvre»
    Et que je clique sur «Suivant»
    Alors l'étape «Apprenants» est en cours
    Et l'étape «Formateurs» est cochée

  Scénario: CA6 - Aucun formateur sélectionné : on reste sur l'étape 2 avec un message
    Étant donné que j'ai ouvert l'étape Formateurs d'une session de 10 places
    Lorsque je clique sur «Suivant»
    Alors l'étape «Formateurs» est en cours
    Et le message «Une session doit avoir au moins un formateur.» s'affiche

  Scénario: CA7 - Aucun apprenant sélectionné : la session n'est pas créée
    Étant donné que j'ai ouvert l'étape Apprenants d'une session de 10 places
    Lorsque je clique sur «Créer la session»
    Alors le message «Une session doit avoir au moins un apprenant.» s'affiche
    Et aucune session n'est créée

  Scénario: CA8 - Tout est valide : la session est créée « Prévue » et apparaît dans la liste
    Étant donné que j'ai ouvert l'étape Apprenants d'une session de 10 places
    Lorsque je coche «Camille Martin»
    Et que je coche «Hugo Bernard»
    Et que je clique sur «Créer la session»
    Alors la fenêtre «Nouvelle session» est fermée
    Et le bandeau de confirmation affiche "La session « Management d'équipe » du 18/11/2026 a été créée avec le statut « Prévue »."
    Et la session «Management d'équipe» apparaît dans la liste avec le statut «Prévue»
    Et je vois «2 / 10 apprenants»
