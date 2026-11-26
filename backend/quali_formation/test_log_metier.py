import json
from datetime import date
from unittest import mock

from django.core.exceptions import PermissionDenied
from django.http import Http404, HttpResponse
from django.test import RequestFactory, SimpleTestCase, TestCase
from django.urls import ResolverMatch
from rest_framework.decorators import api_view
from rest_framework.exceptions import NotFound
from rest_framework.response import Response

from quali_formation.logging import log_metier as module
from quali_formation.logging.champs import erreurs, extraire, personnel, verifier
from quali_formation.logging.log_metier import SEUIL_DB_LENT_MS, log_metier
from quali_formation.logging.loggable import error_fields
from quali_formation.services import ErreurMetier


class Logement:
    surface = 60
    adresse = "12 rue des Lilas"

    @property
    def statut(self):
        raise RuntimeError("chargement impossible")


class ChampsTests(SimpleTestCase):
    def test_extrait_valeurs_simples_listes_taille_dates(self):
        demande = {"formule": "confort", "options": ["a", "b"], "logement": Logement(), "le": date(2026, 11, 7)}
        valeurs = extraire(
            ["demande.formule", "demande.options", "demande.options.taille", "demande.logement.surface",
             "demande.le", "resultat.ok", "demande.logement", "demande.logement.statut", "absent.x",
             "demande.vide.x"],
            {"demande": demande, "resultat": {"ok": True}},
        )
        self.assertEqual(valeurs, {
            "demande.formule": "confort",
            "demande.options": "a,b",
            "demande.options.taille": "2",
            "demande.logement.surface": "60",
            "demande.le": "2026-11-07",
            "resultat.ok": "true",
        })

    def test_refuse_donnees_personnelles_noms_reserves_racines_inconnues(self):
        self.assertEqual(
            erreurs(["demande.logement.adresse", "status", "httpMethod", "inconnu.x", "demande.formule"], ["demande"]),
            [
                "demande.logement.adresse : donnée personnelle ou secret (adresse), interdit dans les logs",
                "status : nom réservé à la plateforme",
                "httpMethod : nom réservé à la plateforme",
                "inconnu.x : racine inconnue (inconnu), attendu : demande",
            ],
        )
        with self.assertRaisesRegex(ValueError, "donnée personnelle"):
            verifier("x", ["email"], ["email"])

    def test_donnees_personnelles(self):
        for segment in ["nom", "nom_client", "nomClient", "email", "code_postal", "date_naissance", "mot_de_passe", "ip"]:
            self.assertTrue(personnel(segment), segment)
        for segment in ["nombre_pieces", "formule", "reference", "statut", "intitule"]:
            self.assertFalse(personnel(segment), segment)


class ErreurTests(SimpleTestCase):
    def test_type_et_code_metier_jamais_le_message(self):
        self.assertEqual(error_fields(ErreurMetier("INTITULE_EXISTANT", "La formation « Excel » existe déjà")),
                         {"error": "ErreurMetier", "errorCode": "INTITULE_EXISTANT"})
        self.assertEqual(error_fields(ValueError("marie.dupont@exemple.fr")), {"error": "ValueError"})


class Service:
    @log_metier("service", champs=["formule", "resultat.prix"])
    def calculer(self, formule, email):
        if formule == "inconnue":
            raise ErreurMetier("FORMULE_INCONNUE", "formule inconnue", 404)
        if formule == "panne":
            raise RuntimeError("panne")
        return {"formule": formule, "prix": 12}

    def sans_log(self):
        return {"formule": "confort"}


class Depot:
    @log_metier("db", champs=["resultat.taille"])
    def trouver(self, formule):
        return [formule]


class Formulaire:
    @log_metier("service", champs=["erreur.champs", "erreur.niveau"])
    def enregistrer(self, champs):
        if champs:
            exc = ErreurMetier("FORMULAIRE_INVALIDE", "marie.dupont@exemple.fr est invalide", 400)
            exc.champs, exc.niveau = champs, 2
            raise exc
        return {}


