"""SCRUM-25 : création d'une session depuis la page Sessions et planning (POST /sessions/)."""

from django.test import TestCase

from quali_formation.models import Apprenant, Formateur, Formation, Session


class SessionsPlanningTests(TestCase):
    def setUp(self):
        self.formation = Formation.objects.create(reference='FOR-2026-001', intitule="Management d'équipe", duree_heures=21)
        self.formateur = Formateur.objects.get(email='julien.lefevre@exemple.fr')
        self.apprenants = list(Apprenant.objects.filter(email__in=['camille.martin@acme.fr', 'hugo.bernard@acme.fr']))

    def corps(self, **modif):
        corps = {
            'formation': self.formation.pk, 'date_debut': '2026-11-18', 'date_fin': '2026-11-20',
            'heure_debut': '09:00', 'heure_fin': '17:00', 'duree_heures': '21', 'modalite': 'PRESENTIEL',
            'lieu': ' Lyon, salle 2 ', 'nombre_places': 10,
            'formateurs': [self.formateur.pk], 'apprenants': [a.pk for a in self.apprenants],
        }
        corps.update(modif)
        return corps

    def poster(self, **modif):
        return self.client.post('/sessions/', self.corps(**modif), content_type='application/json')

    def test_exemples_de_la_maquette_charges_par_migration(self):
        self.assertEqual(Formateur.objects.count(), 4)
        self.assertEqual(Apprenant.objects.count(), 8)

    def test_liste_les_formateurs_et_les_apprenants(self):
        formateurs = self.client.get('/formateurs/').json()
        self.assertEqual(len(formateurs), 4)
        self.assertEqual(set(formateurs[0]), {'id', 'prenom', 'nom', 'email', 'specialites'})
        apprenants = self.client.get('/apprenants/').json()
        self.assertEqual(len(apprenants), 8)
        self.assertEqual(set(apprenants[0]), {'id', 'prenom', 'nom', 'email'})

    def test_cree_une_session_prevue_avec_formateurs_et_apprenants(self):
        reponse = self.poster()
        self.assertEqual(reponse.status_code, 201)
        json = reponse.json()
        self.assertEqual(json['statut'], 'PREVUE')
        self.assertEqual(json['formation_intitule'], "Management d'équipe")
        self.assertEqual(json['lieu'], 'Lyon, salle 2')
        self.assertEqual(json['nombre_apprenants'], 2)
        session = Session.objects.get(pk=json['id'])
        self.assertEqual(list(session.formateurs.all()), [self.formateur])
        self.assertEqual(session.apprenants.count(), 2)
        self.assertEqual(str(session.heure_debut), '09:00:00')

    def test_la_session_creee_apparait_dans_la_liste(self):
        self.poster()
        liste = self.client.get('/sessions/').json()
        self.assertEqual(len(liste), 1)
        self.assertEqual(liste[0]['formateurs'], [self.formateur.pk])

    def test_classe_virtuelle_demande_le_lien(self):
        reponse = self.poster(modalite='CLASSE_VIRTUELLE', lieu='')
        self.assertEqual(reponse.status_code, 400)
        self.assertIn('lien_classe_virtuelle', reponse.json())
        reponse = self.poster(modalite='CLASSE_VIRTUELLE', lieu='', lien_classe_virtuelle='https://visio.exemple.fr/abc')
        self.assertEqual(reponse.status_code, 201)

    def test_refuse_un_champ_obligatoire_manquant(self):
        for champ in ('formation', 'date_debut', 'date_fin', 'heure_debut', 'heure_fin', 'duree_heures', 'modalite', 'nombre_places'):
            corps = self.corps()
            del corps[champ]
            reponse = self.client.post('/sessions/', corps, content_type='application/json')
            self.assertEqual(reponse.status_code, 400, champ)
            self.assertIn(champ, reponse.json())
        self.assertIn('lieu', self.poster(lieu='  ').json())
        self.assertFalse(Session.objects.exists())

    def test_refuse_une_date_de_fin_avant_le_debut(self):
        reponse = self.poster(date_fin='2026-11-17')
        self.assertEqual(reponse.status_code, 400)
        self.assertEqual(reponse.json()['code'], 'DATES_INVALIDES')

    def test_accepte_une_session_sur_une_seule_journee(self):
        self.assertEqual(self.poster(date_fin='2026-11-18').status_code, 201)

    def test_refuse_une_session_sans_formateur(self):
        reponse = self.poster(formateurs=[])
        self.assertEqual(reponse.status_code, 400)
        self.assertEqual(reponse.json(), {'code': 'FORMATEUR_REQUIS', 'detail': 'Une session doit avoir au moins un formateur'})

    def test_refuse_une_session_sans_apprenant(self):
        reponse = self.poster(apprenants=[])
        self.assertEqual(reponse.status_code, 400)
        self.assertEqual(reponse.json()['detail'], 'Une session doit avoir au moins un apprenant')
        self.assertFalse(Session.objects.exists())

    def test_ne_controle_pas_le_nombre_de_places(self):
        reponse = self.poster(nombre_places=1)
        self.assertEqual(reponse.status_code, 201)

    def test_refuse_un_formateur_inconnu(self):
        self.assertEqual(self.poster(formateurs=[999999]).status_code, 400)


