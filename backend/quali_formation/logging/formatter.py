import json
import logging
from datetime import UTC, datetime

# Attributs par défaut d'un LogRecord (dépend de la version de Python) : tout
# le reste vient de extra={...} (layer, durationMs...) et doit être recopié
# tel quel dans la ligne JSON.
_DEFAULT_RECORD_ATTRS = set(logging.makeLogRecord({}).__dict__) | {"message"}


class JsonFormatter(logging.Formatter):
    """Une ligne JSON par log sur stdout : time/level/msg + champs extra."""

    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "time": datetime.fromtimestamp(record.created, tz=UTC)
            .isoformat(timespec="milliseconds")
            .replace("+00:00", "Z"),
            "level": record.levelname.lower(),
            "msg": record.getMessage(),
        }
        for key, value in record.__dict__.items():
            if key not in _DEFAULT_RECORD_ATTRS:
                payload[key] = value
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)
