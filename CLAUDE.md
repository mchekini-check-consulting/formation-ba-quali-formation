# formation-ba-quali-formation

Dépôt d'un prototype développé par des Business Analysts (BA) en formation,
sans connaissance du développement ni de git. Expliquer en langage simple,
ne jamais faire d'action git risquée (rebase, push forcé, `reset --hard`,
suppression de branche) et passer par les skills de `.claude/skills/`
(README) pour les gestes courants : nouvelle fonctionnalité, nouveau backend,
modèle de données, appel d'un backend depuis le frontend, lancement local,
déploiement, vérification du déploiement.

## Architecture

| Composant | Dossier | Stack | Port dans l'image | En local |
|---|---|---|---|---|
| backend(s) `type: backend` | `<name>/` (ex. `backend/`) | Python 3.13 / Django / gunicorn | 8000 | `python manage.py runserver <port>` (après `python manage.py migrate`), port 8000 pour `backend/`, suivant pour les autres |
| gateway `type: gateway` | — (fourni par la plateforme) | Traefik, routes dans `gateway.yaml` | 80 | pas de gateway : relais du serveur de dev du frontend |
| frontend `type: frontend` | `frontend/` | React / Vite | 8080 | http://localhost:5173 (`npm run dev`) |

URLs, identiques dans les 4 environnements (`dev`, `qualif`, `preprod`, `prod`) :
- écran : `https://frontend.formation-ba-quali-formation.<env>.check-consulting.net`
- backends : `https://gateway.formation-ba-quali-formation.<env>.check-consulting.net/<backend>/...`
  (préfixe retiré par le gateway). Un backend n'a jamais d'adresse publique
  propre ; le navigateur n'appelle que le gateway.

Déploiement : merge sur `main` → CI (image taguée avec le sha court) → Kargo
écrit `tag.dev` dans `helm.yaml` (commit `promote(dev)` sur `main`) → ArgoCD.
Qualif : clic « Promote » dans Kargo. `main` avance donc tout seul : toujours
l'intégrer dans la branche avant d'envoyer (skill `deploy`).

## Conventions

**Backend**
- Couches : contrôleur (HTTP) → service (règles métier) → accès aux données.
- Logs : une ligne JSON par log sur stdout, niveau `LOG_LEVEL`, champ `layer`
  = `controller` / `service` / `db` sur les logs métier (seuls collectés dans
  le dashboard Grafana « Logs métier »). Plomberie : `backend/quali_formation/logging/` (formatter JSON, middleware, `loggable`, requêtes lentes).
  Couche service : décorateur de classe `@loggable` (`quali_formation/logging/loggable.py`), sur chaque nouvelle classe de service. Jamais de données
  personnelles, d'arguments, de corps de requête ni de paramètres SQL dans
  les logs.
- Base PostgreSQL : variables injectées par la plateforme (`DATABASE_URL`,
  `SPRING_DATASOURCE_*`, `PG*`) ; valeurs locales par défaut = `compose.yaml`
  du composant.
- Schéma : uniquement par migrations — générées par `python manage.py makemigrations <application>` dans `<application>/migrations/`, appliquées au démarrage (`gunicorn.conf.py`). Ne jamais modifier une
  migration déjà sur `main`.

**Frontend**
- Adresse d'un backend : `apiBase(...)` dans `frontend/src/api.js`, calculée depuis
  l'adresse de la page. Elle vise encore `/backend` en dur : pour appeler un autre backend, la généraliser en `apiBase('<backend>')` (skill `appeler-un-backend`). Jamais d'URL, d'environnement,
  de `localhost` ou de nom de dépôt écrits en dur.
- En local, `/api/<backend>` est relayé vers le backend du poste par
  `frontend/vite.config.js` (`server.proxy`) : une entrée par backend.

**`helm.yaml`** (lu par la plateforme)
- Nouvelle application **à la fin** de `applications:` (Kargo repère les
  applications par leur position).
- `tag` en bloc, une valeur par ligne, sans commentaire en fin de ligne ;
  jamais modifié à la main (écrit par Kargo). Tag vide = composant pas encore
  déployé dans cet environnement (normal après un ajout).
- Valeurs littérales uniquement ; `replicas`, `tag`, `envList[].value` :
  valeur unique ou map par environnement.

**`gateway.yaml`**
- Il fige le routage : chaque backend y a un router `PathPrefix(`/<backend>`)`,
  un middleware `<backend>-strip`, un service `http://<backend>:80`, et le
  middleware `cors` commun (origines = frontends du projet, jamais `*`).
- `{{ .project }}`, `{{ .env }}`, `{{ .domain }}` disponibles : une seule
  configuration pour les 4 environnements.

**Qualité** (mêmes contrôles qu'en CI, `pr.yaml`)
- Chaque composant : `make lint`, `make test-unit`, `make test-integration`.
- Couverture ≥ 80 % (quality gate SonarQube) ; rapport local : `.coverage` (`coverage report --fail-under=80`)
  pour le backend, `lcov.info` sous `frontend/coverage/` pour le frontend.
- Tout nouveau code arrive avec ses tests unitaires.

**Git**
- Une fonctionnalité = une branche `feature/<nom>` partie d'un `main` à jour.
- Commits au nom du BA seul : jamais de ligne `Co-Authored-By: Claude`.
- Jamais de secrets, `.env`, bases locales ni gros fichiers dans un commit.
