"""Recherche d'une entreprise par son SIRET dans l'API publique « Recherche d'entreprises » de l'État.

Service partagé : utilisé par la première connexion (SCRUM-221, centre de formation, recherche par SIRET) et par la
création d'une entreprise cliente (SCRUM-113, recherche par raison sociale ou SIRET, jusqu'à 10 établissements avec
forme juridique, code NAF, adresse, code postal et ville). Gratuit, sans compte ni clé. L'API ne fournit ni le N° de
déclaration d'activité ni sa région.

Log métier (layer service) à chaque recherche : identifiant de l'utilisateur, SIRET (SCRUM-221) ou nombre
d'établissements trouvés (SCRUM-113 : le texte cherché n'est pas journalisé, il peut être le nom d'une personne),
résultat et durée.
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

LONGUEUR_MIN_RECHERCHE = 3  # SCRUM-113
NOMBRE_MAX_RESULTATS = 10

TROUVEE = 'TROUVEE'
INTROUVABLE = 'INTROUVABLE'


class SiretInvalide(ValueError):
    """Le SIRET ne contient pas 14 chiffres : inutile d'interroger l'API. Refus de la demande (400, log warn)."""

    status_code = 400
    code = 'SIRET_INVALIDE'


class RechercheTropCourte(ValueError):
    """SCRUM-113 : moins de 3 caractères, l'annuaire n'est pas interrogé (400)."""

    status_code = 400
    code = 'RECHERCHE_TROP_COURTE'


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
        donnees = self._appeler({'q': siret, 'page': 1, 'per_page': 1})
        entreprise = _etablissement(donnees, siret)
        return {'statut': TROUVEE if entreprise else INTROUVABLE, 'entreprise': entreprise}


    @log_metier("service", champs=["utilisateur.id", "resultat.statut", "resultat.nombre"])
    def chercher(self, texte, utilisateur=None):
        """SCRUM-113 : jusqu'à 10 établissements dont la raison sociale ou le SIRET correspond à `texte` (3 caractères au
        moins, sinon RechercheTropCourte). → {'statut': 'TROUVEE' | 'INTROUVABLE', 'nombre', 'etablissements': [...]}.
        Un SIRET complet (14 chiffres, espaces ignorés) ne garde que cet établissement."""
        texte = (texte or '').strip()
        if len(texte) < LONGUEUR_MIN_RECHERCHE:
            raise RechercheTropCourte(texte)
        siret = re.sub(r'\s', '', texte)
        siret = siret if re.fullmatch(r'\d{14}', siret) else None
        donnees = self._appeler({'q': siret or texte, 'page': 1, 'per_page': NOMBRE_MAX_RESULTATS})
        etablissements = []
        for entreprise in (donnees if isinstance(donnees, dict) else {}).get('results') or []:
            candidats = [*(entreprise.get('matching_etablissements') or []), entreprise.get('siege') or {}]
            etab = next((e for e in candidats if e.get('siret') and (siret is None or e.get('siret') == siret)), None)
            if etab:
                etablissements.append(_fiche(entreprise, etab))
        etablissements = etablissements[:NOMBRE_MAX_RESULTATS]
        return {'statut': TROUVEE if etablissements else INTROUVABLE, 'nombre': len(etablissements),
                'etablissements': etablissements}

    def _appeler(self, parametres):
        url = os.environ.get('RECHERCHE_ENTREPRISES_URL', URL_PAR_DEFAUT)
        requete = Request(f"{url}?{urlencode(parametres)}",
                          headers={'Accept': 'application/json', 'User-Agent': 'quali-formation'})
        try:
            with self._ouvrir(requete, timeout=DELAI_SECONDES) as reponse:
                return json.load(reponse)
        except (URLError, TimeoutError, OSError, ValueError) as e:
            raise ServiceEntreprisesIndisponible(_code_panne(e)) from e


# Forme juridique : l'API donne le code INSEE de la catégorie juridique (4 chiffres) ; libellés courts des plus courantes
FORMES_JURIDIQUES = {'1000': 'Entrepreneur individuel', '5498': 'EURL', '5499': 'SARL', '5710': 'SAS', '5720': 'SASU',
                     '5202': 'SNC', '6540': 'SCI', '9220': 'Association'}
FORMES_PAR_FAMILLE = {'54': 'SARL', '55': 'SA', '56': 'SA', '57': 'SAS', '65': 'Société civile', '92': 'Association'}


def forme_juridique(code):
    code = str(code or '')
    return FORMES_JURIDIQUES.get(code) or FORMES_PAR_FAMILLE.get(code[:2], '')


def _fiche(entreprise, etab):
    """Champs du panneau « Nouvelle entreprise cliente » pour un établissement de l'annuaire."""
    rue = ' '.join(str(etab.get(k) or '') for k in ('numero_voie', 'indice_repetition', 'type_voie', 'libelle_voie')).split()
    code_postal = etab.get('code_postal') or ''
    ville = etab.get('libelle_commune') or ''
    adresse = ' '.join(rue)
    if not adresse:  # ancienne forme de l'API : adresse complète en une ligne, sans le code postal ni la ville
        adresse = (etab.get('adresse') or '').replace(f'{code_postal} {ville}', '').strip()
    return {
        'siret': etab.get('siret') or '',
        'raison_sociale': entreprise.get('nom_raison_sociale') or entreprise.get('nom_complet') or '',
        'forme_juridique': forme_juridique(entreprise.get('nature_juridique')),
        'code_naf': etab.get('activite_principale') or entreprise.get('activite_principale') or '',
        'adresse': adresse,
        'code_postal': code_postal,
        'ville': ville,
    }


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
