# SCRUM-16 · Se connecter à mon compte

> Source : ticket Jira SCRUM-16 (Epic SCRUM-6 « Landing page, création de compte et connexion »), Sprint 1, 3 points, label MVP.
> Maquette : `docs/maquette-se-connecter-a-mon-compte.png` (pièce jointe du ticket : « US 2 · Se connecter (interactif) — CA1 pop-up ouvert »).
> Dépend de : SCRUM-15 (Créer un compte, table `utilisateur`). Renvoie vers : SCRUM-19 (page d'accueil).

## User story

**En tant qu'**utilisateur,
**je veux** me connecter avec mon e-mail et mon mot de passe,
**afin d'**accéder à mon compte.

## Règles de gestion

| N° | Règle | Front | Back |
|---|---|---|---|
| RG-CX-01 | Un clic sur « Se connecter » (landing page) ouvre un pop-up avec deux champs : adresse e-mail et mot de passe. | Pop-up | – |
| RG-CX-02 | Le pop-up contient deux boutons, « Annuler » et « Se connecter », et un lien « Pas encore de compte ? Créer un compte ». | Selon la maquette | – |
| RG-CX-03 | L'e-mail et le mot de passe sont obligatoires. Un champ vide bloque la connexion et est signalé. | Message sous le champ vide | 400 |
| RG-CX-04 | L'e-mail et le mot de passe doivent correspondre à un compte enregistré dans la table `utilisateur` (créé par SCRUM-15). | – | Vérification |
| RG-CX-05 | En cas d'erreur d'identifiants, un message unique s'affiche : « E-mail ou mot de passe incorrect », sans préciser lequel est faux. | Message unique | 401 |
| RG-CX-06 | Connexion réussie → l'utilisateur accède à son compte et la page d'accueil s'affiche (SCRUM-19). Si elle n'existe pas encore dans main, utiliser la même page provisoire que SCRUM-15 et le signaler. | Redirection | 200 |
| RG-CX-07 | « Annuler » ferme le pop-up et laisse la landing page affichée. | Fermeture | – |
| RG-CX-08 | « Créer un compte » ferme ce pop-up et ouvre la création de compte (SCRUM-15). | Bascule | – |

## API

`POST /api/auth/login`

| Code | Cas |
|---|---|
| 200 | Connexion réussie |
| 400 | Champ manquant (RG-CX-03) |
| 401 | E-mail ou mot de passe incorrect (RG-CX-05) |

## Critères d'acceptation

1. **Étant donné que** le visiteur est sur la landing page, **lorsqu'il** clique sur « Se connecter », **alors** un pop-up s'ouvre avec les champs e-mail et mot de passe.
2. **Étant donné que** l'e-mail et le mot de passe sont corrects, **lorsqu'il** clique sur « Se connecter », **alors** il accède à son compte et la page d'accueil s'affiche (SCRUM-19).
3. **Étant donné que** l'e-mail ou le mot de passe est incorrect, **lorsqu'il** clique sur « Se connecter », **alors** l'accès est refusé et le message « E-mail ou mot de passe incorrect » s'affiche.
4. **Étant donné que** l'un des champs est vide, **lorsqu'il** clique sur « Se connecter », **alors** l'accès est refusé et le champ manquant est signalé.
5. **Étant donné que** le pop-up est ouvert, **lorsqu'il** clique sur « Annuler », **alors** le pop-up se ferme et la landing page s'affiche.
6. **Étant donné que** le pop-up est ouvert, **lorsqu'il** clique sur « Créer un compte », **alors** le pop-up de création de compte s'affiche (SCRUM-15).

## Jeux de test (recette)

Prérequis : un compte créé avec SCRUM-15, par exemple `recette@organisme.fr` / `Secret#2026`.

| Cas | E-mail | Mot de passe | Résultat attendu |
|---|---|---|---|
| Ouverture | – | – | Clic « Se connecter » → pop-up avec 2 champs (CA1) |
| Nominal | recette@organisme.fr | Secret#2026 | 200, page d'accueil (CA2) |
| Mauvais mot de passe | recette@organisme.fr | Faux#2026 | 401, « E-mail ou mot de passe incorrect » (CA3) |
| E-mail inconnu | inconnu@organisme.fr | Secret#2026 | 401, même message (CA3) |
| E-mail vide | (vide) | Secret#2026 | 400, champ e-mail signalé (CA4) |
| Mot de passe vide | recette@organisme.fr | (vide) | 400, champ mot de passe signalé (CA4) |
| Annuler | – | – | Pop-up fermé, landing page (CA5) |
| Créer un compte | – | – | Pop-up de création de compte (CA6) |
