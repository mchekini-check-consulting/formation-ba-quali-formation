"""SCRUM-210 « Accéder aux modèles par dossiers » : GET /modeles/resume et la liste des modèles (RG2)."""

import json

from django.test import SimpleTestCase, TestCase

from quali_formation.models import Formation, TypeModele
from quali_formation.tests import connecter


def creer_formation(compte, reference, statut=Formation.Statut.BROUILLON):
    return Formation.objects.create(reference=reference, intitule=f'Formation {reference}', statut=statut,
                                    proprietaire=compte)


class TypeModeleTests(SimpleTestCase):
    def test_rg2_seulement_les_4_modeles_proposes(self):
        self.assertEqual([(t.value, t.label) for t in TypeModele], [
            ('CONVENTION', 'Convention de formation'),
            ('CONTRAT', 'Contrat de formation'),
            ('CONVOCATION', 'Convocation'),
            ('ATTESTATION', 'Attestation de fin de formation'),
        ])


class ResumeModelesTests(TestCase):
    URL = '/modeles/resume'

    def test_sans_connexion_401(self):
        reponse = self.client.get(self.URL)
        self.assertEqual(reponse.status_code, 401)
        self.assertEqual(reponse.json()['code'], 'NON_CONNECTE')

    def test_200_nombre_de_modeles_et_de_formations(self):
        compte = connecter(self.client)
        creer_formation(compte, 'FOR-1')
        creer_formation(compte, 'FOR-2', Formation.Statut.VALIDEE)
        reponse = self.client.get(self.URL)
        self.assertEqual(reponse.status_code, 200)
        self.assertEqual(reponse.json(), {'nb_modeles': 4, 'nb_formations': 2})

    def test_seulement_les_formations_du_compte_connecte(self):
        autre = connecter(self.client, 'autre@organisme-b.fr')
        for i in range(3):
            creer_formation(autre, f'AUT-{i}')
        compte = connecter(self.client)
        creer_formation(compte, 'FOR-1')
        self.assertEqual(self.client.get(self.URL).json()['nb_formations'], 1)

    def test_formations_archivees_non_comptees(self):
        compte = connecter(self.client)
        creer_formation(compte, 'FOR-1', Formation.Statut.INCOMPLETE)
        creer_formation(compte, 'FOR-2', Formation.Statut.ARCHIVEE)
        self.assertEqual(self.client.get(self.URL).json()['nb_formations'], 1)

    def test_aucune_formation(self):
        connecter(self.client)
        self.assertEqual(self.client.get(self.URL).json(), {'nb_modeles': 4, 'nb_formations': 0})

    def test_log_metier_nombre_de_formations_sans_donnee_personnelle(self):
        compte = connecter(self.client, 'marie.dupont@organisme.fr')
        creer_formation(compte, 'FOR-1')
        with self.assertLogs('quali_formation.metier', level='INFO') as logs:
            self.client.get(self.URL)
        (ligne,) = logs.records
        self.assertEqual((ligne.layer, ligne.route, ligne.status), ('controller', 'modeles/resume', 200))
        self.assertEqual(getattr(ligne, 'resultat.nb_formations'), '1')
        self.assertNotIn('marie.dupont', json.dumps(ligne.__dict__, default=str))
