"""SCRUM-212 « Consulter les modèles génériques » : GET /modeles/ (RG4, RG7, RG13)."""

from django.test import TestCase

from quali_formation.models import ModeleGenerique, ModeleOrigine
from quali_formation.services import modele_service
from quali_formation.tests import connecter, connecter_existant

Statut = ModeleGenerique.Statut
TYPES = ['CONVENTION', 'CONTRAT', 'CONVOCATION', 'ATTESTATION']


class ConsulterModelesGeneriquesTests(TestCase):
    def setUp(self):
        self.compte = connecter(self.client)

    def lister(self):
        reponse = self.client.get('/modeles/')
        self.assertEqual(reponse.status_code, 200)
        return reponse.json()

    def par_type(self):
        return {m['type']: m for m in self.lister()['modeles']}

    def test_sans_connexion_401(self):
        self.client.logout()
        reponse = self.client.get('/modeles/')
        self.assertEqual(reponse.status_code, 401)
        self.assertEqual(reponse.json()['code'], 'NON_CONNECTE')

    def test_ca1_les_4_cartes_avec_contenu_nom_statut_et_variables(self):
        modeles = self.lister()['modeles']
        self.assertEqual([m['type'] for m in modeles], TYPES)
        for modele in modeles:
            self.assertEqual(set(modele), {'type', 'nom', 'statut', 'contenu', 'date_maj', 'variables'})
            # Miniature : le contenu réel du document et le libellé de ses variables
            self.assertEqual(modele['contenu'], ModeleOrigine.objects.get(type=modele['type']).contenu)
            self.assertTrue(modele['variables'], modele['type'])
            self.assertTrue(all(v['libelle'] for v in modele['variables']))

    def test_ca2_modele_modifie_dans_l_editeur_statut_personnalise(self):
        modele_service.enregistrer(self.compte, 'CONTRAT', '<p>Mon contrat {{org_nom}}</p>')
        contrat = self.par_type()['CONTRAT']
        self.assertEqual(contrat['statut'], Statut.PERSONNALISE)
        self.assertEqual(contrat['contenu'], '<p>Mon contrat {{org_nom}}</p>')
        self.assertIsNotNone(contrat['date_maj'])

    def test_ca2_document_word_importe_statut_mon_document(self):
        ModeleGenerique.objects.create(proprietaire=self.compte, type='CONVOCATION', contenu='<p>Ma convocation</p>',
                                       statut=Statut.IMPORTE, nom_fichier_importe='convocation.docx')
        self.assertEqual(self.par_type()['CONVOCATION']['statut'], Statut.IMPORTE)

    def test_ca3_modele_jamais_modifie_statut_modele_d_origine_sans_date(self):
        modele_service.enregistrer(self.compte, 'CONTRAT', '<p>Mon contrat</p>')
        modeles = self.par_type()
        for type_modele in ('CONVENTION', 'CONVOCATION', 'ATTESTATION'):
            self.assertEqual((modeles[type_modele]['statut'], modeles[type_modele]['date_maj']), (Statut.ORIGINE, None))

    def test_rg4_statut_d_un_autre_compte_jamais_visible(self):
        autre = connecter(self.client, 'autre@organisme-b.fr')
        modele_service.enregistrer(autre, 'ATTESTATION', '<p>Attestation du compte B</p>')
        connecter_existant(self.client, self.compte)  # retour sur le compte sans modèle modifié
        self.assertEqual({m['statut'] for m in self.lister()['modeles']}, {Statut.ORIGINE})

    def test_rg13_retiree_plus_d_information_pour_le_message_orange(self):
        # L'organisme renseigne ses informations à sa première connexion : plus de message « Pensez à remplir… »
        self.assertEqual(set(self.lister()), {'modeles'})

    def test_simple_lecture_sans_log_metier(self):
        with self.assertNoLogs('quali_formation.metier'):
            self.lister()
