# language: fr
@SCRUM-209
Fonctionnalité: SCRUM-209 - Réorganiser le menu latéral
  En tant que gestionnaire du centre de formation,
  je veux un menu latéral rangé par sections,
  afin de trouver rapidement la bonne rubrique sans tomber sur des pages vides.

  Contexte:
    Étant donné que je suis connecté
    Et que je suis sur la page «Sessions et planning»

  Scénario: CA1 - Le menu correspond à la maquette
    Alors le menu latéral affiche, dans l'ordre :
      | Section   | Entrée                   |
      |           | Tableau de bord          |
      | Organiser | Formations et programmes |
      | Organiser | Sessions et planning     |
      | Organiser | Parties prenantes        |
      | Organiser | E-learning               |
      | Documents | Modèles                  |
      | Documents | Signature électronique   |
      | Qualité   | Qualiopi                 |
    Et le bas du menu affiche «Paramètres» puis «Centre de test»
    Et le menu ne propose pas «Émargement»
    Et le menu ne propose pas «Évaluations et satisfaction»

  Plan du Scénario: CA2 - Une entrée « Bientôt » est grisée et n'ouvre aucune page : <entrée>
    Alors l'entrée «<entrée>» du menu est grisée avec l'étiquette «Bientôt»
    Lorsque je clique sur l'entrée «<entrée>» du menu
    Alors je suis toujours sur la page «Sessions et planning»

    Exemples:
      | entrée                 |
      | E-learning             |
      | Signature électronique |
      | Qualiopi               |

  Plan du Scénario: CA3 - L'entrée de la page en cours est mise en évidence : <entrée>
    Lorsque je clique sur l'entrée «<entrée>» du menu
    Alors la page «<page>» s'affiche
    Et l'entrée «<entrée>» du menu est mise en évidence

    Exemples:
      | entrée                   | page                           |
      | Tableau de bord          | Bienvenue dans Quali-formation |
      | Formations et programmes | Formations                     |
      | Parties prenantes        | Parties prenantes              |
      | Modèles                  | Modèles                        |
      | Paramètres               | Paramètres                     |

  Scénario: CA3 - Sessions et planning est mise en évidence sur sa page
    Alors l'entrée «Sessions et planning» du menu est mise en évidence

  Scénario: La page Parties prenantes liste les apprenants créés (présentation : SCRUM-112)
    Lorsque je clique sur l'entrée «Parties prenantes» du menu
    Et que je clique sur «+ Nouvel apprenant»
    Et que je remplis les champs :
      | Prénom | Zoé                 |
      | Nom    | Roux                |
      | E-mail | zoe.roux@exemple.fr |
      | Statut | Particulier         |
    Et que je clique sur «Enregistrer»
    Alors je vois «zoe.roux@exemple.fr»
    Et l'apprenant «zoe.roux@exemple.fr» est enregistré
