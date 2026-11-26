# language: fr
@SCRUM-112
Fonctionnalité: SCRUM-112 - Accéder aux parties prenantes et consulter les apprenants
  En tant que gestionnaire du centre de formation,
  je veux consulter la liste de mes apprenants et en ajouter un nouveau,
  afin de retrouver rapidement un apprenant et savoir à quel titre il se forme.

  Contexte:
    Étant donné que je suis connecté

  Scénario: CA1 - « Parties prenantes » ouvre l'onglet Apprenants, avec les trois onglets et le nombre d'apprenants
    Étant donné que les apprenants suivants sont enregistrés dans mon centre :
      | Prénom  | Nom    | E-mail                    | Téléphone  | Statut      | Entreprise | Poste |
      | Karim   | Benali | karim.benali@exemple.fr   | 0612345678 | Particulier |            |       |
      | Laura   | Petit  | laura.petit@exemple.fr    |            | Indépendant |            |       |
    Et que je suis sur la page «Sessions et planning»
    Lorsque je clique sur l'entrée «Parties prenantes» du menu
    Alors la page «Parties prenantes» s'affiche
    Et les onglets sont, dans l'ordre : «Apprenants», «Formateurs», «Entreprises clientes»
    Et l'onglet «Apprenants» est ouvert
    Et l'onglet «Apprenants» affiche le nombre 2

  Scénario: CA2 - Les apprenants sont triés par nom avec toutes leurs informations, « — » si une information est vide
    Étant donné que les apprenants suivants sont enregistrés dans mon centre :
      | Prénom  | Nom    | E-mail                    | Téléphone  | Statut            | Entreprise     | Poste            |
      | Laura   | Petit  | laura.petit@exemple.fr    |            | Demandeur d’emploi | |                  |
      | Camille | Martin | camille.martin@exemple.fr | 0745213698 | Salarié           | Société Durand | Cheffe de projet |
      | Karim   | Benali | karim.benali@exemple.fr   | 0612345678 | Particulier       |                |                  |
    Lorsque je suis sur la page «Parties prenantes»
    Alors la liste des apprenants affiche, dans l'ordre :
      | Nom            | E-mail                    | Téléphone      | Statut             | Entreprise     | Poste            | Sessions  |
      | Karim Benali   | karim.benali@exemple.fr   | 06 12 34 56 78 | Particulier        | —              |                  | 0 session |
      | Camille Martin | camille.martin@exemple.fr | 07 45 21 36 98 | Salarié            | Société Durand | Cheffe de projet | 0 session |
      | Laura Petit    | laura.petit@exemple.fr    | —              | Demandeur d’emploi | —              |                  | 0 session |

  Scénario: CA3 - La recherche ne garde que les apprenants dont le nom, l'e-mail ou l'entreprise contient le texte
    Étant donné que les apprenants suivants sont enregistrés dans mon centre :
      | Prénom  | Nom    | E-mail                    | Téléphone | Statut      | Entreprise     | Poste |
      | Camille | Martin | camille.martin@exemple.fr |           | Salarié     | Société Durand |       |
      | Hugo    | Weber  | hugo.weber@globex.fr      |           | Salarié     | Société Durand |       |
      | Laura   | Petit  | laura.petit@exemple.fr    |           | Indépendant |                |       |
    Et que je suis sur la page «Parties prenantes»
    Lorsque je tape «durand» dans la recherche des apprenants
    Alors la liste des apprenants ne contient que «Camille Martin», «Hugo Weber»
    Lorsque je tape «globex» dans la recherche des apprenants
    Alors la liste des apprenants ne contient que «Hugo Weber»
    Lorsque je tape «laura petit» dans la recherche des apprenants
    Alors la liste des apprenants ne contient que «Laura Petit»
    Et l'onglet «Apprenants» affiche le nombre 3

  Scénario: CA4 - Aucun apprenant : un message invite à en ajouter un
    Lorsque je suis sur la page «Parties prenantes»
    Alors je vois «Aucun apprenant pour le moment»
    Et je vois "Ajoutez votre premier apprenant avec « + Nouvel apprenant »."
    Et l'onglet «Apprenants» affiche le nombre 0

  Scénario: CA5 - Sans statut ou avec un téléphone qui n'a pas 10 chiffres : rien n'est enregistré, les champs sont signalés
    Étant donné que je suis sur la page «Parties prenantes»
    Lorsque je clique sur «+ Nouvel apprenant»
    Et que je remplis les champs :
      | Prénom    | Sophie                    |
      | Nom       | Lambert                   |
      | E-mail    | sophie.lambert@exemple.fr |
      | Téléphone | 06 11 22 33 4             |
    Et que je clique sur «Enregistrer»
    Alors le message «Le téléphone doit contenir 10 chiffres» s'affiche sous le champ «Téléphone»
    Et le message «Le statut est obligatoire» s'affiche sous le champ «Statut»
    Et la fenêtre «Nouvel apprenant» s'ouvre
    Et aucun apprenant «sophie.lambert@exemple.fr» n'est enregistré

  Scénario: CA6 - Entreprise et Poste n'apparaissent que pour le statut « Salarié »
    Étant donné que je suis sur la page «Parties prenantes»
    Lorsque je clique sur «+ Nouvel apprenant»
    Alors le champ «Entreprise» n'est pas affiché
    Lorsque je choisis «Salarié» dans le champ «Statut»
    Alors le champ «Entreprise» est affiché
    Et le champ «Poste» est affiché
    Et le champ «Entreprise» ne propose aucune entreprise
    Lorsque je choisis «Particulier» dans le champ «Statut»
    Alors le champ «Entreprise» n'est pas affiché
    Et le champ «Poste» n'est pas affiché

  Scénario: CA7 - L'apprenant ajouté apparaît en tête de liste, mis en évidence
    Étant donné que les apprenants suivants sont enregistrés dans mon centre :
      | Prénom | Nom    | E-mail                  | Téléphone | Statut      | Entreprise | Poste |
      | Karim  | Benali | karim.benali@exemple.fr |           | Particulier |            |       |
    Et que je suis sur la page «Parties prenantes»
    Lorsque je clique sur «+ Nouvel apprenant»
    Et que je remplis les champs :
      | Prénom    | Sophie                    |
      | Nom       | Lambert                   |
      | E-mail    | sophie.lambert@exemple.fr |
      | Téléphone | 06 11 22 33 44            |
      | Statut    | Salarié                   |
      | Poste     | Assistante RH             |
    Et que je clique sur «Enregistrer»
    Alors la fenêtre «Nouvel apprenant» est fermée
    Et «Sophie Lambert» est en tête de la liste des apprenants, mis en évidence
    Et l'onglet «Apprenants» affiche le nombre 2
    Et l'apprenant «sophie.lambert@exemple.fr» est enregistré

  Scénario: CA8 - Chaque centre ne voit que ses propres apprenants
    Étant donné qu'un autre centre a enregistré l'apprenant «Léo Ailleurs»
    Et que les apprenants suivants sont enregistrés dans mon centre :
      | Prénom | Nom | E-mail          | Téléphone | Statut      | Entreprise | Poste |
      | Ana    | Ici | ana@exemple.fr  |           | Particulier |            |       |
    Lorsque je suis sur la page «Parties prenantes»
    Alors la liste des apprenants ne contient que «Ana Ici»
    Et je ne vois pas «Léo Ailleurs»
