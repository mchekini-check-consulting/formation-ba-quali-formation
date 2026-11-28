"""SCRUM-179 « Gérer les apprenants de la session » : GET / POST /sessions/<id>/apprenants/,
DELETE /sessions/<id>/apprenants/<apprenant_id>/."""

from datetime import date

from django.test import TestCase

from quali_formation.models import Apprenant, Entreprise, Formation, Session
from quali_formation.tests import connecter


class ApprenantsSessionTests(TestCase):
    def setUp(self):
        self.compte = connecter(self.client)
        org = self.compte.organisme
        formation = Formation.objects.create(reference='F-1', intitule='Excel avancé', proprietaire=self.compte)
        leroy = Entreprise.objects.create(organisme=org, raison_sociale='Atelier Leroy', siret='12345678900011')

        def apprenant(prenom, nom, **autres):
            return Apprenant.objects.create(organisme=org, prenom=prenom, nom=nom,
                                            email=f'{prenom.lower()}@exemple.fr', **autres)

        self.sophie = apprenant('Sophie', 'Leroy', statut='SALARIE', entreprise_cliente=leroy, poste='Gérante')
        self.thomas = apprenant('Thomas', 'Petit', statut='DEMANDEUR_EMPLOI')
        self.camille = apprenant('Camille', 'Martin', entreprise='Ancienne SARL')
        self.karim = apprenant('Karim', 'Benali', statut='INDEPENDANT')
        self.hugo = apprenant('Hugo', 'Weber')
        self.session = Session.objects.create(formation=formation, date_debut=date(2026, 12, 3), date_fin=date(2026, 12, 5),
                                              lieu='Lyon', nombre_places=4)
        self.session.apprenants.set([self.sophie, self.thomas, self.camille])

    def url(self, suite=''):
        return f'/sessions/{self.session.pk}/apprenants/{suite}'

    def ajouter(self, *apprenants):
        return self.client.post(self.url(), {'apprenants': [a.pk for a in apprenants]}, content_type='application/json')

    def noms(self, reponse):
        return [a['nom'] for a in reponse.json()['apprenants']]

    def test_liste_des_inscrits_avec_entreprise_ou_individuel(self):
        reponse = self.client.get(self.url())
        self.assertEqual(reponse.status_code, 200)
        self.assertEqual(reponse.json()['nombre_places'], 4)
        self.assertEqual(reponse.json()['apprenants'], [
            {'id': self.sophie.pk, 'prenom': 'Sophie', 'nom': 'Leroy', 'email': 'sophie@exemple.fr', 'statut': 'SALARIE',
             'entreprise': 'Atelier Leroy', 'poste': 'Gérante'},
            {'id': self.camille.pk, 'prenom': 'Camille', 'nom': 'Martin', 'email': 'camille@exemple.fr', 'statut': '',
             'entreprise': 'Ancienne SARL', 'poste': ''},
            {'id': self.thomas.pk, 'prenom': 'Thomas', 'nom': 'Petit', 'email': 'thomas@exemple.fr',
             'statut': 'DEMANDEUR_EMPLOI', 'entreprise': '', 'poste': ''},
        ])

    def test_ajout_dans_la_limite_des_places(self):
        reponse = self.ajouter(self.karim)
        self.assertEqual(reponse.status_code, 201)
        self.assertEqual(self.noms(reponse), ['Benali', 'Leroy', 'Martin', 'Petit'])
        self.assertEqual(self.session.apprenants.count(), 4)

    def test_ajout_d_un_apprenant_deja_inscrit_ignore(self):
        reponse = self.ajouter(self.sophie, self.karim)
        self.assertEqual((reponse.status_code, len(reponse.json()['apprenants'])), (201, 4))

    def test_depassement_des_places_400_rien_n_est_ajoute(self):
        reponse = self.ajouter(self.karim, self.hugo)
        self.assertEqual((reponse.status_code, reponse.json()['code']), (400, 'TROP_APPRENANTS'))
        self.assertEqual(reponse.json()['detail'], 'Trop d’apprenants : 2 cochés pour 1 place restante.')
        self.assertEqual(self.session.apprenants.count(), 3)

    def test_session_sans_nombre_de_places_sans_limite(self):
        self.session.nombre_places = None
        self.session.save()
        self.assertEqual(self.ajouter(self.karim, self.hugo).status_code, 201)
        self.assertEqual(self.session.apprenants.count(), 5)

    def test_apprenant_d_un_autre_centre_refuse(self):
        etranger = Apprenant.objects.create(prenom='Eva', nom='Blanc', email='e@exemple.fr')
        reponse = self.ajouter(etranger)
        self.assertEqual((reponse.status_code, reponse.json()['code']), (400, 'PERSONNE_INTROUVABLE'))

    def test_liste_vide_refusee(self):
        reponse = self.client.post(self.url(), {'apprenants': []}, content_type='application/json')
        self.assertEqual(reponse.status_code, 400)

    def test_retrait(self):
        reponse = self.client.delete(self.url(f'{self.sophie.pk}/'))
        self.assertEqual(reponse.status_code, 200)
        self.assertEqual(self.noms(reponse), ['Martin', 'Petit'])
        self.assertTrue(Apprenant.objects.filter(pk=self.sophie.pk).exists())  # retiré de la session, pas supprimé

    def test_retrait_du_dernier_apprenant_400(self):
        self.session.apprenants.set([self.sophie])
        reponse = self.client.delete(self.url(f'{self.sophie.pk}/'))
        self.assertEqual((reponse.status_code, reponse.json()['code']), (400, 'DERNIER_APPRENANT'))
        self.assertEqual(self.session.apprenants.count(), 1)

    def test_retrait_d_un_apprenant_non_inscrit_404(self):
        reponse = self.client.delete(self.url(f'{self.karim.pk}/'))
        self.assertEqual((reponse.status_code, reponse.json()['code']), (404, 'APPRENANT_INTROUVABLE'))

    def test_session_d_un_autre_centre_404(self):
        connecter(self.client, 'autre@organisme.fr')
        for reponse in (self.client.get(self.url()), self.ajouter(self.karim),
                        self.client.delete(self.url(f'{self.sophie.pk}/'))):
            self.assertEqual((reponse.status_code, reponse.json()['code']), (404, 'SESSION_INTROUVABLE'))
        self.assertEqual(self.session.apprenants.count(), 3)

    def test_session_inexistante_404(self):
        reponse = self.client.get('/sessions/999999/apprenants/')
        self.assertEqual((reponse.status_code, reponse.json()['code']), (404, 'SESSION_INTROUVABLE'))

    def test_non_connecte_401(self):
        self.client.logout()
        self.assertEqual(self.client.get(self.url()).status_code, 401)
