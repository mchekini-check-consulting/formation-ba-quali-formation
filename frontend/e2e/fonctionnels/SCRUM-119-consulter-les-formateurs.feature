# language: fr
@SCRUM-119
Fonctionnalité: SCRUM-119 - Consulter les formateurs
  En tant que gestionnaire du centre de formation,
  je veux consulter la liste de mes formateurs et en ajouter un avec son statut et ses documents,
  afin de retrouver rapidement un formateur et disposer de ses justificatifs.

  Contexte:
    Étant donné que je suis connecté

  Scénario: CA1 - Les formateurs sont triés par nom, avec leur e-mail et leur nombre de sessions
    Étant donné que les formateurs suivants sont enregistrés dans mon centre :
      | Prénom | Nom     | E-mail                    | Sessions |
      | Thomas | Robert  | thomas.robert@exemple.fr  | 2        |
      | Nadia  | Haddad  | nadia.haddad@exemple.fr   | 3        |
      | Julien | Lefèvre | julien.lefevre@exemple.fr | 1        |
      | Sarah  | Morel   | sarah.morel@exemple.fr    | 0        |
    Et que je suis sur la page «Parties prenantes»
    Lorsque j'ouvre l'onglet «Formateurs»
    Alors l'onglet «Formateurs» est ouvert
    Et la carte affiche «Formateurs · 4»
    Et la liste des formateurs affiche, dans l'ordre :
      | Nom            | E-mail                    | Sessions   |
      | Nadia Haddad   | nadia.haddad@exemple.fr   | 3 sessions |
      | Julien Lefèvre | julien.lefevre@exemple.fr | 1 session  |
      | Sarah Morel    | sarah.morel@exemple.fr    | 0 session  |
      | Thomas Robert  | thomas.robert@exemple.fr  | 2 sessions |

  Scénario: CA2 - La recherche ne garde que les formateurs dont le nom ou l'e-mail contient le texte
    Étant donné que les formateurs suivants sont enregistrés dans mon centre :
      | Prénom | Nom     | E-mail                    |
      | Nadia  | Haddad  | nadia.haddad@exemple.fr   |
      | Sarah  | Morel   | sarah.morel@exemple.fr    |
      | Thomas | Robert  | t.robert@globex.fr        |
    Et que je suis sur la page «Parties prenantes»
    Et que j'ouvre l'onglet «Formateurs»
    Lorsque je tape «morel» dans la recherche des formateurs
    Alors la liste des formateurs ne contient que «Sarah Morel»
    Lorsque je tape «globex» dans la recherche des formateurs
    Alors la liste des formateurs ne contient que «Thomas Robert»
    Et la carte affiche «Formateurs · 3»

  Scénario: CA3 - Aucun formateur : un message invite à en ajouter un
    Étant donné que je suis sur la page «Parties prenantes»
    Lorsque j'ouvre l'onglet «Formateurs»
    Alors je vois «Aucun formateur pour le moment»
    Et je vois "Ajoutez votre premier formateur avec « + Nouveau formateur »."
    Et la carte affiche «Formateurs · 0»

  Scénario: CA4 - Le NDA n'apparaît que pour « Sous-traitant »
    Étant donné que je suis sur la page «Parties prenantes»
    Et que j'ouvre l'onglet «Formateurs»
    Lorsque je clique sur «+ Nouveau formateur»
    Alors le champ «N° de déclaration» n'est pas affiché
    Lorsque je choisis le statut «Sous-traitant»
    Alors le champ «N° de déclaration» est affiché
    Lorsque je choisis le statut «Salarié»
    Alors le champ «N° de déclaration» n'est pas affiché

  Scénario: CA5 - Un NDA qui n'a pas 11 chiffres : rien n'est enregistré, le champ est signalé
    Étant donné que je suis sur la page «Parties prenantes»
    Et que j'ouvre l'onglet «Formateurs»
    Lorsque je clique sur «+ Nouveau formateur»
    Et que je remplis les champs :
      | Prénom | Marc                    |
      | Nom    | Garnier                 |
      | E-mail | marc.garnier@exemple.fr |
    Et que je choisis le statut «Sous-traitant»
    Et que je saisis «1175654321» dans le champ «N° de déclaration»
    Et que je clique sur «Enregistrer»
    Alors le message «Le NDA doit contenir 11 chiffres» s'affiche sous le champ «N° de déclaration»
    Et la fenêtre «Nouveau formateur» s'ouvre
    Et aucun formateur «marc.garnier@exemple.fr» n'est enregistré

  Scénario: CA6 - Un fichier d'un autre format, de plus de 10 Mo ou un 6e diplôme est refusé avec un message
    Étant donné que je suis sur la page «Parties prenantes»
    Et que j'ouvre l'onglet «Formateurs»
    Lorsque je clique sur «+ Nouveau formateur»
    Et que j'importe «CV_complet.zip» dans «CV»
    Alors le refus "« CV_complet.zip » refusé : format non accepté (PDF, JPG, PNG ou Word)" s'affiche sous «CV»
    Lorsque j'importe «CV_scan.pdf» de 11 Mo dans «CV»
    Alors le refus "« CV_scan.pdf » refusé : plus de 10 Mo" s'affiche sous «CV»
    Lorsque j'importe dans Diplômes : «Master.pdf», «Titre.jpg», «Licence.png», «Certificat.doc», «CACES.docx»
    Et que j'importe «Habilitation.pdf» dans «Diplômes»
    Alors le refus "« Habilitation.pdf » refusé : 5 diplômes maximum" s'affiche sous «Diplômes»
    Et Diplômes contient «Master.pdf», «Titre.jpg», «Licence.png», «Certificat.doc», «CACES.docx»

  Scénario: CA7 - Le formateur enregistré avec statut, NDA, CV et diplômes apparaît en tête de liste, mis en évidence
    Étant donné que les formateurs suivants sont enregistrés dans mon centre :
      | Prénom | Nom    | E-mail                  |
      | Nadia  | Haddad | nadia.haddad@exemple.fr |
    Et que je suis sur la page «Parties prenantes»
    Et que j'ouvre l'onglet «Formateurs»
    Lorsque je clique sur «+ Nouveau formateur»
    Et que je remplis les champs :
      | Prénom | Marc                    |
      | Nom    | Garnier                 |
      | E-mail | marc.garnier@exemple.fr |
    Et que je choisis le statut «Sous-traitant»
    Et que je saisis «11756543210» dans le champ «N° de déclaration»
    Et que j'importe «CV_Marc_Garnier.pdf» dans «CV»
    Et que j'importe dans Diplômes : «Master_Management.pdf», «Titre_Formateur_FPA.jpg», «Brouillon.png»
    Et que je retire «Brouillon.png»
    Et que je clique sur «Enregistrer»
    Alors la fenêtre «Nouveau formateur» est fermée
    Et «Marc Garnier» est en tête de la liste des formateurs, mis en évidence
    Et la carte affiche «Formateurs · 2»
    Et le formateur «marc.garnier@exemple.fr» est enregistré en «Sous-traitant» avec le NDA «11756543210»
    Et les documents enregistrés sont : «CV_Marc_Garnier.pdf» (CV), «Master_Management.pdf» (DIPLOME), «Titre_Formateur_FPA.jpg» (DIPLOME)

  Scénario: « Annuler » n'enregistre ni le formateur ni ses fichiers
    Étant donné que je suis sur la page «Parties prenantes»
    Et que j'ouvre l'onglet «Formateurs»
    Lorsque je clique sur «+ Nouveau formateur»
    Et que je remplis les champs :
      | Prénom | Paul                   |
      | Nom    | Annule                 |
      | E-mail | paul.annule@exemple.fr |
    Et que j'importe «CV_Paul.pdf» dans «CV»
    Et que je clique sur «Annuler»
    Alors la fenêtre «Nouveau formateur» est fermée
    Et aucun formateur «paul.annule@exemple.fr» n'est enregistré
    Et aucun document n'est envoyé

  Scénario: CA8 - Chaque centre ne voit que ses propres formateurs
    Étant donné qu'un autre centre a enregistré le formateur «Léo Ailleurs»
    Et que les formateurs suivants sont enregistrés dans mon centre :
      | Prénom | Nom | E-mail         |
      | Ana    | Ici | ana@exemple.fr |
    Et que je suis sur la page «Parties prenantes»
    Lorsque j'ouvre l'onglet «Formateurs»
    Alors la liste des formateurs ne contient que «Ana Ici»
    Et je ne vois pas «Léo Ailleurs»
