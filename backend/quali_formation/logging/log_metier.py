"""Logs métier activés action par action (skill logs-metier) : seules les fonctions décorées par @log_metier
écrivent une ligne. Champs obligatoires de la plateforme (mêmes noms que middleware.py et loggable.py) :
  controller : layer, httpMethod, route (modèle, jamais ses valeurs), status, durationMs
  service/db : layer, class, method, durationMs, error (+ errorCode métier) en cas d'échec
puis les champs métier approuvés par le BA (champs.py). Racines des chemins : les noms des paramètres de la
fonction et "resultat" ; pour une vue : "request" (ex. request.data.action), les paramètres de l'adresse
(ex. pk) et "resultat" (corps de la réponse).

    @log_metier("service", champs=["action", "resultat.statut"])
    def enregistrer(self, formation, donnees, action): ...

Vue : sous @api_view et au-dessus de @_connexion_requise (les refus 401 sont aussi écrits).
"""

import functools
import inspect
import logging
import time

from django.core.exceptions import PermissionDenied
from django.http import Http404, HttpRequest
from rest_framework.request import Request

from quali_formation.logging.champs import RESULTAT, extraire, verifier
from quali_formation.logging.loggable import error_fields
from quali_formation.logging.middleware import DEJA_ECRIT

logger = logging.getLogger("quali_formation.metier")

# Au-delà, un appel db est écrit en warn (visible même avec LOG_LEVEL=warn)
SEUIL_DB_LENT_MS = 200
_COUCHES = {"controller", "service", "db"}
REQUETE = "request"


def _statut_erreur(exc: Exception) -> int:
    """Code HTTP que Django ou DRF renverra pour cette exception levée par une vue."""
    if isinstance(exc, Http404):
        return 404
    if isinstance(exc, PermissionDenied):
        return 403
    return getattr(exc, "status_code", 500)


def _niveau(statut: int):
    # Mêmes niveaux que middleware.py et loggable.py : refus métier (4xx) en warn, panne (5xx) en error
    if statut >= 500:
        return logger.error
    return logger.warning if statut >= 400 else logger.info


def log_metier(couche: str, champs=()):
    if couche not in _COUCHES:
        raise ValueError(f"couche inconnue : {couche} (controller, service ou db)")

    def decorer(fonction):
        signature = inspect.signature(fonction)
        verifier(fonction.__qualname__, champs, [*signature.parameters, RESULTAT])
        classe, _, methode = fonction.__qualname__.rpartition(".")

        def racines(args, kwargs):
            if couche == "controller":
                # Vue : la requête (1er argument) et les paramètres de l'adresse (kwargs de Django)
                return {REQUETE: args[0] if args else None, **kwargs}
            return dict(signature.bind_partial(*args, **kwargs).arguments)

        def ecrire(debut, valeurs, resultat=None, exc=None):
            duree = round((time.monotonic() - debut) * 1000)
            if couche == "controller":
                _ecrire_vue(duree, valeurs, resultat, exc)
                return
            ligne = {"layer": couche, "class": classe, "method": methode, "durationMs": duree,
                     **extraire(champs, {**valeurs, RESULTAT: resultat})}
            if exc is not None:
                _niveau(_statut_erreur(exc))(f"{fonction.__qualname__} en échec", extra={**ligne, **error_fields(exc)})
            elif couche == "db" and duree >= SEUIL_DB_LENT_MS:
                logger.warning(f"{fonction.__qualname__} lent", extra=ligne)
            else:
                logger.info(f"{fonction.__qualname__} ok", extra=ligne)

        def _ecrire_vue(duree, valeurs, reponse, exc):
            requete = valeurs.get(REQUETE)
            requete = requete if isinstance(requete, HttpRequest | Request) else None
            statut = _statut_erreur(exc) if exc else getattr(reponse, "status_code", 200)
            match = getattr(requete, "resolver_match", None)
            route = match.route if match else "unmatched"
            corps = getattr(reponse, "data", None)
            ligne = {
                "layer": "controller",
                "httpMethod": getattr(requete, "method", None),
                "route": route,
                "status": statut,
                "durationMs": duree,
                **extraire(champs, {**valeurs, RESULTAT: corps}),
            }
            # Refus : code métier fixe de la réponse (ex. NON_CONNECTE), jamais son message
            code = corps.get("code") if statut >= 400 and isinstance(corps, dict) else None
            if isinstance(code, str):
                ligne["errorCode"] = code
            _niveau(statut)(f"{ligne['httpMethod']} {route} {statut}", extra=ligne)
            if requete is not None:
                # Ligne écrite : le journal des erreurs (middleware.py) n'en ajoute pas une deuxième
                setattr(getattr(requete, "_request", requete), DEJA_ECRIT, True)

        @functools.wraps(fonction)
        def enveloppe(*args, **kwargs):
            debut = time.monotonic()
            valeurs = racines(args, kwargs)
            try:
                resultat = fonction(*args, **kwargs)
            except Exception as exc:
                ecrire(debut, valeurs, exc=exc)
                raise
            ecrire(debut, valeurs, resultat)
            return resultat

        return enveloppe

    return decorer
