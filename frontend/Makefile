# Commandes appelées par la CI (formation-ba-gitops/ci-template) et utilisables en local.
.PHONY: lint test-unit test-integration

lint:
	npm run lint

test-unit:
	npm run test:cov -- --coverage.reporter=lcov   # -> coverage/lcov.info

# Tests end to end : parcours (e2e/*.e2e.js) et tests fonctionnels des US (e2e/fonctionnels/*.feature),
# dans un vrai navigateur, sur l'écran + le backend Django (base SQLite jetable, e2e/demarrer-backend.mjs).
# Sur GitHub (CI=true) : installe d'abord le backend (venv dans ../backend/.venv) et le navigateur Chromium.
test-integration:
	if [ -n "$$CI" ]; then python3 -m venv ../backend/.venv; fi
	if [ -n "$$CI" ]; then ../backend/.venv/bin/pip install --quiet -r ../backend/requirements.txt; fi
	if [ -n "$$CI" ]; then npx playwright install --with-deps chromium; fi
	npm run test:e2e
