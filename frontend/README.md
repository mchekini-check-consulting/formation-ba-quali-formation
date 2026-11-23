# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.

## Tests end to end (Playwright)

Un vrai navigateur refait les parcours des utilisateurs (créer un compte, se connecter, créer une formation,
formations visibles seulement par leur compte) sur l'application complète : écran + backend Django sur une
base SQLite vide, recréée à chaque lancement dans le dossier temporaire du poste (aucune donnée locale, dev ou
qualif touchée). Les ports 5180 et 8100 sont réservés aux tests : l'application lancée en local (5173, 8000)
peut rester ouverte.

```
npx playwright install chromium   # une seule fois : télécharge le navigateur des tests
npm run test:e2e                  # lance backend + écran, puis les tests (dossier e2e/)
npx playwright show-report        # rapport détaillé, avec le film des tests en échec
```

Prérequis : le venv du backend (`backend/.venv`, voir le skill `lancer-en-local`).
