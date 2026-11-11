"""SCRUM-16 « Se connecter à mon compte » : POST /auth/login (règles RG-CX-03 à RG-CX-06, critères d'acceptation
2 à 4, jeux de test de docs/SCRUM-16-regles-de-gestion.md). Les comptes sont créés comme dans SCRUM-15."""

from django.test import TestCase

from quali_formation.services import compte_service

EMAIL = 'recette@organisme.fr'
MOT_DE_PASSE = 'Secret#2026'
MESSAGE_REFUS = 'E-mail ou mot de passe incorrect'


class SeConnecterTests(TestCase):
    def setUp(self):
        self.compte = compte_service.creer_compte(EMAIL, MOT_DE_PASSE, MOT_DE_PASSE, True)

    def connecter(self, **donnees):
        corps = {'email': EMAIL, 'mot_de_passe': MOT_DE_PASSE, **donnees}
        return self.client.post('/auth/login', corps, content_type='application/json')

    def assert_identifiants_refuses(self, reponse):
        self.assertEqual(reponse.status_code, 401, reponse.content)
        self.assertEqual(reponse.json(), {'code': 'IDENTIFIANTS_INVALIDES', 'detail': MESSAGE_REFUS})

    # RG-CX-04, RG-CX-06, critère 2 / jeu « Nominal »
    def test_identifiants_corrects_connexion_reussie(self):
        r = self.connecter()
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.json(), {'id': self.compte.id, 'email': EMAIL})

    def test_reponse_sans_mot_de_passe(self):
        r = self.connecter()
        self.assertNotIn(MOT_DE_PASSE, r.content.decode())
        self.assertNotIn(self.compte.mot_de_passe, r.content.decode())

    def test_email_sans_tenir_compte_des_majuscules_ni_des_espaces(self):
        self.assertEqual(self.connecter(email='  Recette@Organisme.FR ').status_code, 200)

    # RG-CX-05, critère 3 / jeux « Mauvais mot de passe » et « E-mail inconnu » : même message
    def test_mauvais_mot_de_passe(self):
        self.assert_identifiants_refuses(self.connecter(mot_de_passe='Faux#2026'))

    def test_email_inconnu(self):
        self.assert_identifiants_refuses(self.connecter(email='inconnu@organisme.fr'))

    def test_mot_de_passe_sensible_a_la_casse(self):
        self.assert_identifiants_refuses(self.connecter(mot_de_passe='secret#2026'))

    def test_meme_reponse_pour_email_inconnu_et_mauvais_mot_de_passe(self):
        inconnu = self.connecter(email='inconnu@organisme.fr')
        faux = self.connecter(mot_de_passe='Faux#2026')
        self.assertEqual(inconnu.json(), faux.json())

    # RG-CX-03, critère 4 / jeux « E-mail vide » et « Mot de passe vide »
    def test_email_vide(self):
        r = self.connecter(email='  ')
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.json()['code'], 'EMAIL_REQUIS')
        self.assertEqual(r.json()['champ'], 'email')
        self.assertEqual(r.json()['detail'], "L'adresse e-mail est obligatoire.")

    def test_mot_de_passe_vide(self):
        r = self.connecter(mot_de_passe='')
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.json()['code'], 'MOT_DE_PASSE_REQUIS')
        self.assertEqual(r.json()['champ'], 'mot_de_passe')

    def test_deux_champs_vides_signales(self):
        r = self.client.post('/auth/login', {}, content_type='application/json')
        self.assertEqual(r.status_code, 400)
        self.assertEqual([e['champ'] for e in r.json()['erreurs']], ['email', 'mot_de_passe'])

    def test_ni_mot_de_passe_ni_email_dans_les_logs(self):
        with self.assertLogs('quali_formation', level='INFO') as logs:
            self.connecter()
            self.connecter(mot_de_passe='Faux#2026')
            self.connecter(mot_de_passe='')
        texte = ' '.join(logs.output)
        self.assertNotIn(MOT_DE_PASSE, texte)
        self.assertNotIn('Faux#2026', texte)
        self.assertNotIn('organisme.fr', texte)

    def test_seul_post_est_accepte(self):
        self.assertEqual(self.client.get('/auth/login').status_code, 405)


class MemorisationConnexionTests(TestCase):
    """Connexion mémorisée : la session ouverte par /auth/login est reconnue par GET /auth/moi."""

    def setUp(self):
        self.compte = compte_service.creer_compte(EMAIL, MOT_DE_PASSE, MOT_DE_PASSE, True)

    def connecter(self, mot_de_passe=MOT_DE_PASSE):
        return self.client.post('/auth/login', {'email': EMAIL, 'mot_de_passe': mot_de_passe},
                                content_type='application/json')

    def assert_non_connecte(self):
        r = self.client.get('/auth/moi')
        self.assertEqual(r.status_code, 401)
        self.assertEqual(r.json()['code'], 'NON_CONNECTE')

    def test_sans_connexion_personne_n_est_connecte(self):
        self.assert_non_connecte()

    def test_apres_connexion_le_compte_est_reconnu(self):
        self.connecter()
        r = self.client.get('/auth/moi')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json(), {'id': self.compte.id, 'email': EMAIL})

    def test_cookie_de_session_illisible_par_le_javascript(self):
        r = self.connecter()
        cookie = r.cookies['sessionid']
        self.assertTrue(cookie['httponly'])
        self.assertNotIn(EMAIL, cookie.value)

    def test_nouveau_numero_de_session_a_chaque_connexion(self):
        self.connecter()
        premier = self.client.cookies['sessionid'].value
        self.connecter()
        self.assertNotEqual(self.client.cookies['sessionid'].value, premier)

    def test_identifiants_refuses_aucune_session_ouverte(self):
        self.assertEqual(self.connecter('Faux#2026').status_code, 401)
        self.assert_non_connecte()

    def test_compte_supprime_n_est_plus_connecte(self):
        self.connecter()
        self.compte.delete()
        self.assert_non_connecte()

    def test_seul_get_est_accepte(self):
        self.assertEqual(self.client.post('/auth/moi').status_code, 405)


class SeDeconnecterTests(TestCase):
    """SCRUM-17 / SCRUM-19 : « Se déconnecter » dans le menu du profil (POST /auth/logout)."""

    def setUp(self):
        compte_service.creer_compte(EMAIL, MOT_DE_PASSE, MOT_DE_PASSE, True)
        self.client.post('/auth/login', {'email': EMAIL, 'mot_de_passe': MOT_DE_PASSE}, content_type='application/json')

    def test_ferme_la_session(self):
        self.assertEqual(self.client.get('/auth/moi').status_code, 200)
        r = self.client.post('/auth/logout')
        self.assertEqual(r.status_code, 204)
        self.assertEqual(self.client.get('/auth/moi').status_code, 401)
        # Les pages protégées ne sont plus accessibles
        self.assertEqual(self.client.get('/sessions/').json()['code'], 'NON_CONNECTE')

    def test_sans_connexion_ne_plante_pas(self):
        self.client.post('/auth/logout')
        self.assertEqual(self.client.post('/auth/logout').status_code, 204)

    def test_refuse_le_get(self):
        self.assertEqual(self.client.get('/auth/logout').status_code, 405)
