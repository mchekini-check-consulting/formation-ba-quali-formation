"""Logs métier activés action par action (skill logs-metier) : seules les fonctions décorées par @log_metier
écrivent une ligne. Champs obligatoires de la plateforme (mêmes noms que middleware.py et loggable.py) :
  controller : layer, httpMethod, route (modèle, jamais ses valeurs), status, durationMs
  service/db : layer, class, method, durationMs, error (+ errorCode métier) en cas d'échec
puis les champs métier approuvés par le BA (champs.py). Racines des chemins : les noms des paramètres de la
fonction, "resultat" et, en cas d'échec, "erreur" (l'exception levée : ex. erreur.champs) ; pour une vue : "request" (ex. request.data.action), les paramètres de l'adresse
(ex. pk) et "resultat" (corps de la réponse).

    @log_metier("service", champs=["action", "resultat.statut"])
    def enregistrer(self, formation, donnees, action): ...

Vue : sous @api_view et au-dessus de @_connexion_requise (les refus 401 sont aussi écrits).

Couches service et db : "message" (réussite) et "message_echec" (échec) remplacent le msg standard
("X.y ok" / "X.y en échec") par une phrase lisible, dont les trous {chemin} sont remplis par les
champs approuvés (valeur illisible : "?") :

    @log_metier("service", champs=["resultat.id"], message="Formateur n° {resultat.id} créé")
"""

import functools
import inspect
import logging
import re
import time

from django.core.exceptions import PermissionDenied
from django.http import Http404, HttpRequest
from rest_framework.request import Request

from quali_formation.logging.champs import ERREUR, RESULTAT, extraire, verifier
from quali_formation.logging.loggable import error_fields
from quali_formation.logging.middleware import DEJA_ECRIT

logger = logging.getLogger("quali_formation.metier")

# Au-delà, un appel db est écrit en warn (visible même avec LOG_LEVEL=warn)
SEUIL_DB_LENT_MS = 200
CONTROLLER = "controller"
_COUCHES = {CONTROLLER, "service", "db"}
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


def _racines(couche, signature, args, kwargs) -> dict:
    """Valeurs dont partent les chemins des champs approuvés."""
    if couche == CONTROLLER:
        # Vue : la requête (1er argument) et les paramètres de l'adresse (kwargs de Django)
        return {REQUETE: args[0] if args else None, **kwargs}
    return dict(signature.bind_partial(*args, **kwargs).arguments)


def _route(requete) -> str:
    match = getattr(requete, "resolver_match", None)
    return match.route if match else "unmatched"


def _code_refus(statut, corps):
    """Refus : code métier fixe de la réponse (ex. NON_CONNECTE), jamais son message."""
    code = corps.get("code") if statut >= 400 and isinstance(corps, dict) else None
    return code if isinstance(code, str) else None


def _ecrire_vue(champs, duree, valeurs, reponse, exc):
    requete = valeurs.get(REQUETE)
    requete = requete if isinstance(requete, HttpRequest | Request) else None
    statut = _statut_erreur(exc) if exc else getattr(reponse, "status_code", 200)
    corps = getattr(reponse, "data", None)
    ligne = {
        "layer": CONTROLLER,
        "httpMethod": getattr(requete, "method", None),
        "route": _route(requete),
        "status": statut,
        "durationMs": duree,
        **extraire(champs, {**valeurs, RESULTAT: corps, ERREUR: exc}),
    }
    code = _code_refus(statut, corps)
    if code:
        ligne["errorCode"] = code
    _niveau(statut)(f"{ligne['httpMethod']} {ligne['route']} {statut}", extra=ligne)
    if requete is not None:
        # Ligne écrite : le journal des erreurs (middleware.py) n'en ajoute pas une deuxième
        setattr(getattr(requete, "_request", requete), DEJA_ECRIT, True)


# Trou d'un message lisible : {chemin d'un champ approuvé}
_TROU = re.compile(r"\{([^{}]+)\}")


def _phrase(message, champs_extraits) -> str:
    """Le message avec ses trous remplis par les champs extraits ; valeur illisible : « ? »."""
    return _TROU.sub(lambda trou: champs_extraits.get(trou.group(1), "?"), message)


def _verifier_messages(contexte, couche, champs, messages) -> None:
    for message in messages:
        if message is None:
            continue
        if couche == CONTROLLER:
            raise ValueError(f"Logs métier de {contexte} : message lisible réservé aux couches service et db "
                             "(le controller écrit « verbe route statut »)")
        inconnus = [trou for trou in _TROU.findall(message) if trou not in champs]
        if inconnus:
            raise ValueError(f"Logs métier de {contexte} : trous absents des champs approuvés : "
                             + ", ".join(inconnus))


def _ecrire_appel(couche, fonction, champs, duree, valeurs, resultat, exc, message, message_echec):
    classe, _, methode = fonction.__qualname__.rpartition(".")
    champs_extraits = extraire(champs, {**valeurs, RESULTAT: resultat, ERREUR: exc})
    ligne = {"layer": couche, "class": classe, "method": methode, "durationMs": duree, **champs_extraits}
    if exc is not None:
        msg = _phrase(message_echec, champs_extraits) if message_echec else f"{fonction.__qualname__} en échec"
        _niveau(_statut_erreur(exc))(msg, extra={**ligne, **error_fields(exc)})
    elif couche == "db" and duree >= SEUIL_DB_LENT_MS:
        logger.warning(f"{fonction.__qualname__} lent", extra=ligne)
    else:
        msg = _phrase(message, champs_extraits) if message else f"{fonction.__qualname__} ok"
        logger.info(msg, extra=ligne)


def _ecrire(couche, fonction, champs, debut, valeurs, resultat=None, exc=None, message=None, message_echec=None):
    duree = round((time.monotonic() - debut) * 1000)
    if couche == CONTROLLER:
        _ecrire_vue(champs, duree, valeurs, resultat, exc)
    else:
        _ecrire_appel(couche, fonction, champs, duree, valeurs, resultat, exc, message, message_echec)


def log_metier(couche: str, champs=(), message: str | None = None, message_echec: str | None = None):
    if couche not in _COUCHES:
        raise ValueError(f"couche inconnue : {couche} (controller, service ou db)")

    def decorer(fonction):
        signature = inspect.signature(fonction)
        verifier(fonction.__qualname__, champs, [*signature.parameters, RESULTAT, ERREUR])
        _verifier_messages(fonction.__qualname__, couche, champs, (message, message_echec))

        @functools.wraps(fonction)
        def enveloppe(*args, **kwargs):
            debut = time.monotonic()
            valeurs = _racines(couche, signature, args, kwargs)
            try:
                resultat = fonction(*args, **kwargs)
            except Exception as exc:
                _ecrire(couche, fonction, champs, debut, valeurs, exc=exc,
                        message=message, message_echec=message_echec)
                raise
            _ecrire(couche, fonction, champs, debut, valeurs, resultat,
                    message=message, message_echec=message_echec)
            return resultat

        return enveloppe

    return decorer
