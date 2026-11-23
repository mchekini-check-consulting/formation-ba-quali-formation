"""Réglages du backend des tests end to end (frontend/e2e, npm run test:e2e) : ceux de settings.py, adaptés à
plusieurs tests qui tournent en même temps. Jamais utilisé en dev, qualif, preprod ni prod."""

from config import settings as base

# Tous les réglages de settings.py (noms en majuscules), puis les adaptations ci-dessous
globals().update({nom: valeur for nom, valeur in vars(base).items() if nom.isupper()})

# Contrôle de mot de passe rapide : même algorithme qu'en ligne (PBKDF2), avec moins d'itérations. Le hachage
# normal (volontairement lent, 2 à 3 s par connexion) fait attendre les tests qui se connectent en même temps
PASSWORD_HASHERS = ['config.hachage_e2e.HachageRapideTests']

# Base SQLite des tests : deux enregistrements simultanés attendent leur tour au lieu d'échouer
# (« database is locked » ; PostgreSQL, utilisé en ligne, n'a pas cette limite)
DATABASES = base.DATABASES
if DATABASES['default']['ENGINE'] == 'django.db.backends.sqlite3':
    DATABASES['default']['OPTIONS'] = {'timeout': 20, 'transaction_mode': 'IMMEDIATE'}
