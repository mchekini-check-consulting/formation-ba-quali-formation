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
