"""SCRUM-217 « Rétablir le modèle d'origine » : GET /modeles/<type>/origine et POST /modeles/<type>/reinitialiser
(RG5, RG6, RG8)."""

import json
import unittest

from django.test import Client, TestCase

from quali_formation.models import ModeleGenerique, ModeleOrigine
from quali_formation.tests import connecter, connecter_existant

ORIGINE = ModeleGenerique.Statut.ORIGINE
PERSONNALISE = ModeleGenerique.Statut.PERSONNALISE
IMPORTE = ModeleGenerique.Statut.IMPORTE
MA_VERSION = '<h1>Ma convocation</h1><p>Bonjour {{apprenant_prenom}}</p>'


class RetablirOrigineTests(TestCase):
    def setUp(self):
        self.compte = connecter(self.client)
        self.origine = ModeleOrigine.objects.get(type='CONVOCATION')

    def enregistrer(self, contenu=MA_VERSION, nom_fichier_importe=None):
        corps = {'contenu': contenu, 'nom_fichier_importe': nom_fichier_importe}
        reponse = self.client.put('/modeles/CONVOCATION', data=json.dumps(corps), content_type='application/json')
        self.assertEqual(reponse.status_code, 200)

    def retablir(self, type_modele='CONVOCATION'):
        return self.client.post(f'/modeles/{type_modele}/reinitialiser')

    def statut(self, type_modele='CONVOCATION'):
        return self.client.get(f'/modeles/{type_modele.lower()}').json()['statut']

    def test_ca1_le_modele_d_origine_s_affiche_meme_si_le_compte_a_sa_version(self):
        self.enregistrer()
        reponse = self.client.get('/modeles/convocation/origine')
        self.assertEqual(reponse.status_code, 200)
        corps = reponse.json()
        self.assertEqual((corps['type'], corps['nom'], corps['statut'], corps['contenu']),
                         ('CONVOCATION', self.origine.nom, ORIGINE, self.origine.contenu))
        self.assertTrue(corps['variables'])  # libellés des étiquettes du document
        self.assertTrue(all(v['libelle'] for v in corps['variables']))

    def test_ca2_voir_le_modele_d_origine_ne_modifie_pas_son_modele(self):
        # « Fermer » et « Voir ma version » n'appellent rien : seule la lecture de l'origine a eu lieu
        self.enregistrer()
        self.client.get('/modeles/convocation/origine')
        modele = self.client.get('/modeles/convocation').json()
        self.assertEqual((modele['statut'], modele['contenu']), (PERSONNALISE, MA_VERSION))

    def test_ca3_retablir_statut_origine_et_contenu_identique_a_l_origine(self):
        self.enregistrer()
        reponse = self.retablir()
        self.assertEqual(reponse.status_code, 200)
        corps = reponse.json()
        self.assertEqual((corps['statut'], corps['contenu'], corps['date_maj']), (ORIGINE, self.origine.contenu, None))
        modele = self.client.get('/modeles/convocation').json()
        self.assertEqual((modele['statut'], modele['contenu']), (ORIGINE, self.origine.contenu))
        self.assertFalse(ModeleGenerique.objects.filter(proprietaire=self.compte, type='CONVOCATION').exists())

    def test_ca3_retablir_mon_document_efface_le_nom_du_fichier_importe(self):
        self.enregistrer(nom_fichier_importe='Convocation Camille.docx')
        self.assertEqual(self.statut(), IMPORTE)
        corps = self.retablir().json()
        self.assertEqual((corps['statut'], corps['nom_fichier_importe']), (ORIGINE, None))
        self.assertIsNone(self.client.get('/modeles/convocation').json()['nom_fichier_importe'])

    def test_ca3_rg8_s_applique_sans_passer_par_enregistrer(self):
        # Un seul appel, sans PUT : le rétablissement est immédiat
        self.enregistrer()
        self.retablir()
        self.assertEqual(self.statut(), ORIGINE)

    def test_ca3_retablir_ne_touche_que_ce_document_et_ce_compte(self):
        self.enregistrer()
        ModeleGenerique.objects.create(proprietaire=self.compte, type='CONVENTION', contenu='<p>Ma convention</p>')
        autre = connecter(self.client, 'autre@organisme-b.fr')
        ModeleGenerique.objects.create(proprietaire=autre, type='CONVOCATION', contenu='<p>Sa convocation</p>')
        connecter_existant(self.client, self.compte)
        self.retablir()
        self.assertEqual(self.statut('CONVENTION'), PERSONNALISE)
        self.assertEqual(ModeleGenerique.objects.get(proprietaire=autre, type='CONVOCATION').contenu,
                         '<p>Sa convocation</p>')

    def test_rg6_retablir_puis_rouvrir_donne_l_origine_a_jour(self):
        # Sans modèle générique, le compte suit le modèle d'origine (et les formations sans leur propre modèle aussi)
        self.retablir()
        self.assertEqual(self.client.get('/modeles/convocation').json()['contenu'], self.origine.contenu)

    @unittest.skip('À compléter avec SCRUM-218 (modèles de la formation pas encore créés)')
    def test_ca4_rg5_le_modele_de_la_formation_ne_change_pas(self):
        # SCRUM-218 : créer un ModeleFormation de convocation pour une formation du compte, rétablir la convocation
        # d'origine, puis vérifier que son contenu et sa date de mise à jour sont inchangés.
        self.fail('ModeleFormation n’existe pas encore')

    def test_ca5_modele_jamais_modifie_deja_au_statut_origine(self):
        # Le lien « Rétablir » n'apparaît pas pour un modèle ORIGINE ; rétablir quand même ne change rien
        self.assertEqual(self.statut(), ORIGINE)
        self.assertEqual(self.retablir().json()['statut'], ORIGINE)

    def test_type_inconnu_404(self):
        self.assertEqual(self.retablir('INCONNU').status_code, 404)
        self.assertEqual(self.client.get('/modeles/inconnu/origine').status_code, 404)

    def test_non_connecte_401(self):
        self.enregistrer()
        anonyme = Client()
        self.assertEqual(anonyme.post('/modeles/CONVOCATION/reinitialiser').status_code, 401)
        self.assertEqual(anonyme.get('/modeles/convocation/origine').status_code, 401)
        self.assertEqual(self.statut(), PERSONNALISE)

    def test_get_sur_reinitialiser_refuse(self):
        self.assertEqual(self.client.get('/modeles/CONVOCATION/reinitialiser').status_code, 405)


class LogRetablirOrigineTests(TestCase):
    def setUp(self):
        self.compte = connecter(self.client, 'marie.dupont@organisme.fr')
        ModeleGenerique.objects.create(proprietaire=self.compte, type='CONVOCATION',
                                       contenu='<p>Bonjour Camille</p>', statut=ModeleGenerique.Statut.IMPORTE,
                                       nom_fichier_importe='Convocation Camille.docx')

    def test_log_info_modele_generique_retabli_organisme_et_type_seulement(self):
        with self.assertLogs('quali_formation.metier', level='INFO') as logs:
            self.client.post('/modeles/CONVOCATION/reinitialiser')
        (ligne,) = logs.records
        self.assertEqual((ligne.levelname, ligne.layer, ligne.getMessage()),
                         ('INFO', 'service', 'Modèle générique rétabli'))
        self.assertEqual((getattr(ligne, 'utilisateur.organisme_id'), ligne.type_modele),
                         (str(self.compte.organisme_id), 'CONVOCATION'))
        texte = json.dumps(ligne.__dict__, default=str)
        for interdit in ('marie.dupont', 'Camille', 'Bonjour', 'utilisateur.id"'):
            self.assertNotIn(interdit, texte)
