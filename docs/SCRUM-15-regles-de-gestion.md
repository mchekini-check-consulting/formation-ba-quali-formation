# SCRUM-15 · Créer un compte pour mon organisme de formation

> Source : ticket Jira SCRUM-15 (Epic SCRUM-6 « Landing page, création de compte et connexion »), Sprint 1, 5 points, label MVP.
> Maquette : `docs/maquette-créer-compte.PNG` (pièce jointe du ticket : « US 1 · Créer son compte (interactif) »).

## User story

**En tant que** responsable d'un organisme de formation,
**je veux** créer mon compte avec mon e-mail et un mot de passe,
**afin de** pouvoir accéder à Quali-formation.

## Règles de gestion

| N° | Règle | Front | Back |
|---|---|---|---|
| RG-CC-01 | L'e-mail est obligatoire et doit avoir un format valide. | Message sous le champ | 400 |
| RG-CC-02 | L'e-mail est unique : un e-mail déjà utilisé ne peut pas créer un deuxième compte. La comparaison ignore les majuscules et les espaces autour. | Message « Un compte existe déjà avec cet e-mail » | 409 |
| RG-CC-03 | Le mot de passe est obligatoire et contient au moins 8 caractères. | Indication sous le champ | 400 |
| RG-CC-04 | Le mot de passe contient au moins une majuscule, une minuscule, un chiffre et un caractère spécial. | Indication de chaque critère manquant | 400 |
| RG-CC-05 | La confirmation du mot de passe doit être identique au mot de passe. | Message sous la confirmation | 400 |
| RG-CC-06 | Les conditions générales doivent être acceptées pour valider. | Bouton de validation impossible tant que la case n'est pas cochée | 400 |
| RG-CC-07 | Le compte créé est enregistré dans la table `utilisateur`. Le mot de passe n'est jamais stocké en clair (hachage). | – | – |
| RG-CC-08 | Les autres champs affichés sur la maquette suivent la maquette (libellés, ordre, champs obligatoires signalés). | Selon la maquette | 400 si obligatoire et vide |
| RG-CC-09 | Après une création réussie, l'utilisateur arrive sur la page d'accueil (SCRUM-19). Si elle n'existe pas encore dans main, prévoir une page provisoire et le signaler. | Redirection | 201 |
| RG-CC-10 | En cas d'erreur, rien n'est créé et les valeurs saisies sont conservées (sauf les mots de passe). | Formulaire non vidé | – |

## API

`POST /api/auth/register`

| Code | Cas |
|---|---|
| 201 | Compte créé |
| 400 | Donnée invalide (RG-CC-01, 03, 04, 05, 06, 08) |
| 409 | E-mail déjà utilisé (RG-CC-02) |

## Critères d'acceptation

1. **Étant donné que** les informations saisies sont valides, **lorsque** le visiteur valide, **alors** le compte est créé et la page d'accueil s'affiche (SCRUM-19).
2. **Étant donné que** l'e-mail est déjà utilisé, **lorsque** le visiteur valide, **alors** le compte n'est pas créé et un message l'en informe.
3. **Étant donné que** le mot de passe ne respecte pas les règles ou que la confirmation est différente, **lorsque** le visiteur valide, **alors** le compte n'est pas créé et l'erreur est indiquée.
4. **Étant donné que** les conditions générales ne sont pas acceptées, **lorsque** le visiteur tente de valider, **alors** le compte n'est pas créé.

## Jeux de test (recette)

| Cas | E-mail | Mot de passe | Confirmation | CGU | Résultat attendu |
|---|---|---|---|---|---|
| Nominal | nouveau@organisme.fr | Secret#2026 | Secret#2026 | ✔ | 201, page d'accueil |
| E-mail déjà pris | (même e-mail une 2ᵉ fois) | Secret#2026 | Secret#2026 | ✔ | 409, message |
| E-mail invalide | nouveau@ | Secret#2026 | Secret#2026 | ✔ | 400 |
| Trop court | test@organisme.fr | Se#1 | Se#1 | ✔ | 400 |
| Sans majuscule | test@organisme.fr | secret#2026 | secret#2026 | ✔ | 400 |
| Sans caractère spécial | test@organisme.fr | Secret2026 | Secret2026 | ✔ | 400 |
| Confirmation différente | test@organisme.fr | Secret#2026 | Secret#2027 | ✔ | 400 |
| CGU non cochées | test@organisme.fr | Secret#2026 | Secret#2026 | ✘ | Validation impossible / 400 |
