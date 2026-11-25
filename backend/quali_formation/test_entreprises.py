"""Recherche d'une entreprise par SIRET (service partagé SCRUM-221 / SCRUM-113) et ses logs métier.
L'API de l'État est simulée : aucun appel réseau."""

import io
import json
from types import SimpleNamespace
from unittest import mock
from urllib.error import HTTPError, URLError

from django.test import SimpleTestCase, TestCase

from quali_formation.entreprises import (
    RechercheEntreprises,
    ServiceEntreprisesIndisponible,
    SiretInvalide,
    normaliser_siret,
)
from quali_formation.tests import connecter

SIRET = '12345678900012'
UTILISATEUR = SimpleNamespace(id=42, email='marie.arnaud@hitech-formation.fr')
ENTREPRISE = {'siret': SIRET, 'raison_sociale': 'HITECH FORMATION', 'adresse': '12 RUE DES LILAS 75011 PARIS'}
REPONSE_API = {'results': [{
    'siren': '123456789', 'nom_complet': 'HITECH FORMATION (HTF)', 'nom_raison_sociale': 'HITECH FORMATION',
    'siege': {'siret': '12345678900020', 'adresse': '1 PLACE DU SIEGE 69001 LYON'},
    'matching_etablissements': [{'siret': SIRET, 'adresse': '12 RUE DES LILAS 75011 PARIS'}],
}]}


def api(reponse=None, erreur=None):
    """Remplace l'appel réseau : renvoie `reponse` (JSON) ou lève `erreur` ; garde la requête envoyée."""
    appels = []

    def ouvrir(requete, timeout):
        appels.append((requete.full_url, timeout))
        if erreur:
            raise erreur
        return io.BytesIO(json.dumps(reponse).encode())
    return RechercheEntreprises(ouvrir), appels


class RechercheEntreprisesTests(SimpleTestCase):
    def rechercher(self, service, siret=SIRET):
        with self.assertLogs('quali_formation.metier', level='INFO') as logs:
            resultat = service.rechercher(siret, UTILISATEUR)
        (ligne,) = logs.records
        return resultat, ligne

    def test_trouvee_raison_sociale_et_adresse_de_l_etablissement(self):
        service, appels = api(REPONSE_API)
        resultat, ligne = self.rechercher(service, '123 456 789 00012')
        self.assertEqual(resultat, {'statut': 'TROUVEE', 'entreprise': ENTREPRISE})
        url, delai = appels[0]
        self.assertIn(f'q={SIRET}', url)
        self.assertEqual(delai, 5)
        # Log : info, utilisateur, SIRET, résultat, durée ; aucune donnée personnelle
        self.assertEqual((ligne.levelname, ligne.layer, getattr(ligne, 'class'), ligne.method),
                         ('INFO', 'service', 'RechercheEntreprises', 'rechercher'))
        self.assertEqual((getattr(ligne, 'utilisateur.id'), ligne.siret, getattr(ligne, 'resultat.statut')),
                         ('42', '123 456 789 00012', 'TROUVEE'))
        self.assertIsInstance(ligne.durationMs, int)
        self.assertNotIn('marie.arnaud', json.dumps(ligne.__dict__, default=str))
        self.assertNotIn('LILAS', json.dumps(ligne.__dict__, default=str))

    def test_siege_et_nom_complet_si_pas_de_raison_sociale(self):
        reponse = {'results': [{'nom_complet': 'MARIE ARNAUD', 'siege': {'siret': SIRET, 'adresse': '3 RUE X'}}]}
        service, _ = api(reponse)
        self.assertEqual(self.rechercher(service)[0]['entreprise'],
                         {'siret': SIRET, 'raison_sociale': 'MARIE ARNAUD', 'adresse': '3 RUE X'})

    def test_introuvable_si_aucun_etablissement_n_a_exactement_ce_siret(self):
        for reponse in ({'results': []}, {'results': None}, {}, None, [],
                        {'results': [{'nom_complet': 'AUTRE', 'siege': {'siret': '99999999900012'}}]}):
            with self.subTest(reponse=reponse):
                resultat, ligne = self.rechercher(api(reponse)[0])
                self.assertEqual(resultat, {'statut': 'INTROUVABLE', 'entreprise': None})
                self.assertEqual((ligne.levelname, getattr(ligne, 'resultat.statut')), ('INFO', 'INTROUVABLE'))

    def test_api_en_erreur_log_error_avec_son_code(self):
        cas = [
            (HTTPError('http://api', 503, 'Service Unavailable', {}, None), 'API_HTTP_503'),
            (HTTPError('http://api', 429, 'Too Many Requests', {}, None), 'API_HTTP_429'),
            (TimeoutError(), 'DELAI_DEPASSE'),
            (URLError(TimeoutError()), 'DELAI_DEPASSE'),
            (URLError('Name or service not known'), 'API_INJOIGNABLE'),
            (ConnectionRefusedError(), 'API_INJOIGNABLE'),
        ]
        for erreur, code in cas:
            with self.subTest(code=code):
                service, _ = api(erreur=erreur)
                with self.assertLogs('quali_formation.metier', level='INFO') as logs, \
                        self.assertRaises(ServiceEntreprisesIndisponible) as leve:
                    service.rechercher(SIRET, UTILISATEUR)
                self.assertEqual(leve.exception.code, code)
                (ligne,) = logs.records
                self.assertEqual((ligne.levelname, ligne.error, ligne.errorCode, getattr(ligne, 'utilisateur.id'),
                                  ligne.siret), ('ERROR', 'ServiceEntreprisesIndisponible', code, '42', SIRET))
                self.assertFalse(hasattr(ligne, 'resultat.statut'))

    def test_reponse_illisible(self):
        service = RechercheEntreprises(lambda requete, timeout: io.BytesIO(b'<html>'))
        with self.assertLogs('quali_formation.metier') as logs, \
                self.assertRaises(ServiceEntreprisesIndisponible) as leve:
            service.rechercher(SIRET, UTILISATEUR)
        self.assertEqual((leve.exception.code, logs.records[0].levelname), ('REPONSE_ILLISIBLE', 'ERROR'))

    def test_siret_invalide_log_warn_sans_appel(self):
        service, appels = api(REPONSE_API)
        for siret in ('', None, '123', '1234567890001A', '123456789000123'):
            with self.subTest(siret=siret), self.assertLogs('quali_formation.metier') as logs, \
                    self.assertRaises(SiretInvalide):
                service.rechercher(siret, UTILISATEUR)
            (ligne,) = logs.records
            self.assertEqual((ligne.levelname, ligne.errorCode, getattr(ligne, 'utilisateur.id')),
                             ('WARNING', 'SIRET_INVALIDE', '42'))
        self.assertEqual(appels, [])

    def test_sans_utilisateur(self):
        # Réutilisable sans compte (ex. tâche technique) : la ligne n'a simplement pas d'identifiant
        with self.assertLogs('quali_formation.metier') as logs:
            api(REPONSE_API)[0].rechercher(SIRET)
        self.assertFalse(hasattr(logs.records[0], 'utilisateur.id'))

    def test_normaliser_siret(self):
        self.assertEqual(normaliser_siret(' 123 456 789\t00012 '), SIRET)

    def test_adresse_de_l_api_configurable(self):
        service, appels = api(REPONSE_API)
        with mock.patch.dict('os.environ', {'RECHERCHE_ENTREPRISES_URL': 'http://faux/search'}), \
                self.assertLogs('quali_formation.metier'):
            service.rechercher(SIRET)
        self.assertTrue(appels[0][0].startswith('http://faux/search?'))


