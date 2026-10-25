import logging
import time

from quali_formation.logging.loggable import error_fields

logger = logging.getLogger("quali_formation.db")

# Au-delà de ce seuil, une requête est "lente" (layer: db). Les requêtes
# normales ne sont pas loguées (volume), les paramètres jamais (données
# personnelles) : seul le texte SQL (déjà paramétré) est gardé.
SLOW_QUERY_THRESHOLD_MS = 200


def log_slow_or_failed_queries(execute, sql, params, many, context):
    """Hook `connection.execute_wrapper` : à installer pour la durée d'une
    requête HTTP (les connexions Django sont thread-local)."""
    start = time.monotonic()
    try:
        result = execute(sql, params, many, context)
    except Exception as exc:
        logger.error(
            "requête en erreur",
            extra={
                "layer": "db",
                "durationMs": round((time.monotonic() - start) * 1000),
                "query": _truncate(sql),
                **error_fields(exc),
            },
        )
        raise
    duration_ms = round((time.monotonic() - start) * 1000)
    if duration_ms >= SLOW_QUERY_THRESHOLD_MS:
        logger.warning(
            "requête lente",
            extra={"layer": "db", "durationMs": duration_ms, "query": _truncate(sql)},
        )
    return result


def _truncate(sql: str, limit: int = 1000) -> str:
    return sql if len(sql) <= limit else f"{sql[:limit]}..."
