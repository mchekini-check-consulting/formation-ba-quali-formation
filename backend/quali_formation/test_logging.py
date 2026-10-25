import json
import logging
from unittest import mock

from django.http import HttpResponse
from django.test import RequestFactory, SimpleTestCase

from quali_formation.logging import db
from quali_formation.logging.formatter import JsonFormatter
from quali_formation.logging.loggable import loggable
from quali_formation.logging.middleware import RequestLoggingMiddleware


class JsonFormatterTests(SimpleTestCase):
    def test_contient_time_level_msg_et_les_champs_extra(self):
        logger = logging.getLogger("quali_formation.test.formatter")
        with self.assertLogs(logger, level="INFO") as captured:
            logger.info("un message", extra={"layer": "service", "durationMs": 5})
        line = json.loads(JsonFormatter().format(captured.records[0]))
        self.assertEqual(line["level"], "info")
        self.assertEqual(line["msg"], "un message")
        self.assertEqual(line["layer"], "service")
        self.assertEqual(line["durationMs"], 5)
        self.assertIn("time", line)

    def test_inclut_la_trace_quand_exc_info_est_present(self):
        logger = logging.getLogger("quali_formation.test.formatter")
        try:
            raise ValueError("boom")
        except ValueError:
            with self.assertLogs(logger, level="ERROR") as captured:
                logger.exception("échec")
        line = json.loads(JsonFormatter().format(captured.records[0]))
        self.assertIn("ValueError", line["exc_info"])

    def test_log_sans_layer_nest_pas_perdu(self):
        logger = logging.getLogger("quali_formation.test.formatter")
        with self.assertLogs(logger, level="INFO") as captured:
            logger.info("démarrage")
        line = json.loads(JsonFormatter().format(captured.records[0]))
        self.assertNotIn("layer", line)


class LoggableTests(SimpleTestCase):
    def test_logue_le_succes_sans_loguer_les_arguments(self):
        @loggable
        class UnService:
            def une_methode(self, secret):
                return secret.upper()

        with self.assertLogs("quali_formation.service", level="INFO") as captured:
            resultat = UnService().une_methode("mot-de-passe")
        self.assertEqual(resultat, "MOT-DE-PASSE")
        message = captured.records[0].getMessage()
        self.assertNotIn("mot-de-passe", message)
        self.assertEqual(captured.records[0].layer, "service")

    def test_logue_lechec_sans_remonter_les_arguments(self):
        @loggable
        class UnService:
            def une_methode(self):
                raise ValueError("boom")

        with self.assertLogs("quali_formation.service", level="ERROR"), self.assertRaises(ValueError):
            UnService().une_methode()


class DbLoggingTests(SimpleTestCase):
    def test_requete_normale_non_loguee(self):
        execute = mock.Mock(return_value="ok")
        with self.assertNoLogs("quali_formation.db"):
            result = db.log_slow_or_failed_queries(execute, "SELECT 1", [], False, None)
        self.assertEqual(result, "ok")

    def test_requete_lente_loguee_sans_les_parametres(self):
        execute = mock.Mock(return_value="ok")
        with (
            mock.patch.object(db, "SLOW_QUERY_THRESHOLD_MS", -1),
            self.assertLogs("quali_formation.db", level="WARNING") as captured,
        ):
            db.log_slow_or_failed_queries(
                execute, "SELECT * FROM item WHERE nom = %s", ["secret"], False, None
            )
        record = captured.records[0]
        self.assertEqual(record.layer, "db")
        self.assertNotIn("secret", record.query)

    def test_requete_en_erreur_loguee_et_relevee(self):
        execute = mock.Mock(side_effect=RuntimeError("connexion perdue"))
        with (
            self.assertLogs("quali_formation.db", level="ERROR") as captured,
            self.assertRaises(RuntimeError),
        ):
            db.log_slow_or_failed_queries(execute, "SELECT 1", [], False, None)
        self.assertEqual(captured.records[0].layer, "db")


class RequestLoggingMiddlewareTests(SimpleTestCase):
    def test_route_non_resolue_nest_pas_lurl_complete(self):
        middleware = RequestLoggingMiddleware(lambda request: HttpResponse(status=500))
        request = RequestFactory().get("/items/42")
        with self.assertLogs("quali_formation.controller", level="ERROR") as captured:
            response = middleware(request)
        self.assertEqual(response.status_code, 500)
        record = captured.records[0]
        self.assertEqual(record.route, "unmatched")
        self.assertNotIn("42", record.getMessage())
