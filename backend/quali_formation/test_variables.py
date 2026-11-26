"""SCRUM-214 « Insérer des variables dans un modèle » : table Variable, GET /variables/ (RG9, RG10)."""

import json
from pathlib import Path

from django.test import TestCase

from quali_formation.models import ModeleGenerique, ModeleOrigine, Variable
from quali_formation.services import dictionnaire_variables, variable_service
from quali_formation.tests import connecter

FICHIER = Path(__file__).resolve().parent / 'donnees_modeles' / 'variables.json'
RG10 = ['Session', 'Formation', 'Apprenant', 'Client', 'Prix', 'Fin de formation', 'Document', 'Organisme']


class VariablesMigrationTests(TestCase):
    """Données chargées par la migration 0014 (la base de test applique toutes les migrations)."""

    def test_les_66_variables_du_fichier_sont_en_base(self):
        fichier = json.loads(FICHIER.read_text(encoding='utf-8'))
        self.assertEqual(Variable.objects.count(), len(fichier))
        for v in fichier:
            variable = Variable.objects.get(code=v['code'])
            self.assertEqual((variable.libelle, variable.categorie, variable.ordre, variable.exemple),
                             (v['libelle'], v['categorie'], v['ordre'], v['exemple']), v['code'])

    def test_chaque_variable_des_modeles_d_origine_existe(self):
        codes = set(Variable.objects.values_list('code', flat=True))
        for origine in ModeleOrigine.objects.all():
            for code in json.dumps(origine.contenu).split('{{')[1:]:
                self.assertIn(code.split('}}')[0].strip(), codes, origine.type)

    def test_libelles_lus_dans_la_table(self):
        self.assertEqual(dictionnaire_variables()['session_date_debut'], 'Date de début')
        Variable.objects.filter(code='session_date_debut').update(libelle='Premier jour')
        self.assertEqual(dictionnaire_variables()['session_date_debut'], 'Premier jour')
        self.assertEqual(str(Variable.objects.get(code='org_nom')), 'org_nom')


class ListerVariablesTests(TestCase):
    def lister(self):
        reponse = self.client.get('/variables/')
        self.assertEqual(reponse.status_code, 200)
        return reponse.json()

    def test_sans_connexion_401(self):
        reponse = self.client.get('/variables/')
        self.assertEqual(reponse.status_code, 401)
        self.assertEqual(reponse.json()['code'], 'NON_CONNECTE')

    def test_ca1_rg10_categories_dans_l_ordre(self):
        connecter(self.client)
        variables = self.lister()
        self.assertEqual(list(dict.fromkeys(v['categorie'] for v in variables)), RG10)
        self.assertEqual(set(variables[0]), {'code', 'libelle', 'categorie', 'exemple'})
        self.assertEqual(variables[0], {'code': 'session_date_debut', 'libelle': 'Date de début',
                                        'categorie': 'Session', 'exemple': '12/01/2027'})

    def test_rg10_tri_fait_par_le_backend_quel_que_soit_l_ordre_en_base(self):
        # Ordre d'insertion inversé : le tri ne dépend que de la catégorie (RG10) puis de l'ordre
        Variable.objects.all().delete()
        for code, categorie, ordre in [('org_b', 'Organisme', 2), ('org_a', 'Organisme', 1), ('doc', 'Document', 1),
                                       ('prix', 'Prix', 1), ('session', 'Session', 1)]:
            Variable.objects.create(code=code, libelle=code, categorie=categorie, ordre=ordre)
        self.assertEqual([v['code'] for v in variable_service.lister()], ['session', 'prix', 'doc', 'org_a', 'org_b'])

    def test_simple_lecture_sans_log_metier(self):
        connecter(self.client)
        with self.assertNoLogs('quali_formation.metier'):
            self.lister()


class EnregistrerVariablesTests(TestCase):
    def test_ca5_rg9_variable_enregistree_sous_son_code_jamais_sa_valeur(self):
        compte = connecter(self.client)
        contenu = '<p>Session du {{session_date_debut}} pour {{apprenant_prenom}}</p>'
        reponse = self.client.put('/modeles/CONVOCATION', data=json.dumps({'contenu': contenu}),
                                  content_type='application/json')
        self.assertEqual(reponse.status_code, 200)
        enregistre = ModeleGenerique.objects.get(proprietaire=compte, type='CONVOCATION').contenu
        self.assertEqual(enregistre, contenu)
        for exemple in Variable.objects.filter(code__in=['session_date_debut', 'apprenant_prenom']).values_list('exemple', flat=True):
            self.assertNotIn(exemple, enregistre)

    def test_variable_inconnue_gardee_avec_son_code_comme_libelle(self):
        connecter(self.client)
        contenu = '<p>{{variable_inconnue}} et {{session_lieu}}</p>'
        self.client.put('/modeles/CONTRAT', data=json.dumps({'contenu': contenu}), content_type='application/json')
        modele = self.client.get('/modeles/CONTRAT').json()
        self.assertEqual(modele['contenu'], contenu)
        self.assertEqual(modele['variables'], [{'code': 'variable_inconnue', 'libelle': 'variable_inconnue'},
                                               {'code': 'session_lieu', 'libelle': 'Lieu'}])
