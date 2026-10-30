import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // En local, /api/... est envoyé au backend Django (même origine : pas besoin de CORS)
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
  },
  // Tests unitaires (vitest) : DOM simulé par jsdom
  test: {
    environment: 'jsdom',
    coverage: {
      include: ['src/**/*.{js,jsx}'], // pas les css / images importés
    },
  },
})
