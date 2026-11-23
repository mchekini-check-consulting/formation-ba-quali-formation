import logging
import time

from django.db import connection

from quali_formation.logging.db import log_slow_or_failed_queries

logger = logging.getLogger("quali_formation.controller")

# Posé sur la requête par @log_metier (log_metier.py) quand l'action a déjà écrit sa ligne
DEJA_ECRIT = "log_metier_ecrit"


class RequestLoggingMiddleware:
    """Journal des erreurs de toutes les requêtes (layer: controller) : une ligne error pour chaque réponse 5xx
    ou exception, même si l'action n'est pas activée avec @log_metier (sinon c'est @log_metier qui l'écrit).
    Seulement le verbe, la route déclarée, le code, la durée et le type d'erreur : jamais les paramètres
    (query/body), l'URL avec ses valeurs ni le message de l'erreur. Installe aussi le hook de la couche db
    pour la durée de la requête."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        start = time.monotonic()
        with connection.execute_wrapper(log_slow_or_failed_queries):
            response = self.get_response(request)
        if response.status_code >= 500 and not getattr(request, DEJA_ECRIT, False):
            route = request.resolver_match.route if request.resolver_match else "unmatched"
            erreur = getattr(request, "_type_erreur", None)
            logger.error(f"{request.method} {route} {response.status_code}", extra={
                "layer": "controller",
                "httpMethod": request.method,
                "route": route,
                "status": response.status_code,
                "durationMs": round((time.monotonic() - start) * 1000),
                **({"error": erreur} if erreur else {}),
            })
        return response

    def process_exception(self, request, exception):
        # Exception non rattrapée par la vue : Django renverra une 500, on retient son type pour la ligne d'erreur
        request._type_erreur = type(exception).__name__
