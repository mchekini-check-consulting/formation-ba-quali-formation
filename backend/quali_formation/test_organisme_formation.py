"""Bloc « Informations de base » d'une formation : Organisme = centre du compte qui l'a créée,
« Préparée par » = prénom et nom de ce compte (plus les valeurs « Cap Compétences » / « Camille Laurent » du prototype)."""

from django.test import TestCase

from quali_formation.models import Formation
from quali_formation.tests import connecter, connecter_existant, creer_centre


class OrganismeEtAuteurFormationTests(TestCase):
    def setUp(self):
        self.compte = connecter(self.client)
        self.compte.organisme = creer_centre('Centre Test 112 A')
        self.compte.prenom, self.compte.nom = 'Marie', 'Arnaud'
        self.compte.save()

    def creer(self, **autres):
        corps = {'action': 'brouillon', 'modalite': 'PRESENTIEL', 'intitule': 'Excel', **autres}
        return self.client.post('/formations/', corps, content_type='application/json')

    def test_la_formation_creee_porte_le_centre_et_le_nom_du_compte_connecte(self):
        reponse = self.creer()
        self.assertEqual(reponse.status_code, 201)
        json = reponse.json()
        self.assertEqual((json['organisme'], json['preparee_par']), ('Centre Test 112 A', 'Marie Arnaud'))
        formation = Formation.objects.get(pk=json['id'])
        self.assertEqual((formation.organisme, formation.preparee_par), ('Centre Test 112 A', 'Marie Arnaud'))

    def test_les_valeurs_envoyees_par_l_ecran_sont_ignorees(self):
        json = self.creer(organisme='Cap Compétences', preparee_par='Camille Laurent').json()
        self.assertEqual((json['organisme'], json['preparee_par']), ('Centre Test 112 A', 'Marie Arnaud'))

    def test_une_formation_deja_enregistree_avec_les_valeurs_du_prototype_affiche_le_bon_centre(self):
        ancienne = Formation.objects.create(reference='FOR-2026-900', intitule='Word', proprietaire=self.compte,
                                            organisme='Cap Compétences', preparee_par='Camille Laurent')
        for json in (self.client.get(f'/formations/{ancienne.pk}/').json(), self.client.get('/formations/').json()[0]):
            self.assertEqual((json['organisme'], json['preparee_par']), ('Centre Test 112 A', 'Marie Arnaud'))

    def test_la_modification_garde_l_auteur_de_la_formation(self):
        # Un autre compte du même centre modifie la formation : « Préparée par » reste celle qui l'a créée
        pk = self.creer().json()['id']
        collegue = connecter(self.client, 'paul@organisme.fr')
        collegue.organisme, collegue.prenom, collegue.nom = self.compte.organisme, 'Paul', 'Durand'
        collegue.save()
        connecter_existant(self.client, collegue)
        corps = {'action': 'brouillon', 'modalite': 'PRESENTIEL', 'intitule': 'Excel avancé', 'preparee_par': 'Paul Durand'}
        json = self.client.put(f'/formations/{pk}/', corps, content_type='application/json').json()
        self.assertEqual((json['intitule'], json['preparee_par']), ('Excel avancé', 'Marie Arnaud'))
        self.assertEqual(Formation.objects.get(pk=pk).preparee_par, 'Marie Arnaud')
