# formation-ba-quali-formation

Monorepo contenant le backend Django et l'application frontend React

```
backend/                  # API Django + Django REST Framework
  manage.py
  config/                  # configuration du projet (settings, urls)
  quali_formation/         # module Formations : modèles, règles de gestion (services.py), API
frontend/                 # application React (Vite)
  src/formations/          # catalogue des 13 blocs Qualiopi, cartes, assistant, accès aux données
  src/pages/               # tableau de bord, liste, formulaire et fiche des formations
docs/quali-formation-dev/  # brief, maquette validée et règles de gestion (RG01 à RG40), non versionnés
```

## Versions

### Backend

| Composant              | Version |
|-------------------------|---------|
| Python                  | 3.13.12 |
| Django                  | 6.1.1   |
| djangorestframework     | 3.18.1  |

### Frontend

| Composant    | Version |
|--------------|---------|
| Node.js      | 25.8.1  |
| npm          | 11.11.0 |
| React        | 19.2    |
| Vite         | 8.3     |

## Lancer en local

### Base de données (PostgreSQL)

```bash
docker compose up -d
```

PostgreSQL 18 sur `localhost:5432` (base, utilisateur et mot de passe : `backend`).
Le backend l'utilise quand `DATABASE_URL` est défini, sinon il reste sur SQLite.
(`backend/compose.yaml`, ajouté par l'équipe, propose une autre base : `quali_formation`, utilisateur `app`.)

### Backend

```bash
cd backend
python3.13 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export DATABASE_URL=postgresql://backend:backend@localhost:5432/backend   # pour utiliser la base du docker compose
python manage.py migrate
python manage.py charger_demo   # facultatif : les 9 formations d'exemple de la maquette (base vide uniquement)
python manage.py runserver
```

API disponible sur http://localhost:8000/ (`/formations/`, `/sante/`, `/items`…), administration sur http://localhost:8000/admin/.
Sur le cluster, elle est servie par la passerelle : `https://gateway.formation-ba-quali-formation.<env>.check-consulting.net/backend/...`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Disponible sur http://localhost:5173/ (module Formations : http://localhost:5173/formations).
En local, Vite envoie `/api/...` au backend (port 8000) en retirant `/api` ; sur le cluster, `src/api.js` (`apiBase()`) vise la passerelle.
Sans backend, `VITE_DONNEES=demo npm run dev` utilise les données d'exemple gardées dans le navigateur.

### Tests

```bash
cd backend && make lint && make test-unit     # règles de gestion côté serveur
cd frontend && npm run lint && npm test       # écrans et règles côté navigateur
```
