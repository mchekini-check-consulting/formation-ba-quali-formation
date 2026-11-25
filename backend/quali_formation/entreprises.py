"""Recherche d'une entreprise par son SIRET dans l'API publique « Recherche d'entreprises » de l'État.

Service partagé : utilisé par la première connexion (SCRUM-221, centre de formation) et prévu pour la création d'une
entreprise cliente (SCRUM-113). Gratuit, sans compte ni clé. L'API ne fournit ni le N° de déclaration d'activité ni
sa région : seuls la raison sociale et l'adresse sont renvoyées.

Log métier (layer service) à chaque recherche : identifiant de l'utilisateur, SIRET, résultat et durée.
  info  : statut TROUVEE ou INTROUVABLE
  warn  : SIRET_INVALIDE (pas 14 chiffres)
  error : API_HTTP_<code>, DELAI_DEPASSE, API_INJOIGNABLE, REPONSE_ILLISIBLE
"""

import json
import os
import re
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from quali_formation.logging.log_metier import log_metier

# Adresse de l'API, remplaçable par la variable d'environnement RECHERCHE_ENTREPRISES_URL (tests, autre fournisseur)
URL_PAR_DEFAUT = 'https://recherche-entreprises.api.gouv.fr/search'
DELAI_SECONDES = 5

TROUVEE = 'TROUVEE'
INTROUVABLE = 'INTROUVABLE'


class SiretInvalide(ValueError):
    """Le SIRET ne contient pas 14 chiffres : inutile d'interroger l'API. Refus de la demande (400, log warn)."""

    status_code = 400
    code = 'SIRET_INVALIDE'


class ServiceEntreprisesIndisponible(Exception):
    """L'API ne répond pas, trop lentement, ou par une erreur (503, log error). `code` dit pourquoi."""

    status_code = 503

    def __init__(self, code):
        super().__init__(code)
        self.code = code


def normaliser_siret(siret):
    """« 123 456 789 00012 » → « 12345678900012 » ; SiretInvalide si le résultat n'a pas 14 chiffres."""
    siret = re.sub(r'\s', '', siret or '')
    if not re.fullmatch(r'\d{14}', siret):
        raise SiretInvalide(siret)
    return siret


def _code_panne(erreur):
    """Code d'erreur de l'appel à l'API, pour le log (jamais le message, qui peut contenir l'adresse appelée)."""
    if isinstance(erreur, HTTPError):
        return f'API_HTTP_{erreur.code}'
    if isinstance(erreur, TimeoutError) or isinstance(getattr(erreur, 'reason', None), TimeoutError):
        return 'DELAI_DEPASSE'
    if isinstance(erreur, ValueError):  # JSON illisible
        return 'REPONSE_ILLISIBLE'
    return 'API_INJOIGNABLE'


class RechercheEntreprises:
    """rechercher(siret, utilisateur) → {'statut': 'TROUVEE', 'entreprise': {'siret', 'raison_sociale', 'adresse'}}
    ou {'statut': 'INTROUVABLE', 'entreprise': None} si aucun établissement n'a exactement ce SIRET.
    Lève SiretInvalide ou ServiceEntreprisesIndisponible. `utilisateur` : compte qui fait la recherche (logs)."""

    def __init__(self, ouvrir=urlopen):
        self._ouvrir = ouvrir  # remplacé dans les tests unitaires : aucun appel réseau

    @log_metier("service", champs=["utilisateur.id", "siret", "resultat.statut"])
    def rechercher(self, siret, utilisateur=None):
        siret = normaliser_siret(siret)
        url = os.environ.get('RECHERCHE_ENTREPRISES_URL', URL_PAR_DEFAUT)
        requete = Request(f"{url}?{urlencode({'q': siret, 'page': 1, 'per_page': 1})}",
                          headers={'Accept': 'application/json', 'User-Agent': 'quali-formation'})
        try:
            with self._ouvrir(requete, timeout=DELAI_SECONDES) as reponse:
                donnees = json.load(reponse)
        except (URLError, TimeoutError, OSError, ValueError) as e:
            raise ServiceEntreprisesIndisponible(_code_panne(e)) from e
        entreprise = _etablissement(donnees, siret)
        return {'statut': TROUVEE if entreprise else INTROUVABLE, 'entreprise': entreprise}


def _etablissement(donnees, siret):
    # La recherche est plein texte : on ne garde que l'établissement dont le SIRET est exactement celui demandé
    for entreprise in (donnees if isinstance(donnees, dict) else {}).get('results') or []:
        for etab in [*(entreprise.get('matching_etablissements') or []), entreprise.get('siege') or {}]:
            if etab.get('siret') == siret:
                return {
                    'siret': siret,
                    'raison_sociale': entreprise.get('nom_raison_sociale') or entreprise.get('nom_complet') or '',
                    'adresse': etab.get('adresse') or '',
                }
    return None


recherche_entreprises = RechercheEntreprises()
