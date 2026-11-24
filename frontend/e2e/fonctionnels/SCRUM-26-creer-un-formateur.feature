# language: fr
@SCRUM-26
Fonctionnalité: SCRUM-26 - Créer un formateur depuis Sessions et planning (Parties prenantes)
  En tant que gestionnaire du centre de formation,
  je veux créer un formateur depuis la page Sessions et planning,
  afin de pouvoir ensuite l'ajouter à mes sessions.

  Contexte:
    Étant donné que je suis connecté
    Et que j'ai une formation «Management d'équipe» de 21 heures en «Présentiel»
    Et que je suis sur la page «Sessions et planning»

  Scénario: CA1 - « Parties prenantes » puis « Nouveau formateur » ouvre le panneau
    Lorsque je clique sur «Parties prenantes»
    Et que je clique sur «Nouveau formateur»
    Alors la fenêtre «Nouveau formateur» s'ouvre

  Scénario: CA2 - « Annuler » ferme le panneau sans créer de formateur
    Lorsque je clique sur «Parties prenantes»
    Et que je clique sur «Nouveau formateur»
    Et que je remplis les champs :
      | Prénom | Paul                    |
      | Nom    | Annule                  |
      | E-mail | paul.annule@exemple.fr  |
    Et que je clique sur «Annuler»
    Alors la fenêtre «Nouveau formateur» est fermée
    Et aucun formateur «paul.annule@exemple.fr» n'est enregistré

  Scénario: CA3 - Un champ obligatoire vide : le formateur n'est pas créé, chaque champ manquant est signalé
    Lorsque je clique sur «Parties prenantes»
    Et que je clique sur «Nouveau formateur»
    Et que je clique sur «Enregistrer»
    Alors le message «Indiquez le prénom.» s'affiche sous le champ «Prénom»
    Et le message «Indiquez le nom.» s'affiche sous le champ «Nom»
    Et le message «Indiquez l'e-mail.» s'affiche sous le champ «E-mail»
    Et la fenêtre «Nouveau formateur» s'ouvre

  Scénario: CA4 - Un e-mail au mauvais format est refusé
    Lorsque je clique sur «Parties prenantes»
    Et que je clique sur «Nouveau formateur»
    Et que je remplis les champs :
      | Prénom | Paul                  |
      | Nom    | Format                |
      | E-mail | paul.format@exemple   |
    Et que je clique sur «Enregistrer»
    Alors le message «Format d'e-mail invalide» s'affiche sous le champ «E-mail»
    Et aucun formateur «paul.format@exemple» n'est enregistré

  Scénario: CA5 - Champs valides : le formateur est enregistré, le panneau se ferme et un message confirme
    Lorsque je clique sur «Parties prenantes»
    Et que je clique sur «Nouveau formateur»
    Et que je remplis les champs :
      | Prénom | Nadia                  |
      | Nom    | Haddad                 |
      | E-mail | nadia.haddad@exemple.fr |
    Et que je clique sur «Enregistrer»
    Alors la fenêtre «Nouveau formateur» est fermée
    Et le bandeau de confirmation affiche "Le formateur « Nadia Haddad » a été créé. Vous pouvez maintenant l’ajouter à une session."
    Et le formateur «nadia.haddad@exemple.fr» est enregistré

  Scénario: Le formateur créé est proposé à l'étape Formateurs de « Nouvelle session »
    Lorsque je clique sur «Parties prenantes»
    Et que je clique sur «Nouveau formateur»
    Et que je remplis les champs :
      | Prénom | Paul                  |
      | Nom    | Durand                |
      | E-mail | paul.durand@exemple.fr |
    Et que je clique sur «Enregistrer»
    Et que j'ai ouvert l'étape Formateurs d'une session de 10 places
    Alors «Paul Durand» est affiché dans la liste
