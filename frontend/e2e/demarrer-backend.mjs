// Backend des tests end to end : Django sur une base SQLite neuve, dans le dossier temporaire du poste.
// Les données locales (db.sqlite3, base de compose.yaml), dev et qualif ne sont jamais touchées.
// Lancé par playwright.config.js (webServer) : node e2e/demarrer-backend.mjs <port>
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const port = process.argv[2] || '8100'
const dossierBackend = fileURLToPath(new URL('../../backend', import.meta.url))
const base = join(tmpdir(), 'quali-formation-e2e.sqlite3')
// Python du venv du backend s'il existe (skill lancer-en-local), sinon celui du poste (CI)
const venv = join(dossierBackend, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python')
const python = process.env.PYTHON || (existsSync(venv) ? venv : 'python3')
const env = {
  ...process.env,
  DATABASE_URL: `sqlite:///${base.replaceAll('\\', '/')}`,
  DJANGO_SETTINGS_MODULE: 'config.settings_e2e', // contrôle de mot de passe rapide (backend/config/settings_e2e.py)
  LOG_LEVEL: 'warn',
  // Recherche d'entreprises par SIRET (SCRUM-221) : jamais l'API de l'État pendant les tests ; cette adresse fermée
  // donne « Aucune information trouvée ». Les scénarios « SIRET connu » simulent la réponse dans le navigateur.
  RECHERCHE_ENTREPRISES_URL: 'http://127.0.0.1:9/search',
}

// Base vide à chaque lancement, puis création des tables (migrations)
rmSync(base, { force: true })
const migrate = spawnSync(python, ['manage.py', 'migrate', '--noinput'], { cwd: dossierBackend, env, stdio: 'inherit' })
if (migrate.status !== 0) process.exit(migrate.status ?? 1)

const serveur = spawn(python, ['manage.py', 'runserver', '--noreload', port], { cwd: dossierBackend, env, stdio: 'inherit' })
serveur.on('exit', (code) => process.exit(code ?? 0))
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => serveur.kill())
