"""SCRUM-211 « Disposer de 4 modèles d'origine conformes à la réglementation » (RG1, RG3, RG12)."""

import json
from pathlib import Path

from django.test import TestCase

from quali_formation.models import ModeleGenerique, ModeleOrigine, TypeModele
from quali_formation.services import (
    dictionnaire_variables,
    modele_service,
    variables_du_contenu,
)
from quali_formation.tests import connecter

FICHIER_MODELES = Path(__file__).resolve().parent / 'donnees_modeles' / 'modeles-origine.json'
MODELES_FICHIER = json.loads(FICHIER_MODELES.read_text(encoding='utf-8'))
ORIGINE = ModeleGenerique.Statut.ORIGINE


class ModelesOrigineMigrationTests(TestCase):
    """Données chargées par la migration 0011 (la base de test applique toutes les migrations)."""

    def test_rg1_les_4_modeles_d_origine_existent_apres_migration(self):
        self.assertEqual(sorted(ModeleOrigine.objects.values_list('type', flat=True)), sorted(TypeModele.values))
        self.assertEqual(list(ModeleOrigine.objects.values_list('nom', flat=True)), [
            'Convention de formation', 'Contrat de formation', 'Convocation', 'Attestation de fin de formation'])

    def test_texte_charge_tel_quel_depuis_le_fichier(self):
        for modele in MODELES_FICHIER:
            origine = ModeleOrigine.objects.get(type=modele['type'])
            self.assertEqual(origine.contenu, modele['contenu_html'], modele['type'])
            self.assertEqual((origine.nom, origine.version), (modele['nom'], modele['version']))

    def test_ca3_chaque_variable_des_modeles_existe_dans_le_dictionnaire(self):
        dictionnaire = dictionnaire_variables()
        for origine in ModeleOrigine.objects.all():
            codes = variables_du_contenu(origine.contenu)
            self.assertTrue(codes, origine.type)
            self.assertEqual([c for c in codes if c not in dictionnaire], [], f'{origine.type} : variables inconnues')

    def test_aucune_adresse_e_mail_dans_les_modeles(self):
        # RGT3 : aucune donnée personnelle dans les fixtures
        for origine in ModeleOrigine.objects.all():
            self.assertNotRegex(origine.contenu, r'[\w.+-]+@[\w-]+\.\w+', origine.type)


class ModelesGeneriquesApiTests(TestCase):
    def test_sans_connexion_401(self):
        for url in ('/modeles/', '/modeles/CONVENTION'):
            reponse = self.client.get(url)
            self.assertEqual(reponse.status_code, 401, url)
            self.assertEqual(reponse.json()['code'], 'NON_CONNECTE')

    def test_ca1_nouveau_compte_voit_les_4_modeles_au_statut_origine(self):
        connecter(self.client)
        reponse = self.client.get('/modeles/')
        self.assertEqual(reponse.status_code, 200)
        self.assertEqual([(m['type'], m['statut']) for m in reponse.json()['modeles']], [
            ('CONVENTION', ORIGINE), ('CONTRAT', ORIGINE), ('CONVOCATION', ORIGINE), ('ATTESTATION', ORIGINE)])

    def test_ca2_modele_ouvert_texte_d_origine_et_libelles_des_variables(self):
        connecter(self.client)
        reponse = self.client.get('/modeles/convention')
        self.assertEqual(reponse.status_code, 200)
        modele = reponse.json()
        self.assertEqual((modele['type'], modele['nom'], modele['statut']), ('CONVENTION', 'Convention de formation', ORIGINE))
        self.assertEqual(modele['contenu'], ModeleOrigine.objects.get(type='CONVENTION').contenu)
        variables = {v['code']: v['libelle'] for v in modele['variables']}
        self.assertEqual(variables['org_nom'], dictionnaire_variables()['org_nom'])
        self.assertEqual(set(variables), set(variables_du_contenu(modele['contenu'])))

    def test_type_inconnu_404(self):
        connecter(self.client)
        reponse = self.client.get('/modeles/DEVIS')
        self.assertEqual(reponse.status_code, 404)
        self.assertEqual(reponse.json()['code'], 'MODELE_INTROUVABLE')

    def test_un_compte_ne_voit_pas_le_modele_d_un_autre(self):
        autre = connecter(self.client, 'autre@organisme-b.fr')
        modele_service.enregistrer(autre, 'CONVOCATION', '<p>Convocation du compte B</p>')
        connecter(self.client)
        self.assertEqual(self.client.get('/modeles/CONVOCATION').json()['statut'], ORIGINE)
        self.assertNotIn('compte B', self.client.get('/modeles/CONVOCATION').json()['contenu'])


