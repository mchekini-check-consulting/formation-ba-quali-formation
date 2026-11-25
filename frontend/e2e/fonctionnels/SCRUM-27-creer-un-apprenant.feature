# language: fr
@SCRUM-27
Fonctionnalité: SCRUM-27 - Créer un apprenant depuis Sessions et planning (Parties prenantes)
  En tant que gestionnaire du centre de formation,
  je veux créer un apprenant depuis la page Sessions et planning,
  afin de pouvoir ensuite l'ajouter à mes sessions.

  Contexte:
    Étant donné que je suis connecté
    Et que les formateurs et apprenants d'exemple sont enregistrés dans mon centre
    Et que j'ai une formation «Management d'équipe» de 21 heures en «Présentiel»
    Et que je suis sur la page «Sessions et planning»

  Scénario: CA1 - « Parties prenantes » puis « Nouvel apprenant » ouvre le panneau
    Lorsque je clique sur «Parties prenantes»
    Et que je clique sur «Nouvel apprenant»
    Alors la fenêtre «Nouvel apprenant» s'ouvre

  Scénario: CA2 - « Annuler » ferme le panneau sans créer d'apprenant
    Lorsque je clique sur «Parties prenantes»
    Et que je clique sur «Nouvel apprenant»
    Et que je remplis les champs :
      | Prénom | Zoé                    |
      | Nom    | Annule                 |
      | E-mail | zoe.annule@exemple.fr  |
    Et que je clique sur «Annuler»
    Alors la fenêtre «Nouvel apprenant» est fermée
    Et aucun apprenant «zoe.annule@exemple.fr» n'est enregistré

  Scénario: CA3 - Un champ obligatoire vide : l'apprenant n'est pas créé, chaque champ manquant est signalé
    Lorsque je clique sur «Parties prenantes»
    Et que je clique sur «Nouvel apprenant»
    Et que je saisis «Zoé» dans le champ «Prénom»
    Et que je clique sur «Enregistrer»
    Alors le champ «Prénom» n'est pas signalé en erreur
    Et le message «Indiquez le nom.» s'affiche sous le champ «Nom»
    Et le message «Indiquez l'e-mail.» s'affiche sous le champ «E-mail»
    Et la fenêtre «Nouvel apprenant» s'ouvre

  Scénario: CA4 - Un e-mail au mauvais format est refusé
    Lorsque je clique sur «Parties prenantes»
    Et que je clique sur «Nouvel apprenant»
    Et que je remplis les champs :
      | Prénom | Zoé           |
      | Nom    | Format        |
      | E-mail | zoe format@x.fr |
    Et que je clique sur «Enregistrer»
    Alors le message «Format d'e-mail invalide» s'affiche sous le champ «E-mail»
    Et aucun apprenant «zoe format@x.fr» n'est enregistré

  Scénario: CA5 - Champs valides : l'apprenant est enregistré, le panneau se ferme et un message confirme
    Lorsque je clique sur «Parties prenantes»
    Et que je clique sur «Nouvel apprenant»
    Et que je remplis les champs :
      | Prénom | Sophie                  |
      | Nom    | Leroy                   |
      | E-mail | sophie.leroy@exemple.fr |
    Et que je clique sur «Enregistrer»
    Alors la fenêtre «Nouvel apprenant» est fermée
    Et le bandeau de confirmation affiche "L’apprenant « Sophie Leroy » a été créé. Vous pouvez maintenant l’ajouter à une session."
    Et l'apprenant «sophie.leroy@exemple.fr» est enregistré

  Scénario: L'apprenant créé est proposé à l'étape Apprenants de « Nouvelle session »
    Lorsque je clique sur «Parties prenantes»
    Et que je clique sur «Nouvel apprenant»
    Et que je remplis les champs :
      | Prénom | Thomas                  |
      | Nom    | Petit                   |
      | E-mail | thomas.petit@exemple.fr |
    Et que je clique sur «Enregistrer»
    Et que j'ai ouvert l'étape Apprenants d'une session de 10 places
    Alors «Thomas Petit» est affiché dans la liste
    Et la ligne de «Thomas Petit» affiche «Individuel · thomas.petit@exemple.fr»