class CreationApprenantTests(TestCase):
    """SCRUM-27 : POST /apprenants/."""

    def poster(self, **corps):
        return self.client.post('/apprenants/', corps, content_type='application/json')

    def test_cree_un_apprenant_nettoye(self):
        reponse = self.poster(prenom=' Lucas ', nom=' Girard ', email='lucas.girard@acme.fr')
        self.assertEqual(reponse.status_code, 201)
        self.assertEqual(reponse.json()['prenom'], 'Lucas')
        apprenant = Apprenant.objects.get(pk=reponse.json()['id'])
        self.assertEqual((apprenant.nom, apprenant.email), ('Girard', 'lucas.girard@acme.fr'))
        # Il est proposé à l'étape 3 de « Nouvelle session »
        self.assertIn('lucas.girard@acme.fr', [a['email'] for a in self.client.get('/apprenants/').json()])

    def test_refuse_les_champs_obligatoires_vides(self):
        reponse = self.poster(prenom=' ', nom='')
        self.assertEqual(reponse.status_code, 400)
        self.assertEqual(reponse.json(), {'prenom': ['Indiquez le prénom.'], 'nom': ['Indiquez le nom.'], 'email': ["Indiquez l'e-mail."]})
        self.assertEqual(Apprenant.objects.count(), 8)

    def test_refuse_un_email_invalide(self):
        reponse = self.poster(prenom='Lucas', nom='Girard', email='lucas.girard')
        self.assertEqual(reponse.status_code, 400)
        self.assertEqual(reponse.json(), {'email': ["Format d'e-mail invalide"]})


class CreationFormateurTests(TestCase):
    """SCRUM-26 : POST /formateurs/."""

    def poster(self, **corps):
        return self.client.post('/formateurs/', corps, content_type='application/json')

    def test_cree_un_formateur_nettoye(self):
        reponse = self.poster(prenom=' Camille ', nom=' Leroy ', email='camille.leroy@exemple.fr')
        self.assertEqual(reponse.status_code, 201)
        self.assertEqual(reponse.json(), {'id': reponse.json()['id'], 'prenom': 'Camille', 'nom': 'Leroy',
                                          'email': 'camille.leroy@exemple.fr', 'specialites': ''})
        # Il est proposé à l'étape 2 de « Nouvelle session »
        self.assertIn('camille.leroy@exemple.fr', [f['email'] for f in self.client.get('/formateurs/').json()])

    def test_refuse_les_champs_obligatoires_vides(self):
        reponse = self.poster(prenom='', nom=' ', email='')
        self.assertEqual(reponse.status_code, 400)
        self.assertEqual(reponse.json(), {'prenom': ['Indiquez le prénom.'], 'nom': ['Indiquez le nom.'], 'email': ["Indiquez l'e-mail."]})
        self.assertEqual(Formateur.objects.count(), 4)

    def test_refuse_un_email_invalide(self):
        reponse = self.poster(prenom='Camille', nom='Leroy', email='camille@leroy')
        self.assertEqual(reponse.status_code, 400)
        self.assertEqual(reponse.json(), {'email': ["Format d'e-mail invalide"]})
        self.assertEqual(Formateur.objects.count(), 4)
