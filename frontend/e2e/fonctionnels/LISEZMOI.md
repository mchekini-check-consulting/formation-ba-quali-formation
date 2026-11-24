# Tests fonctionnels des US

Un fichier `.feature` par US, écrit en français à partir des critères d'acceptation de Jira.
Chaque phrase est rejouée automatiquement dans un vrai navigateur (Chromium), sur l'application
complète (écran + backend, avec une base vide créée pour l'occasion : dev et qualif ne sont jamais touchés).

| Fichier | US |
|---|---|
| `SCRUM-25-creer-une-session.feature` | Créer une session pour une formation |
| `SCRUM-166-creer-une-session-evolution.feature` | Créer une session (évolution, maquettes) |
| `SCRUM-26-creer-un-formateur.feature` | Créer un formateur (Parties prenantes) |
| `SCRUM-27-creer-un-apprenant.feature` | Créer un apprenant (Parties prenantes) |
| `SCRUM-209-reorganiser-le-menu-lateral.feature` | Réorganiser le menu latéral |

## Quand ils tournent

- **Sur GitHub, à chaque demande de fusion (PR)** qui touche le dossier `frontend/` : étape
  « integration-test (frontend) ». Un scénario en échec bloque la mise en ligne.
- **Sur le poste**, à la demande : « lance les tests fonctionnels » (commande `npm run test:fonctionnels`
  dans `frontend/`). Rapport détaillé, avec une capture d'écran de chaque échec : `npx playwright show-report`.

## Écrire un scénario

```gherkin
# language: fr
@SCRUM-27
Fonctionnalité: SCRUM-27 - Créer un apprenant

  Contexte:
    Étant donné que je suis connecté
    Et que je suis sur la page «Sessions et planning»

  Scénario: CA4 - Un e-mail au mauvais format est refusé
    Lorsque je clique sur «Parties prenantes»
    Et que je clique sur «Nouvel apprenant»
    Et que je saisis «zoe@x» dans le champ «E-mail»
    Et que je clique sur «Enregistrer»
    Alors le message «Format d'e-mail invalide» s'affiche sous le champ «E-mail»
```

- Les textes variables vont entre « » (ou entre "…" s'ils contiennent eux-mêmes des « »).
- Mots-clés : `Étant donné que` (situation de départ), `Lorsque` (action), `Alors` (résultat attendu),
  `Et que` / `Et` (suite), `Contexte` (début commun à tous les scénarios du fichier).
- `Plan du Scénario` + `Exemples` : le même scénario rejoué pour chaque ligne du tableau (`<colonne>` dans les phrases).
- `@fixme` au-dessus d'un scénario : il est écrit mais mis de côté (fonctionnalité pas encore livrée).
- Une phrase inconnue est signalée avant même d'ouvrir le navigateur : il faut alors lui ajouter une
  définition dans `etapes/` (le demander à Claude : « ajoute la phrase … aux tests fonctionnels »).

## Phrases disponibles

**Situation de départ**
- `je suis connecté` · `je me connecte avec un nouveau compte` · `je n'ai aucune formation`
- `j'ai une formation «Intitulé» de 21 heures en «Présentiel»` (Présentiel, Distanciel ou Mixte)
- `je suis sur la page «Sessions et planning»` (ou «Formations», «Parties prenantes»)
- `j'ai ouvert l'étape Formateurs d'une session de 10 places` · `j'ai ouvert l'étape Apprenants d'une session de 10 places`

**Actions**
- `je clique sur «Texte du bouton, du lien ou du choix de menu»`
- `je saisis «valeur» dans le champ «Libellé»` (dates au format 18/11/2026)
- `je choisis «valeur» dans le champ «Libellé»` (liste déroulante)
- `je remplis les champs :` suivi d'un tableau `| Libellé | valeur |`
- `je remplis l'étape Informations avec 10 places`
- `je coche «Prénom Nom»` · `je décoche «Prénom Nom»` · `je recherche «texte»`
- `je clique sur l'entrée «Libellé» du menu` (menu latéral, Paramètres compris, même une entrée « Bientôt »)

**Résultats attendus**
- `la fenêtre «Titre» s'ouvre` · `la fenêtre «Titre» est fermée`
- `l'étape «Informations» est en cours` · `l'étape «Informations» est cochée`
- `le champ «Libellé» est signalé en erreur` · `… n'est pas signalé en erreur` · `… contient «valeur»`
- `le champ «Libellé» est affiché` · `le champ «Libellé» n'est pas affiché`
- `le message «Texte» s'affiche sous le champ «Libellé»`
- `le message «Texte» s'affiche` · `le message «Texte» ne s'affiche pas`
- `je vois «Texte»` · `je ne vois pas «Texte»` · `«Texte» est affiché en rouge` · `… n'est pas affiché en rouge`
- `le bandeau de confirmation affiche "Texte"`
- `«Prénom Nom» est affiché dans la liste` · `… n'est pas affiché dans la liste`
- `la ligne de «Prénom Nom» affiche «Texte»` · `seules les personnes contenant «texte» sont affichées`
- `les personnes cochées sont en tête de la liste dans l'ordre :` suivi d'un tableau de noms
- `la session «Intitulé» apparaît dans la liste avec le statut «Prévue»` · `aucune session n'est créée`
- `le menu latéral affiche, dans l'ordre :` suivi d'un tableau `| Section | Entrée |` (section vide = hors section)
- `le bas du menu affiche «Paramètres» puis «Mon compte»` · `le menu ne propose pas «Libellé»`
- `l'entrée «Libellé» du menu est grisée avec l'étiquette «Bientôt»` · `l'entrée «Libellé» du menu est mise en évidence`
- `la page «Titre» s'affiche` · `je suis toujours sur la page «Titre»`
- `le formateur «e-mail» est enregistré` · `aucun apprenant «e-mail» n'est enregistré` (formateur ou apprenant)
