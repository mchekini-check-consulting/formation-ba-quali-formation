"""SCRUM-218 « Dupliquer un modèle générique pour une formation » : GET /modeles/<type>/formations et
POST /formations/<id>/modeles/<type>/ (RG8, RG14, RG15, RG16, RG17, RG27)."""

import json
from unittest.mock import patch

from django.test import Client, TestCase

from quali_formation.models import (
    Formation,
    ModeleFormation,
    ModeleGenerique,
    ModeleOrigine,
)
from quali_formation.tests import connecter, connecter_existant

GENERIQUE = '<h1>Ma convocation</h1><p>Bonjour {{apprenant_prenom}}</p>'


class DupliquerFormationTests(TestCase):
    def setUp(self):
        self.compte = connecter(self.client)
        self.numero = 0

    def formation(self, intitule='Management d’équipe', statut=Formation.Statut.BROUILLON, proprietaire=None):
        self.numero += 1
        return Formation.objects.create(reference=f'F-{self.numero}', intitule=intitule, statut=statut,
                                        proprietaire=proprietaire or self.compte)

    def creer(self, formation, contenu=GENERIQUE, type_modele='CONVOCATION', nom_fichier_importe=None):
        corps = {'contenu': contenu}
        if nom_fichier_importe:
            corps['nom_fichier_importe'] = nom_fichier_importe
        return self.client.post(f'/formations/{formation.pk}/modeles/{type_modele}/', data=json.dumps(corps),
                                content_type='application/json')

    def proposees(self, type_modele='CONVOCATION'):
        return self.client.get(f'/modeles/{type_modele}/formations').json()

    def test_ca1_seules_les_formations_sans_modele_de_convocation_sont_proposees(self):
        management, excel = self.formation('Management d’équipe'), self.formation('Excel intermédiaire')
        ModeleFormation.objects.create(formation=management, type='CONVOCATION', contenu='<p>Sa convocation</p>')
        corps = self.proposees()
        self.assertEqual(corps['disponibles'], [{'id': excel.pk, 'intitule': 'Excel intermédiaire'}])
        self.assertEqual(corps['deja_crees'], [{'id': management.pk, 'intitule': 'Management d’équipe'}])
        # Un autre document : la formation est de nouveau proposée
        self.assertEqual(len(self.proposees('CONVENTION')['disponibles']), 2)

    def test_ca1_seules_les_formations_de_l_organisme_hors_archivees(self):
        valide = self.formation('Excel', Formation.Statut.VALIDEE)
        self.formation('Ancienne', Formation.Statut.ARCHIVEE)
        self.formation('Autre centre', proprietaire=connecter(self.client, 'autre@organisme-b.fr'))
        connecter_existant(self.client, self.compte)
        corps = self.proposees()
        self.assertEqual(([f['id'] for f in corps['disponibles']], corps['deja_crees']), ([valide.pk], []))

    def test_ca2_ca4_enregistrer_cree_le_modele_de_la_formation_201(self):
        formation = self.formation()
        reponse = self.creer(formation)
        self.assertEqual(reponse.status_code, 201)
        corps = reponse.json()
        self.assertEqual((corps['formation'], corps['type'], corps['nom'], corps['statut'], corps['contenu']),
                         ({'id': formation.pk, 'intitule': 'Management d’équipe'}, 'CONVOCATION', 'Convocation',
                          'FORMATION', GENERIQUE))
        modele = ModeleFormation.objects.get(formation=formation, type='CONVOCATION')
        self.assertEqual((modele.contenu, modele.nom_fichier_importe), (GENERIQUE, None))

    def test_ca3_rg8_quitter_sans_enregistrer_ne_cree_rien(self):
        # Ouvrir la fenêtre puis l'éditeur ne fait que lire : aucun POST, aucune ligne
        self.formation()
        self.proposees()
        self.client.get('/modeles/convocation')
        self.assertFalse(ModeleFormation.objects.exists())

    def test_ca5_rg16_formation_qui_a_deja_son_modele_plus_proposee_et_409(self):
        formation = self.formation()
        self.assertEqual(self.creer(formation).status_code, 201)
        self.assertEqual(self.proposees()['disponibles'], [])
        reponse = self.creer(formation, contenu='<p>Deuxième</p>')
        self.assertEqual(reponse.status_code, 409)
        self.assertEqual(reponse.json()['code'], 'MODELE_FORMATION_EXISTANT')
        self.assertEqual(ModeleFormation.objects.get(formation=formation).contenu, GENERIQUE)

    def test_ca6_rg17_modifier_ensuite_le_modele_generique_ne_change_pas_le_modele_de_la_formation(self):
        formation = self.formation()
        self.creer(formation)
        self.client.put('/modeles/CONVOCATION', data=json.dumps({'contenu': '<p>Nouvelle version générique</p>'}),
                        content_type='application/json')
        self.assertEqual(ModeleFormation.objects.get(formation=formation).contenu, GENERIQUE)

    def test_rg17_mon_document_reprend_le_nom_du_fichier_importe(self):
        formation = self.formation()
        corps = self.creer(formation, nom_fichier_importe='Convocation maison.docx').json()
        self.assertEqual(corps['nom_fichier_importe'], 'Convocation maison.docx')

    def test_rg15_le_modele_generique_ne_change_pas(self):
        self.creer(self.formation())
        self.assertFalse(ModeleGenerique.objects.exists())
        self.assertEqual(self.client.get('/modeles/convocation').json()['statut'], ModeleGenerique.Statut.ORIGINE)

    def test_formation_d_un_autre_organisme_404(self):
        autre = self.formation(proprietaire=connecter(self.client, 'autre@organisme-b.fr'))
        connecter_existant(self.client, self.compte)
        reponse = self.creer(autre)
        self.assertEqual((reponse.status_code, reponse.json()['code']), (404, 'FORMATION_INTROUVABLE'))
        self.assertEqual(self.client.post('/formations/999999/modeles/CONVOCATION/').status_code, 404)
        self.assertFalse(ModeleFormation.objects.exists())

    def test_document_inconnu_404(self):
        self.assertEqual(self.creer(self.formation(), type_modele='INCONNU').status_code, 404)
        self.assertEqual(self.client.get('/modeles/INCONNU/formations').status_code, 404)

    def test_formation_archivee_400(self):
        reponse = self.creer(self.formation(statut=Formation.Statut.ARCHIVEE))
        self.assertEqual((reponse.status_code, reponse.json()['code']), (400, 'FORMATION_ARCHIVEE'))

    def test_contenu_invalide_400(self):
        formation = self.formation()
        self.assertEqual(self.creer(formation, contenu=None).status_code, 400)
        reponse = self.client.post(f'/formations/{formation.pk}/modeles/CONVOCATION/',
                                   data=json.dumps({'contenu': '<p>x</p>', 'nom_fichier_importe': 12}),
                                   content_type='application/json')
        self.assertEqual(reponse.status_code, 400)
        self.assertFalse(ModeleFormation.objects.exists())

    def test_non_connecte_401(self):
        formation = self.formation()
        anonyme = Client()
        self.assertEqual(anonyme.get('/modeles/CONVOCATION/formations').status_code, 401)
        reponse = anonyme.post(f'/formations/{formation.pk}/modeles/CONVOCATION/', data=json.dumps({'contenu': 'x'}),
                               content_type='application/json')
        self.assertEqual(reponse.status_code, 401)

    def test_suppression_de_la_formation_supprime_ses_modeles(self):
        formation = self.formation()
        self.creer(formation)
        formation.delete()
        self.assertFalse(ModeleFormation.objects.exists())

    def test_origine_toujours_disponible(self):
        # Le modèle de la formation est une copie : le modèle d'origine n'est jamais écrit (RG3)
        origine = ModeleOrigine.objects.get(type='CONVOCATION').contenu
        self.creer(self.formation(), contenu='<p>Copie</p>')
        self.assertEqual(ModeleOrigine.objects.get(type='CONVOCATION').contenu, origine)


