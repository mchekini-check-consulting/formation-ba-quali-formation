import logging
import time

from django.db import connection

from quali_formation.logging.db import log_slow_or_failed_queries

logger = logging.getLogger("quali_formation.controller")


class RequestLoggingMiddleware:
    """Un log par requête HTTP (layer: controller) : route déclarée, code de
    statut, durée — jamais les paramètres (query/body) ni l'URL avec ses
    valeurs. Installe aussi le hook de la couche db pour la durée de la
    requête."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        start = time.monotonic()
        with connection.execute_wrapper(log_slow_or_failed_queries):
            response = self.get_response(request)
        duration_ms = round((time.monotonic() - start) * 1000)
        route = request.resolver_match.route if request.resolver_match else "unmatched"
        fields = {
            "layer": "controller",
            "httpMethod": request.method,
            "route": route,
            "status": response.status_code,
            "durationMs": duration_ms,
        }
        message = f"{request.method} {route} {response.status_code}"
        if response.status_code >= 500:
            logger.error(message, extra=fields)
        elif response.status_code >= 400:
            logger.warning(message, extra=fields)
        else:
            logger.info(message, extra=fields)
        return response
