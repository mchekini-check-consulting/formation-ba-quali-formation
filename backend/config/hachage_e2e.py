"""Hachage des mots de passe du backend des tests end to end (settings_e2e.py) uniquement : PBKDF2, comme en
ligne, avec moins d'itérations pour que les connexions simultanées des tests ne s'attendent pas."""

from django.contrib.auth.hashers import PBKDF2PasswordHasher


class HachageRapideTests(PBKDF2PasswordHasher):
    algorithm = 'pbkdf2_sha256_tests'
    iterations = 10_000