class RouteEntrepriseTests(TestCase):
    """GET /entreprises/<siret>/"""

    def setUp(self):
        self.compte = connecter(self.client, centre=False)  # accessible dès la première connexion

    def get(self, siret=SIRET, **simulation):
        with mock.patch('quali_formation.views.recherche_entreprises.rechercher', **simulation) as rechercher:
            reponse = self.client.get(f'/entreprises/{siret}/')
        self.rechercher = rechercher
        return reponse

    def test_trouvee(self):
        reponse = self.get(return_value={'statut': 'TROUVEE', 'entreprise': ENTREPRISE})
        self.assertEqual((reponse.status_code, reponse.json()), (200, ENTREPRISE))
        # Le compte connecté est transmis au service (identifiant dans le log)
        self.assertEqual(self.rechercher.call_args.args, (SIRET, self.compte))

    def test_introuvable(self):
        reponse = self.get(return_value={'statut': 'INTROUVABLE', 'entreprise': None})
        self.assertEqual((reponse.status_code, reponse.json()['code']), (404, 'ENTREPRISE_INTROUVABLE'))

    def test_service_indisponible_une_seule_ligne_de_log(self):
        with mock.patch('quali_formation.views.recherche_entreprises._ouvrir', side_effect=TimeoutError()), \
                self.assertLogs(level='INFO') as logs:
            reponse = self.client.get(f'/entreprises/{SIRET}/')
        self.assertEqual((reponse.status_code, reponse.json()['code']), (503, 'SERVICE_INDISPONIBLE'))
        erreurs = [r for r in logs.records if r.levelname == 'ERROR' and hasattr(r, 'layer')]
        self.assertEqual([(r.layer, r.errorCode) for r in erreurs], [('service', 'DELAI_DEPASSE')])

    def test_siret_invalide(self):
        reponse = self.client.get('/entreprises/123/')
        self.assertEqual((reponse.status_code, reponse.json()['code']), (400, 'SIRET_INVALIDE'))

    def test_autre_chose_qu_un_numero_n_atteint_pas_la_recherche(self):
        reponse = self.get(siret='jean.dupont')
        self.assertEqual(reponse.status_code, 404)
        self.rechercher.assert_not_called()

    def test_non_connecte(self):
        reponse = self.client_class().get(f'/entreprises/{SIRET}/')
        self.assertEqual((reponse.status_code, reponse.json()['code']), (401, 'NON_CONNECTE'))