class LogMetierTests(SimpleTestCase):
    def test_echec_racine_erreur_sans_message(self):
        with self.assertLogs("quali_formation.metier", level="INFO") as logs:
            Formulaire().enregistrer([])
            with self.assertRaises(ErreurMetier):
                Formulaire().enregistrer(["siret", "nom"])
        reussite, echec = logs.records
        self.assertFalse(hasattr(reussite, "erreur.champs"))
        self.assertEqual((echec.levelname, getattr(echec, "erreur.champs"), getattr(echec, "erreur.niveau")),
                         ("WARNING", "siret,nom", "2"))
        self.assertNotIn("marie.dupont", json.dumps(echec.__dict__, default=str))

    def test_service_champs_obligatoires_et_approuves(self):
        with self.assertLogs("quali_formation.metier", level="INFO") as logs:
            Service().calculer("confort", "marie.dupont@exemple.fr")
            Service().sans_log()
        (record,) = logs.records
        self.assertEqual(record.getMessage(), "Service.calculer ok")
        self.assertEqual(record.layer, "service")
        self.assertEqual(getattr(record, "class"), "Service")
        self.assertEqual(record.method, "calculer")
        self.assertEqual(record.formule, "confort")
        self.assertEqual(getattr(record, "resultat.prix"), "12")
        self.assertIsInstance(record.durationMs, int)
        self.assertNotIn("marie.dupont", json.dumps(record.__dict__, default=str))

    def test_service_refus_metier_warn_panne_error(self):
        for formule, niveau, erreur in [("inconnue", "WARNING", ErreurMetier), ("panne", "ERROR", RuntimeError)]:
            with self.assertLogs("quali_formation.metier", level="INFO") as logs, self.assertRaises(erreur):
                Service().calculer(formule, "")
            (record,) = logs.records
            self.assertEqual(record.levelname, niveau)
            self.assertEqual(record.error, erreur.__name__)
            self.assertFalse(hasattr(record, "resultat.prix"))

    def test_db_appel_lent_en_warn(self):
        with (
            mock.patch.object(module.time, "monotonic", side_effect=[0, 0, 0, SEUIL_DB_LENT_MS / 1000]),
            self.assertLogs("quali_formation.metier", level="INFO") as logs,
        ):
            Depot().trouver("confort")
            Depot().trouver("lente")
        self.assertEqual([r.levelname for r in logs.records], ["INFO", "WARNING"])
        self.assertEqual(getattr(logs.records[0], "resultat.taille"), "1")
        self.assertEqual(logs.records[0].layer, "db")

    def test_refuse_a_l_import_un_champ_non_conforme(self):
        with self.assertRaisesRegex(ValueError, "donnée personnelle"):
            log_metier("service", champs=["email"])(lambda email: email)
        with self.assertRaisesRegex(ValueError, "racine inconnue"):
            log_metier("service", champs=["autre.x"])(lambda demande: demande)
        with self.assertRaisesRegex(ValueError, "couche inconnue"):
            log_metier("vue")


class Createur:
    @log_metier("service", champs=["formule", "resultat.prix"],
                message="La formule {formule} donne un prix de {resultat.prix}",
                message_echec="La formule {formule} est sans prix")
    def tarifer(self, formule):
        if formule == "inconnue":
            raise ErreurMetier("FORMULE_INCONNUE", "formule inconnue", 404)
        return {"prix": 12}


class MessageLisibleTests(SimpleTestCase):
    def test_message_de_reussite_avec_les_champs(self):
        with self.assertLogs("quali_formation.metier", level="INFO") as logs:
            Createur().tarifer("confort")
        (record,) = logs.records
        self.assertEqual(record.getMessage(), "La formule confort donne un prix de 12")
        # Les champs restent écrits à côté de la phrase (filtres Grafana)
        self.assertEqual((record.layer, record.formule, getattr(record, "resultat.prix")),
                         ("service", "confort", "12"))

    def test_message_d_echec_sans_le_resultat(self):
        with self.assertLogs("quali_formation.metier", level="INFO") as logs, self.assertRaises(ErreurMetier):
            Createur().tarifer("inconnue")
        (record,) = logs.records
        self.assertEqual(record.getMessage(), "La formule inconnue est sans prix")
        self.assertEqual((record.levelname, record.errorCode), ("WARNING", "FORMULE_INCONNUE"))

    def test_trou_illisible_remplace_par_un_point_d_interrogation(self):
        class SansValeur:
            @log_metier("service", champs=["resultat.prix"], message="Prix : {resultat.prix}")
            def tarifer(self):
                return {}

        with self.assertLogs("quali_formation.metier", level="INFO") as logs:
            SansValeur().tarifer()
        self.assertEqual(logs.records[0].getMessage(), "Prix : ?")

    def test_refuse_un_trou_hors_champs_approuves_et_le_controller(self):
        with self.assertRaisesRegex(ValueError, "trous absents des champs approuvés : formule"):
            log_metier("service", champs=[], message="La formule {formule}")(lambda formule: formule)
        with self.assertRaisesRegex(ValueError, "réservé aux couches service et db"):
            log_metier("controller", champs=[], message="Une phrase")(lambda request: None)