class EnregistrerModeleTests(TestCase):
    def setUp(self):
        self.compte = connecter(self.client)
        self.origine = ModeleOrigine.objects.get(type='CONTRAT').contenu

    def test_ca4_rg12_mention_legale_supprimee_enregistree_sans_blocage(self):
        sans_mention = self.origine.replace('L6353', '')
        self.assertNotIn('L6353', sans_mention)
        with self.assertLogs('quali_formation.metier', level='INFO') as logs:
            modele = modele_service.enregistrer(self.compte, 'contrat', sans_mention)
        self.assertEqual((modele.contenu, modele.statut), (sans_mention, ModeleGenerique.Statut.PERSONNALISE))
        (ligne,) = logs.records
        self.assertEqual((ligne.levelname, getattr(ligne, 'resultat.statut')), ('INFO', 'PERSONNALISE'))

    def test_rg12_contenu_vide_ou_variable_inconnue_acceptes(self):
        for contenu in ('', '<p>{{variable_inconnue}}</p>'):
            self.assertEqual(modele_service.enregistrer(self.compte, 'CONTRAT', contenu).contenu, contenu)
        modele = modele_service.obtenir(self.compte, 'CONTRAT')
        self.assertEqual(modele['variables'], [{'code': 'variable_inconnue', 'libelle': 'variable_inconnue'}])

    def test_rg3_le_modele_d_origine_n_est_jamais_modifie(self):
        modele_service.enregistrer(self.compte, 'CONTRAT', '<p>Mon contrat</p>')
        modele_service.enregistrer(self.compte, 'CONTRAT', '<p>Mon contrat v2</p>')
        self.assertEqual(ModeleOrigine.objects.get(type='CONTRAT').contenu, self.origine)
        self.assertEqual(ModeleGenerique.objects.filter(proprietaire=self.compte, type='CONTRAT').count(), 1)
        statuts = {m['type']: m['statut'] for m in self.client.get('/modeles/').json()['modeles']}
        self.assertEqual(statuts, {'CONVENTION': ORIGINE, 'CONTRAT': 'PERSONNALISE', 'CONVOCATION': ORIGINE, 'ATTESTATION': ORIGINE})

    def test_type_inconnu_refuse(self):
        with self.assertRaises(Exception) as erreur:
            modele_service.enregistrer(self.compte, 'DEVIS', '<p>x</p>')
        self.assertEqual(erreur.exception.code, 'MODELE_INTROUVABLE')


class LogsModelesTests(TestCase):
    def test_ouvrir_un_modele_type_et_statut_sans_donnee_personnelle(self):
        connecter(self.client, 'marie.dupont@organisme.fr')
        with self.assertLogs('quali_formation.metier', level='INFO') as logs:
            self.client.get('/modeles/ATTESTATION')
        (ligne,) = logs.records
        self.assertEqual((ligne.route, ligne.status, ligne.type_modele), ('modeles/<str:type_modele>', 200, 'ATTESTATION'))
        self.assertEqual(getattr(ligne, 'resultat.statut'), 'ORIGINE')
        self.assertNotIn('marie.dupont', json.dumps(ligne.__dict__, default=str))

    def test_liste_non_journalisee(self):
        connecter(self.client)
        with self.assertNoLogs('quali_formation.metier'):
            self.client.get('/modeles/')


class AffichageAdminTests(TestCase):
    def test_noms_affiches(self):
        compte = connecter(self.client)
        self.assertEqual(str(ModeleOrigine.objects.get(type='CONVOCATION')), 'Convocation')
        self.assertEqual(str(modele_service.enregistrer(compte, 'CONVOCATION', '<p>x</p>')), 'CONVOCATION (PERSONNALISE)')