class CreationSimultaneeTests(TestCase):
    def test_rg16_la_contrainte_d_unicite_tranche_entre_deux_creations(self):
        compte = connecter(self.client)
        formation = Formation.objects.create(reference='F-1', intitule='Excel', proprietaire=compte)
        ModeleFormation.objects.create(formation=formation, type='CONVOCATION', contenu='<p>Déjà</p>')
        # La vérification préalable n'a pas vu le modèle (créé entre-temps) : la base refuse, réponse 409
        with patch('quali_formation.services.ModeleFormation.objects.filter') as filtre:
            filtre.return_value.exists.return_value = False
            reponse = self.client.post(f'/formations/{formation.pk}/modeles/CONVOCATION/',
                                       data=json.dumps({'contenu': '<p>x</p>'}), content_type='application/json')
        self.assertEqual(reponse.status_code, 409)


class LogDupliquerFormationTests(TestCase):
    def test_log_info_modele_de_la_formation_cree_organisme_formation_type_seulement(self):
        compte = connecter(self.client, 'marie.dupont@organisme.fr')
        formation = Formation.objects.create(reference='F-1', intitule='Management Camille', proprietaire=compte)
        with self.assertLogs('quali_formation.metier', level='INFO') as logs:
            self.client.post(f'/formations/{formation.pk}/modeles/CONVOCATION/',
                             data=json.dumps({'contenu': '<p>Bonjour Camille</p>', 'nom_fichier_importe': 'Camille.docx'}),
                             content_type='application/json')
        (ligne,) = logs.records
        self.assertEqual((ligne.levelname, ligne.layer, ligne.getMessage()),
                         ('INFO', 'service', 'Modèle de la formation créé'))
        self.assertEqual((getattr(ligne, 'utilisateur.organisme_id'), ligne.formation_id, ligne.type_modele),
                         (str(compte.organisme_id), str(formation.pk), 'CONVOCATION'))
        texte = json.dumps(ligne.__dict__, default=str)
        for interdit in ('marie.dupont', 'Camille', 'Bonjour', 'Management', 'utilisateur.id"'):
            self.assertNotIn(interdit, texte)
