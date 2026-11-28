"""SCRUM-168 « Naviguer dans la fiche session » : GET /sessions/<id>/ (en-tête et nombres des onglets)."""

from datetime import date

from django.test import TestCase

from quali_formation.models import Apprenant, Entreprise, Formateur, Formation, Session
from quali_formation.tests import connecter


class FicheSessionTests(TestCase):
    def setUp(self):
        self.compte = connecter(self.client)
        org = self.compte.organisme
        self.formation = Formation.objects.create(reference='F-1', intitule='Excel avancé', proprietaire=self.compte)
        leroy = Entreprise.objects.create(organisme=org, raison_sociale='Atelier Leroy', siret='12345678900011')
        durand = Entreprise.objects.create(organisme=org, raison_sociale='Société Durand', siret='98765432100021')
        apprenants = [
            Apprenant.objects.create(organisme=org, prenom='Paul', nom='Garnier', email='p@exemple.fr',
                                     entreprise_cliente=durand),
            Apprenant.objects.create(organisme=org, prenom='Inès', nom='Moreau', email='i@exemple.fr',
                                     entreprise_cliente=leroy),
            Apprenant.objects.create(organisme=org, prenom='Léa', nom='Roux', email='l@exemple.fr',
                                     entreprise_cliente=leroy),
        ]
        self.session = Session.objects.create(formation=self.formation, date_debut=date(2026, 12, 3),
                                              date_fin=date(2026, 12, 5), modalite='PRESENTIEL', lieu='Lyon',
                                              nombre_places=8)
        self.session.apprenants.set(apprenants)
        self.session.formateurs.add(Formateur.objects.create(organisme=org, prenom='Nadia', nom='Haddad',
                                                             email='n@exemple.fr'))

    def lire(self, pk=None):
        return self.client.get(f'/sessions/{pk or self.session.pk}/')

    def test_cas_nominal_en_tete_et_nombres_des_onglets(self):
        reponse = self.lire()
        self.assertEqual(reponse.status_code, 200)
        self.assertEqual(reponse.json(), {
            'id': self.session.pk, 'formation_intitule': 'Excel avancé',
            'date_debut': '2026-12-03', 'date_fin': '2026-12-05', 'modalite': 'PRESENTIEL', 'lieu': 'Lyon',
            'nombre_places': 8,
            'formateurs': [{'id': self.session.formateurs.get().pk, 'prenom': 'Nadia', 'nom': 'Haddad'}],
            'entreprises': ['Atelier Leroy', 'Société Durand'],
            'nombre_apprenants': 3, 'nombre_formateurs': 1, 'nombre_entreprises': 2, 'nombre_jours': 3,
        })

    def test_distanciel_sans_entreprise_et_nom_saisi_des_anciens_apprenants(self):
        org = self.compte.organisme
        session = Session.objects.create(formation=self.formation, date_debut=date(2026, 12, 10),
                                         date_fin=date(2026, 12, 10), modalite='DISTANCIEL', nombre_places=6)
        session.apprenants.set([
            Apprenant.objects.create(organisme=org, prenom='Ana', nom='Lopez', email='a@exemple.fr'),
            Apprenant.objects.create(organisme=org, prenom='Tom', nom='Petit', email='t@exemple.fr'),
        ])
        fiche = self.lire(session.pk).json()
        self.assertEqual((fiche['modalite'], fiche['entreprises'], fiche['nombre_entreprises'], fiche['nombre_jours']),
                         ('DISTANCIEL', [], 0, 1))
        # Ancien apprenant sans entreprise cliente : le nom saisi compte, une seule fois
        session.apprenants.add(Apprenant.objects.create(organisme=org, prenom='Eva', nom='Blanc', email='e@exemple.fr',
                                                        entreprise=' Acme '),
                               Apprenant.objects.create(organisme=org, prenom='Luc', nom='Noir', email='lu@exemple.fr',
                                                        entreprise='acme'))
        self.assertEqual(self.lire(session.pk).json()['entreprises'], ['Acme'])

    def test_session_d_un_autre_centre_404(self):
        connecter(self.client, 'autre@organisme.fr')
        reponse = self.lire()
        self.assertEqual((reponse.status_code, reponse.json()['code']), (404, 'SESSION_INTROUVABLE'))

    def test_session_inexistante_404(self):
        reponse = self.lire(999999)
        self.assertEqual((reponse.status_code, reponse.json()['code']), (404, 'SESSION_INTROUVABLE'))

    def test_non_connecte_401(self):
        self.client.logout()
        self.assertEqual(self.lire().status_code, 401)
