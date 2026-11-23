"""Réglages du backend des tests end to end (frontend/e2e, npm run test:e2e) : ceux de settings.py, adaptés à
plusieurs tests qui tournent en même temps. Jamais utilisé en dev, qualif, preprod ni prod."""

from config.settings import *

# Contrôle de mot de passe rapide : le hachage normal (volontairement lent, 2 à 3 s par connexion) fait
# attendre les tests qui se connectent en même temps
PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']

# Base SQLite des tests : deux enregistrements simultanés attendent leur tour au lieu d'échouer
# (« database is locked » ; PostgreSQL, utilisé en ligne, n'a pas cette limite)
if DATABASES['default']['ENGINE'] == 'django.db.backends.sqlite3':
    DATABASES['default']['OPTIONS'] = {'timeout': 20, 'transaction_mode': 'IMMEDIATE'}
