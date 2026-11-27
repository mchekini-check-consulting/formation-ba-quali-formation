"""SCRUM-219 « Consulter et rétablir les modèles d'une formation » : GET /modeles/formations/,
GET /formations/<id>/modeles/, GET / PUT / DELETE /formations/<id>/modeles/<type>/ (RG7, RG18, RG19, RG22, RG27)."""

import json

from django.test import Client, TestCase

from quali_formation.models import (
    Formation,
    ModeleFormation,
    ModeleGenerique,
    ModeleOrigine,
)
from quali_formation.tests import connecter, connecter_existant

SIENNE = '<h1>Convocation Excel</h1><p>Bonjour {{apprenant_prenom}}</p>'


class ModelesFormationTests(TestCase):
    def setUp(self):
        self.compte = connecter(self.client)
        self.numero = 0
        self.excel = self.formation('Excel intermédiaire')

    def formation(self, intitule, statut=Formation.Statut.BROUILLON, proprietaire=None):
        self.numero += 1
        return Formation.objects.create(reference=f'F-{self.numero}', intitule=intitule, statut=statut,
                                        proprietaire=proprietaire or self.compte)

    def modele(self, formation=None, type_modele='CONVOCATION', contenu=SIENNE):
        return ModeleFormation.objects.create(formation=formation or self.excel, type=type_modele, contenu=contenu)

    def url(self, formation=None, type_modele='CONVOCATION'):
        return f'/formations/{(formation or self.excel).pk}/modeles/{type_modele}/'

    def dossier(self, formation=None):
        return self.client.get(f'/formations/{(formation or self.excel).pk}/modeles/')

    def put(self, corps, formation=None):
        return self.client.put(self.url(formation), data=json.dumps(corps), content_type='application/json')

    # ---- « Modèles par formation » ----

    def test_ca3_liste_nombre_de_modeles_de_chaque_formation(self):
        agile = self.formation('Gestion de projet agile')
        self.modele()
        corps = self.client.get('/modeles/formations/').json()
        self.assertEqual(corps['formations'], [
            {'id': self.excel.pk, 'intitule': 'Excel intermédiaire', 'nb_modeles': 1},
            {'id': agile.pk, 'intitule': 'Gestion de projet agile', 'nb_modeles': 0},
        ])

    def test_liste_seulement_l_organisme_et_hors_archivees(self):
        self.formation('Ancienne', Formation.Statut.ARCHIVEE)
        self.formation('Autre centre', proprietaire=connecter(self.client, 'autre@organisme-b.fr'))
        connecter_existant(self.client, self.compte)
        intitules = [f['intitule'] for f in self.client.get('/modeles/formations/').json()['formations']]
        self.assertEqual(intitules, ['Excel intermédiaire'])

    # ---- Dossier d'une formation ----

    def test_ca1_dossier_sans_modele_de_la_formation(self):
        corps = self.dossier().json()
        self.assertEqual(corps['formation'], {'id': self.excel.pk, 'intitule': 'Excel intermédiaire'})
        self.assertEqual(corps['modeles'], [])
        self.assertEqual([d['nom'] for d in corps['generiques_appliques']],
                         ['Convention de formation', 'Contrat de formation', 'Convocation', 'Attestation de fin de formation'])

    def test_ca2_rg18_modele_de_convocation_statut_formation_et_3_autres_documents(self):
        self.modele()
        corps = self.dossier().json()
        (modele,) = corps['modeles']
        self.assertEqual((modele['type'], modele['nom'], modele['statut'], modele['contenu']),
                         ('CONVOCATION', 'Convocation', 'FORMATION', SIENNE))
        self.assertEqual(modele['variables'], [{'code': 'apprenant_prenom', 'libelle': 'Prénom'}])
        self.assertEqual([d['nom'] for d in corps['generiques_appliques']],
                         ['Convention de formation', 'Contrat de formation', 'Attestation de fin de formation'])

    # ---- Éditeur d'un modèle de la formation ----

    def test_rg7_ouvrir_le_modele_de_la_formation(self):
        self.modele()
        reponse = self.client.get(self.url())
        self.assertEqual(reponse.status_code, 200)
        corps = reponse.json()
        self.assertEqual((corps['formation'], corps['statut'], corps['contenu']),
                         ({'id': self.excel.pk, 'intitule': 'Excel intermédiaire'}, 'FORMATION', SIENNE))

    def test_ouvrir_un_document_sans_modele_de_la_formation_404(self):
        reponse = self.client.get(self.url())
        self.assertEqual((reponse.status_code, reponse.json()['code']), (404, 'MODELE_INTROUVABLE'))

    def test_put_enregistre_le_modele_de_la_formation_sans_toucher_au_generique(self):
        self.modele()
        reponse = self.put({'contenu': '<p>Modifiée</p>'})
        self.assertEqual(reponse.status_code, 200)
        self.assertEqual(reponse.json()['contenu'], '<p>Modifiée</p>')
        self.assertEqual(ModeleFormation.objects.get(formation=self.excel).contenu, '<p>Modifiée</p>')
        self.assertFalse(ModeleGenerique.objects.exists())

    def test_put_import_word_puis_retouche_garde_le_nom_du_fichier(self):
        self.modele()
        self.put({'contenu': '<p>Word</p>', 'nom_fichier_importe': 'Convocation Excel.docx'})
        corps = self.put({'contenu': '<p>Word retouché</p>'}).json()
        self.assertEqual(corps['nom_fichier_importe'], 'Convocation Excel.docx')

    def test_put_contenu_invalide_400(self):
        self.modele()
        self.assertEqual(self.put({'contenu': None}).status_code, 400)
        self.assertEqual(ModeleFormation.objects.get(formation=self.excel).contenu, SIENNE)

    def test_put_sans_modele_de_la_formation_404(self):
        self.assertEqual(self.put({'contenu': '<p>x</p>'}).status_code, 404)
        self.assertFalse(ModeleFormation.objects.exists())

    def test_telecharger_le_modele_de_la_formation_en_word(self):
        self.modele()
        reponse = self.client.get(f'/formations/{self.excel.pk}/modeles/CONVOCATION/export.docx')
        self.assertEqual(reponse.status_code, 200)
        self.assertIn('Mod%C3%A8le%20-%20Convocation.docx', reponse['Content-Disposition'])
        self.assertEqual(self.client.get(f'/formations/{self.excel.pk}/modeles/CONTRAT/export.docx').status_code, 404)

    # ---- Rétablir le modèle générique (RG19) ----

    def test_ca4_rg19_delete_puis_la_formation_utilise_de_nouveau_le_modele_generique(self):
        self.modele()
        reponse = self.client.delete(self.url())
        self.assertEqual(reponse.status_code, 204)
        corps = self.dossier().json()
        self.assertEqual(corps['modeles'], [])
        self.assertIn('Convocation', [d['nom'] for d in corps['generiques_appliques']])
        self.assertEqual(self.client.get('/modeles/formations/').json()['formations'][0]['nb_modeles'], 0)
        # La formation est de nouveau proposée pour « Dupliquer » (SCRUM-218)
        self.assertEqual([f['id'] for f in self.client.get('/modeles/CONVOCATION/formations').json()['disponibles']],
                         [self.excel.pk])

    def test_ca5_sans_delete_rien_ne_change(self):
        # « Annuler » n'envoie rien : le modèle de la formation reste
        self.modele()
        self.dossier()
        self.assertEqual(ModeleFormation.objects.get(formation=self.excel).contenu, SIENNE)

    def test_delete_ne_supprime_que_ce_document_de_cette_formation(self):
        agile = self.formation('Agile')
        self.modele()
        self.modele(type_modele='CONVENTION')
        self.modele(formation=agile)
        self.client.delete(self.url())
        restants = sorted(ModeleFormation.objects.values_list('formation__intitule', 'type'))
        self.assertEqual(restants, [('Agile', 'CONVOCATION'), ('Excel intermédiaire', 'CONVENTION')])

    def test_delete_sans_modele_de_la_formation_404(self):
        self.assertEqual(self.client.delete(self.url()).status_code, 404)

    # ---- Sécurité ----

    def test_formation_d_un_autre_organisme_404(self):
        autre = self.formation('Autre centre', proprietaire=connecter(self.client, 'autre@organisme-b.fr'))
        self.modele(formation=autre)
        connecter_existant(self.client, self.compte)
        self.assertEqual(self.dossier(autre).status_code, 404)
        self.assertEqual(self.client.get(self.url(autre)).status_code, 404)
        self.assertEqual(self.put({'contenu': '<p>x</p>'}, autre).status_code, 404)
        self.assertEqual(self.client.delete(self.url(autre)).status_code, 404)
        self.assertEqual(self.client.get(f'/formations/{autre.pk}/modeles/CONVOCATION/export.docx').status_code, 404)
        self.assertEqual(ModeleFormation.objects.get(formation=autre).contenu, SIENNE)

    def test_document_inconnu_404(self):
        self.assertEqual(self.client.get(self.url(type_modele='INCONNU')).status_code, 404)

    def test_non_connecte_401(self):
        self.modele()
        anonyme = Client()
        for reponse in (anonyme.get('/modeles/formations/'), anonyme.get(f'/formations/{self.excel.pk}/modeles/'),
                        anonyme.get(self.url()), anonyme.delete(self.url()),
                        anonyme.put(self.url(), data='{}', content_type='application/json')):
            self.assertEqual(reponse.status_code, 401)
        self.assertTrue(ModeleFormation.objects.exists())

    # ---- RG5, RG17 : le modèle générique et le modèle de la formation sont indépendants ----

    def test_rg5_rg17_modifier_puis_retablir_le_generique_ne_change_pas_le_modele_de_la_formation(self):
        sienne = self.modele()
        self.client.put('/modeles/CONVOCATION', data=json.dumps({'contenu': '<p>Générique modifié</p>'}),
                        content_type='application/json')
        self.client.post('/modeles/CONVOCATION/reinitialiser')
        apres = ModeleFormation.objects.get(pk=sienne.pk)
        self.assertEqual((apres.contenu, apres.date_maj), (SIENNE, sienne.date_maj))

    # ---- RG6 : message après « Enregistrer » un modèle générique ----

    def test_rg6_les_formations_avec_leur_propre_modele_n_utilisent_pas_le_generique(self):
        self.formation('Agile')
        self.formation('Ancienne', Formation.Statut.ARCHIVEE)
        self.modele()
        corps = self.client.put('/modeles/CONVOCATION', data=json.dumps({'contenu': '<p>Nouvelle</p>'}),
                                content_type='application/json').json()
        self.assertEqual((corps['nb_formations_utilisant'], corps['nb_formations']), (1, 2))
        # Un autre document : toutes l'utilisent
        corps = self.client.put('/modeles/CONVENTION', data=json.dumps({'contenu': '<p>Nouvelle</p>'}),
                                content_type='application/json').json()
        self.assertEqual((corps['nb_formations_utilisant'], corps['nb_formations']), (2, 2))

    def test_origine_jamais_ecrite(self):
        origine = ModeleOrigine.objects.get(type='CONVOCATION').contenu
        self.modele()
        self.put({'contenu': '<p>Modifiée</p>'})
        self.client.delete(self.url())
        self.assertEqual(ModeleOrigine.objects.get(type='CONVOCATION').contenu, origine)


