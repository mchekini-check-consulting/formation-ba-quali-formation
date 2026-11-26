import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Appels au backend en local : /api -> backend lancé sur le poste (src/api.js) ;
    // BACKEND_LOCAL : autre backend local, celui des tests end to end (playwright.config.js)
    proxy: {
      '/api': {
        target: process.env.BACKEND_LOCAL || 'http://localhost:8000',
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  // Tests unitaires (vitest) : DOM simulé par jsdom
  test: {
    environment: 'jsdom',
    // Seulement les tests unitaires de src/ : les tests end to end (e2e/) passent par Playwright
    include: ['src/**/*.test.{js,jsx}'],
    // Les tests des écrans Formations utilisent les données de démo (pas besoin du backend)
    env: { VITE_DONNEES: 'demo' },
    // Écrans Formations chargés : les recherches par rôle dépassent les 5 s par défaut sous couverture
    testTimeout: 20000,
    coverage: {
      include: ['src/**/*.{js,jsx}'], // pas les css / images importés
      reporter: ['text', 'html', 'lcov', 'clover', 'json'], // lcov.info lu par SonarQube (sonar-project.properties)
    },
  },
})
