import { defineConfig, devices } from '@playwright/test'

// Tests end to end (npm run test:e2e) : un vrai navigateur (Chromium) refait les parcours des utilisateurs
// sur l'application complète lancée sur le poste — écran (serveur de dev) + backend Django sur une base vide.
// Parcours écrits en code : e2e/*.e2e.js et e2e/modeles/*.e2e.js.
// Ports à part (5180 et 8100) : les tests tournent même si l'application est déjà lancée en local (5173 et 8000).
const PORT_ECRAN = 5180
const PORT_BACKEND = 8100

export default defineConfig({
  // Une seule base pour tous les tests : chacun crée ses propres comptes (e-mails uniques)
  fullyParallel: true,
  workers: 2,
  retries: process.env.CI ? 1 : 0,
  // Connexion et création de compte : le contrôle du mot de passe prend 2 à 3 s côté backend
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never' }]], // rapport détaillé : npx playwright show-report
  use: {
    baseURL: `http://localhost:${PORT_ECRAN}`,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    trace: 'retain-on-failure', // en cas d'échec : film de chaque étape dans le rapport
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'parcours', testDir: './e2e', testMatch: '**/*.e2e.js', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: [
    {
      command: `node e2e/demarrer-backend.mjs ${PORT_BACKEND}`,
      url: `http://localhost:${PORT_BACKEND}/sante/`,
      reuseExistingServer: false, // toujours une base neuve
      timeout: 120_000,
    },
    {
      command: `npx vite --port ${PORT_ECRAN} --strictPort`,
      url: `http://localhost:${PORT_ECRAN}`,
      reuseExistingServer: false,
      timeout: 120_000,
      // Relais /api du serveur de dev vers le backend des tests (vite.config.js)
      env: { BACKEND_LOCAL: `http://localhost:${PORT_BACKEND}` },
    },
  ],
})
