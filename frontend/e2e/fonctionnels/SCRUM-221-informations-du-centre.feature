# language: fr
@SCRUM-221
Fonctionnalité: SCRUM-221 - Renseigner les informations du centre à la première connexion
  En tant que gestionnaire du centre de formation,
  je veux renseigner les informations de mon centre dès ma première connexion,
  afin que mes documents soient générés avec les bonnes informations.

  Contexte:
    Étant donné que je viens de créer mon compte

  Scénario: CA1 - Le formulaire s'affiche avec le bandeau vert et l'e-mail grisé
    Alors le formulaire «Première connexion» s'affiche
    Et le bandeau vert affiche «Votre compte a été créé.»
    Et le champ «E-mail» contient mon e-mail et n'est pas modifiable
    Et le menu latéral n'est pas affiché
    Et le formulaire contient, dans l'ordre :
      | Bloc               | Champ                        |
      | Identité du centre | SIRET                        |
      | Identité du centre | Raison sociale               |
      | Identité du centre | Adresse                      |
      | Identité du centre | N° de déclaration d’activité |
      | Identité du centre | Région du NDA                |
      | Identité du centre | Ville de signature           |
      | Gestionnaire       | Prénom                       |
      | Gestionnaire       | Nom                          |
      | Gestionnaire       | E-mail                       |

  Plan du Scénario: CA2 - Tant que le centre n'est pas enregistré, on reste sur le formulaire : <adresse>
    Lorsque j'ouvre l'adresse «<adresse>»
    Alors le formulaire «Première connexion» s'affiche

    Exemples:
      | adresse            |
      | /sessions          |
      | /formations        |
      | /parties-prenantes |
      | /modeles           |
      | /tableau-de-bord   |

  Scénario: CA2 - Quitter sans enregistrer : le formulaire réapparaît à la reconnexion
    Lorsque je clique sur «Se déconnecter»
    Et que je me reconnecte
    Alors le formulaire «Première connexion» s'affiche
    Et je ne vois pas «Votre compte a été créé.»

  Scénario: CA3 - SIRET connu : la raison sociale et l'adresse se remplissent et restent modifiables
    Étant donné que la recherche d'entreprises connaît le SIRET «12345678900012» : «HITECH FORMATION», «12 RUE DES LILAS 75011 PARIS»
    Lorsque je saisis «12345678900012» dans le champ «SIRET»
    Alors le message «Informations trouvées. Vérifiez-les avant d’enregistrer.» s'affiche
    Et le champ «Raison sociale» contient «HITECH FORMATION»
    Et le champ «Adresse» contient «12 RUE DES LILAS 75011 PARIS»
    Et le champ «N° de déclaration» contient «»
    Et le champ «Région du NDA» contient «»
    Lorsque je saisis «HiTech Formation» dans le champ «Raison sociale»
    Alors le champ «Raison sociale» contient «HiTech Formation»

  Scénario: CA4 - SIRET non trouvé : message orange, la saisie manuelle fonctionne
    Lorsque je saisis «12345678900012» dans le champ «SIRET»
    Alors le message «Aucune information trouvée, renseignez les champs ci-dessous.» s'affiche
    Et le champ «Raison sociale» contient «»
    Lorsque je remplis les champs obligatoires pour le centre «HiTech Formation»
    Et que je clique sur «Enregistrer»
    Alors la page «Sessions et planning» s'affiche
    Et je suis le gestionnaire du centre «HiTech Formation»

  Scénario: CA4 - Service de recherche indisponible : même message orange
    Étant donné que la recherche d'entreprises ne répond pas
    Lorsque je saisis «12345678900012» dans le champ «SIRET»
    Alors le message «Aucune information trouvée, renseignez les champs ci-dessous.» s'affiche

  Scénario: CA5 - Champs obligatoires vides et format incorrect : rien n'est enregistré
    Lorsque je saisis «123456789000» dans le champ «SIRET»
    Et que je saisis «12 rue des Lilas, 75011 Paris» dans le champ «Adresse»
    Et que je saisis «Marie» dans le champ «Prénom»
    Et que je clique sur «Enregistrer»
    Alors le bandeau rouge affiche «3 champs sont à corriger. Rien n’a été enregistré.»
    Et le message «Le SIRET doit contenir 14 chiffres» s'affiche sous le champ «SIRET»
    Et le message «La raison sociale est obligatoire» s'affiche sous le champ «Raison sociale»
    Et le message «Le nom est obligatoire» s'affiche sous le champ «Nom»
    Et le champ «Adresse» n'est pas signalé en erreur
    Et aucun centre n'est enregistré
    Et le formulaire «Première connexion» s'affiche

  Scénario: CA5 - N° de déclaration d'activité au mauvais format
    Lorsque je remplis les champs obligatoires pour le centre «HiTech Formation»
    Et que je saisis «117565» dans le champ «N° de déclaration»
    Et que je clique sur «Enregistrer et accéder à Quali-formation»
    Alors le message «Le N° de déclaration d’activité doit contenir 11 chiffres» s'affiche sous le champ «N° de déclaration»
    Et aucun centre n'est enregistré

  Scénario: CA6 - Formulaire valide : je deviens gestionnaire et Sessions et planning s'affiche
    Lorsque je remplis les champs obligatoires pour le centre «HiTech Formation»
    Et que je clique sur «Enregistrer et accéder à Quali-formation»
    Alors la page «Sessions et planning» s'affiche
    Et le bandeau de confirmation affiche "Bienvenue sur Quali-formation !"
    Et je suis le gestionnaire du centre «HiTech Formation»

  Scénario: CA6 - Centre enregistré : le formulaire ne s'affiche plus
    Lorsque je remplis les champs obligatoires pour le centre «HiTech Formation»
    Et que je clique sur «Enregistrer»
    Et que je me déconnecte
    Et que je me reconnecte
    Alors la page «Sessions et planning» s'affiche
    Et le formulaire «Première connexion» ne s'affiche pas
    Lorsque j'ouvre l'adresse «/premiere-connexion»
    Alors la page «Sessions et planning» s'affiche

  Scénario: CA7 - Le bas du menu affiche les initiales et la raison sociale du centre
    Lorsque je remplis les champs obligatoires pour le centre «HiTech Formation»
    Et que je clique sur «Enregistrer»
    Alors le bas du menu affiche la bulle «MA» et «HiTech Formation»

  Scénario: CA7 - Une raison sociale trop longue est coupée avec « … »
    Lorsque je remplis les champs obligatoires pour le centre «HiTech Formation Professionnelle Continue de la Région Île-de-France»
    Et que je clique sur «Enregistrer»
    Alors le bas du menu affiche la bulle «MA» et «HiTech Formation Professionnelle Continue de la Région Île-de-France»
    Et la raison sociale est coupée avec « … »
