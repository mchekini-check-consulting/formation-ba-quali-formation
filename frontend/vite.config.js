import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Appels au backend en local : /api -> backend lancé sur le poste (src/api.js)
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  // Tests unitaires (vitest) : DOM simulé par jsdom
  test: {
    environment: 'jsdom',
    // Les tests des écrans Formations utilisent les données de démo (pas besoin du backend)
    env: { VITE_DONNEES: 'demo' },
    coverage: {
      include: ['src/**/*.{js,jsx}'], // pas les css / images importés
    },
  },
})