class ControleurTests(SimpleTestCase):
    def requete(self, chemin="/formations/7/"):
        requete = RequestFactory().post(chemin, {"action": "brouillon"}, content_type="application/json")
        requete.resolver_match = ResolverMatch(lambda r: None, (), {}, route="formations/<int:pk>/")
        return requete

    def test_vue_drf_route_statut_duree_champs_approuves(self):
        @api_view(["POST"])
        @log_metier("controller", champs=["pk", "request.data.action", "resultat.statut"])
        def vue(request, pk):
            return Response({"statut": "brouillon"}, status=201)

        with self.assertLogs("quali_formation.metier", level="INFO") as logs:
            vue(self.requete(), pk=7)
        (record,) = logs.records
        self.assertEqual(record.getMessage(), "POST formations/<int:pk>/ 201")
        self.assertEqual(record.layer, "controller")
        self.assertEqual(record.httpMethod, "POST")
        self.assertEqual(record.route, "formations/<int:pk>/")
        self.assertEqual(record.status, 201)
        self.assertEqual(record.pk, "7")
        self.assertEqual(getattr(record, "request.data.action"), "brouillon")
        self.assertEqual(getattr(record, "resultat.statut"), "brouillon")

    def test_reponse_4xx_en_warn(self):
        @log_metier("controller")
        def vue(request):
            return Response({"code": "NON_CONNECTE"}, status=401)

        with self.assertLogs("quali_formation.metier", level="INFO") as logs:
            vue(self.requete())
        self.assertEqual(logs.records[0].levelname, "WARNING")
        self.assertEqual(logs.records[0].errorCode, "NON_CONNECTE")

    def test_erreurs_converties_en_code_http(self):
        cas = [(Http404(), 404, "WARNING"), (PermissionDenied(), 403, "WARNING"), (NotFound(), 404, "WARNING"),
               (RuntimeError("panne"), 500, "ERROR")]
        for exc, statut, niveau in cas:
            @log_metier("controller")
            def vue(request, exc=exc):
                raise exc

            with self.assertLogs("quali_formation.metier", level="INFO") as logs, self.assertRaises(type(exc)):
                vue(self.requete())
            self.assertEqual(logs.records[0].status, statut)
            self.assertEqual(logs.records[0].levelname, niveau)

    def test_reponse_django_sans_route(self):
        @log_metier("controller", champs=["resultat.x"])
        def vue(request):
            return HttpResponse("ok")

        with self.assertLogs("quali_formation.metier", level="INFO") as logs:
            vue(RequestFactory().get("/"))
        self.assertEqual(logs.records[0].route, "unmatched")
        self.assertEqual(logs.records[0].status, 200)


class ActivationsTests(TestCase):
    """Les actions activées écrivent leurs champs approuvés en passant par les vraies routes."""

    def test_connexion_refusee_errorcode_sans_email(self):
        with mock.patch("quali_formation.views.compte_service.connecter",
                        side_effect=ErreurMetier("IDENTIFIANTS_INVALIDES", "E-mail ou mot de passe incorrect", 401)), \
                self.assertLogs("quali_formation.metier", level="INFO") as logs:
            self.client.post("/auth/login", {"email": "marie.dupont@exemple.fr", "mot_de_passe": "x"},
                             content_type="application/json")
        (record,) = logs.records
        self.assertEqual((record.route, record.status, record.errorCode), ("auth/login", 401, "IDENTIFIANTS_INVALIDES"))
        self.assertNotIn("marie.dupont", json.dumps(record.__dict__, default=str))

    def test_action_non_activee_sans_ligne(self):
        with self.assertNoLogs("quali_formation.metier"):
            self.client.get("/auth/moi")
