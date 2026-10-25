import functools
import logging
import time

from rest_framework.exceptions import APIException

logger = logging.getLogger("quali_formation.service")


def error_fields(exc: Exception) -> dict:
    return {"error": type(exc).__name__, "errorMessage": str(exc)}


def loggable(cls):
    """Décorateur de classe pour la couche service (layer: service) : chaque
    méthode publique produit un log (classe, méthode, durée), sans jamais
    loguer ses arguments ni sa valeur de retour."""
    for name, member in vars(cls).copy().items():
        if name.startswith("_") or not callable(member):
            continue
        setattr(cls, name, _wrap(cls.__name__, name, member))
    return cls


def _wrap(class_name, method_name, func):
    fields = {"layer": "service", "class": class_name, "method": method_name}

    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        start = time.monotonic()
        try:
            result = func(*args, **kwargs)
        except Exception as exc:
            duration_ms = round((time.monotonic() - start) * 1000)
            # Erreur métier (ex. validation, 4xx) : warn ; le reste : error.
            is_client_error = isinstance(exc, APIException) and exc.status_code < 500
            log = logger.warning if is_client_error else logger.error
            log(
                f"{class_name}.{method_name} en échec",
                extra={**fields, "durationMs": duration_ms, **error_fields(exc)},
            )
            raise
        logger.info(
            f"{class_name}.{method_name} ok",
            extra={**fields, "durationMs": round((time.monotonic() - start) * 1000)},
        )
        return result

    return wrapper
