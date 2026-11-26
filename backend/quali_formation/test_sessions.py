"""SCRUM-25 : création d'une session depuis la page Sessions et planning (POST /sessions/)."""

from django.test import TestCase

from quali_formation.models import Apprenant, Formateur, Formation, Session
from quali_formation.tests import connecter


class SessionsPlanningTests(TestCase):
    def setUp(self):
        self.compte = connecter(self.client)
        # Les exemples chargés par migration n'ont pas de centre (SCRUM-221) : ici, ce sont ceux du centre du compte
        Formateur.objects.update(organisme=self.compte.organisme)
        Apprenant.objects.update(organisme=self.compte.organisme)
        self.formation = Formation.objects.create(reference='FOR-2026-001', intitule="Management d'équipe", duree_heures=21,
                                                  proprietaire=self.compte)
        self.formateur = Formateur.objects.get(email='julien.lefevre@exemple.fr')
        self.apprenants = list(Apprenant.objects.filter(email__in=['camille.martin@acme.fr', 'hugo.bernard@acme.fr']))

    def corps(self, **modif):
        corps = {
            'formation': self.formation.pk, 'date_debut': '2026-11-18', 'date_fin': '2026-11-20',
            'duree_heures': '21', 'modalite': 'PRESENTIEL',
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
        self.assertEqual(set(formateurs[0]), {'id', 'prenom', 'nom', 'email', 'specialites', 'entreprise', 'statut',
                                              'numero_nda', 'nombre_sessions'})
        apprenants = self.client.get('/apprenants/').json()
        self.assertEqual(len(apprenants), 8)
        self.assertEqual(set(apprenants[0]), {'id', 'prenom', 'nom', 'email', 'telephone', 'statut', 'entreprise',
                                              'entreprise_id', 'poste', 'nombre_sessions'})
        # Apprenants d'exemple rattachés à l'entreprise Acme (migration 0009)
        self.assertEqual({a['entreprise'] for a in apprenants}, {'Acme'})

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
        # SCRUM-166 : plus d'heures de début ni de fin
        self.assertIsNone(session.heure_debut)
        self.assertIsNone(json['heure_fin'])

    def test_la_session_creee_apparait_dans_la_liste(self):
        self.poster()
        liste = self.client.get('/sessions/').json()
        self.assertEqual(len(liste), 1)
        self.assertEqual(liste[0]['formateurs'], [self.formateur.pk])

    def test_distanciel_demande_le_lien(self):
        reponse = self.poster(modalite='DISTANCIEL', lieu='')
        self.assertEqual(reponse.status_code, 400)
        self.assertEqual(set(reponse.json()), {'lien_classe_virtuelle'})
        reponse = self.poster(modalite='DISTANCIEL', lieu='', lien_classe_virtuelle='https://visio.exemple.fr/abc')
        self.assertEqual(reponse.status_code, 201)

    def test_mixte_demande_le_lieu_et_le_lien(self):
        reponse = self.poster(modalite='MIXTE', lieu=' ')
        self.assertEqual(reponse.status_code, 400)
        self.assertEqual(set(reponse.json()), {'lieu', 'lien_classe_virtuelle'})
        reponse = self.poster(modalite='MIXTE', lien_classe_virtuelle='https://visio.exemple.fr/abc')
        self.assertEqual(reponse.status_code, 201)
        self.assertEqual(reponse.json()['modalite'], 'MIXTE')

    def test_refuse_l_ancienne_modalite_classe_virtuelle(self):
        reponse = self.poster(modalite='CLASSE_VIRTUELLE', lien_classe_virtuelle='https://visio.exemple.fr/abc')
        self.assertEqual(reponse.status_code, 400)
        self.assertIn('modalite', reponse.json())

    def test_les_heures_ne_sont_plus_demandees(self):
        # Envoyées par un ancien écran : ignorées
        reponse = self.poster(heure_debut='09:00', heure_fin='17:00')
        self.assertEqual(reponse.status_code, 201)
        self.assertIsNone(reponse.json()['heure_debut'])

    def test_refuse_un_champ_obligatoire_manquant(self):
        for champ in ('formation', 'date_debut', 'date_fin', 'duree_heures', 'modalite', 'nombre_places'):
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
        self.assertEqual(reponse.json(), {'code': 'FORMATEUR_REQUIS', 'detail': 'Une session doit avoir au moins un formateur.'})

    def test_refuse_une_session_sans_apprenant(self):
        reponse = self.poster(apprenants=[])
        self.assertEqual(reponse.status_code, 400)
        self.assertEqual(reponse.json()['detail'], 'Une session doit avoir au moins un apprenant.')
        self.assertFalse(Session.objects.exists())

    def test_refuse_plus_d_apprenants_que_de_places(self):
        reponse = self.poster(nombre_places=1)
        self.assertEqual(reponse.status_code, 400)
        self.assertEqual(reponse.json(), {'code': 'TROP_APPRENANTS', 'detail': 'Trop d’apprenants : 2 cochés pour 1 places.'})
        self.assertFalse(Session.objects.exists())

    def test_accepte_autant_d_apprenants_que_de_places(self):
        self.assertEqual(self.poster(nombre_places=2).status_code, 201)

    def test_refuse_un_formateur_inconnu(self):
        self.assertEqual(self.poster(formateurs=[999999]).status_code, 400)

    def test_ne_voit_que_les_sessions_de_ses_formations(self):
        self.poster()
        connecter(self.client, 'autre@organisme.fr')
        self.assertEqual(self.client.get('/sessions/').json(), [])

    def test_refuse_une_session_sur_la_formation_d_un_autre_compte(self):
        connecter(self.client, 'autre@organisme.fr')
        reponse = self.poster()
        self.assertEqual((reponse.status_code, reponse.json()['code']), (404, 'FORMATION_INTROUVABLE'))
        self.assertFalse(Session.objects.exists())


class CreationApprenantTests(TestCase):
    """SCRUM-27 : POST /apprenants/."""

    def setUp(self):
        self.compte = connecter(self.client)

    def poster(self, **corps):
        corps.setdefault('statut', 'PARTICULIER')  # obligatoire depuis SCRUM-112
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
        reponse = self.poster(prenom=' ', nom='', statut='')
        self.assertEqual(reponse.status_code, 400)
        self.assertEqual(reponse.json(), {'prenom': ['Indiquez le prénom.'], 'nom': ['Indiquez le nom.'], 'email': ["Indiquez l'e-mail."],
                                          'statut': ['Le statut est obligatoire']})
        self.assertEqual(Apprenant.objects.count(), 8)

    def test_enregistre_l_entreprise(self):
        reponse = self.poster(prenom='Lucas', nom='Girard', email='lucas.girard@globex.fr', entreprise=' Globex ')
        self.assertEqual((reponse.status_code, reponse.json()['entreprise']), (201, 'Globex'))

    def test_refuse_un_email_invalide(self):
        reponse = self.poster(prenom='Lucas', nom='Girard', email='lucas.girard')
        self.assertEqual(reponse.status_code, 400)
        self.assertEqual(reponse.json(), {'email': ["Format d'e-mail invalide"]})


class CreationFormateurTests(TestCase):
    """SCRUM-26 : POST /formateurs/."""

    def setUp(self):
        self.compte = connecter(self.client)

    def poster(self, **corps):
        return self.client.post('/formateurs/', corps, content_type='application/json')

    def test_cree_un_formateur_nettoye(self):
        reponse = self.poster(prenom=' Camille ', nom=' Leroy ', email='camille.leroy@exemple.fr')
        self.assertEqual(reponse.status_code, 201)
        self.assertEqual(reponse.json(), {'id': reponse.json()['id'], 'prenom': 'Camille', 'nom': 'Leroy',
                                          'email': 'camille.leroy@exemple.fr', 'specialites': '', 'entreprise': '',
                                          'statut': '', 'numero_nda': '', 'nombre_sessions': 0})
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
