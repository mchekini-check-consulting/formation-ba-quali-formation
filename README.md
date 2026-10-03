# formation-ba-quali-formation

Monorepo contenant le backend Django et l'application frontend React.

```
backend/                  # API Django + Django REST Framework
  manage.py
  config/                  # configuration du projet (settings, urls)
  quali_formation/         # app "Hello World"
frontend/                 # application React (Vite)
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

### Backend

```bash
cd backend
python3.13 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

Disponible sur http://localhost:8000/

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Disponible sur http://localhost:5173/