class LogModelesFormationTests(TestCase):
    def setUp(self):
        self.compte = connecter(self.client, 'marie.dupont@organisme.fr')
        self.formation = Formation.objects.create(reference='F-1', intitule='Management Camille', proprietaire=self.compte)
        ModeleFormation.objects.create(formation=self.formation, type='CONVOCATION', contenu='<p>Bonjour Camille</p>')
        self.url = f'/formations/{self.formation.pk}/modeles/CONVOCATION/'

    def verifier(self, ligne, message):
        self.assertEqual((ligne.levelname, ligne.layer, ligne.getMessage()), ('INFO', 'service', message))
        self.assertEqual((getattr(ligne, 'utilisateur.organisme_id'), ligne.formation_id, ligne.type_modele),
                         (str(self.compte.organisme_id), str(self.formation.pk), 'CONVOCATION'))
        texte = json.dumps(ligne.__dict__, default=str)
        for interdit in ('marie.dupont', 'Camille', 'Bonjour', 'Management', 'utilisateur.id"'):
            self.assertNotIn(interdit, texte)

    def test_log_info_modele_de_la_formation_modifie(self):
        with self.assertLogs('quali_formation.metier', level='INFO') as logs:
            self.client.put(self.url, data=json.dumps({'contenu': '<p>Bonjour Camille, modifié</p>'}),
                            content_type='application/json')
        (ligne,) = logs.records
        self.verifier(ligne, 'Modèle de la formation modifié')

    def test_log_info_modele_de_la_formation_retabli_supprime(self):
        with self.assertLogs('quali_formation.metier', level='INFO') as logs:
            self.client.delete(self.url)
        (ligne,) = logs.records
        self.verifier(ligne, 'Modèle de la formation rétabli (supprimé)')

    def test_pas_de_log_pour_les_lectures(self):
        with self.assertNoLogs('quali_formation.metier', level='INFO'):
            self.client.get('/modeles/formations/')
            self.client.get(f'/formations/{self.formation.pk}/modeles/')
            self.client.get(self.url)
