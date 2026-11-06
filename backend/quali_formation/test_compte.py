"""SCRUM-15 « Créer un compte » : POST /auth/register (règles RG-CC-01 à RG-CC-10, critères d'acceptation,
jeux de test de docs/SCRUM-15-regles-de-gestion.md)."""

from django.contrib.auth.hashers import check_password
from django.test import TestCase

from quali_formation.models import Utilisateur

MOT_DE_PASSE = 'Secret#2026'


class CreerCompteTests(TestCase):
    def inscrire(self, **donnees):
        corps = {'email': 'nouveau@organisme.fr', 'mot_de_passe': MOT_DE_PASSE, 'confirmation': MOT_DE_PASSE,
                 'cgu_acceptees': True, **donnees}
        return self.client.post('/auth/register', corps, content_type='application/json')

    def codes(self, reponse):
        return {e['champ']: e['code'] for e in reponse.json()['erreurs']}

    def assert_refuse(self, reponse, codes):
        self.assertEqual(reponse.status_code, 400, reponse.content)
        self.assertEqual(self.codes(reponse), codes)
        self.assertFalse(Utilisateur.objects.exists())  # RG-CC-10 : rien n'est créé

    # Critère 1 / jeu « Nominal »
    def test_informations_valides_compte_cree(self):
        r = self.inscrire()
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(r.json()['email'], 'nouveau@organisme.fr')
        u = Utilisateur.objects.get()
        self.assertEqual(u.email, 'nouveau@organisme.fr')
        self.assertIsNotNone(u.cgu_acceptees_le)

    # RG-CC-07
    def test_compte_dans_la_table_utilisateur_et_mot_de_passe_hache(self):
        self.assertEqual(Utilisateur._meta.db_table, 'utilisateur')
        r = self.inscrire()
        self.assertNotIn(MOT_DE_PASSE, r.content.decode())
        self.assertNotIn('mot_de_passe', r.json())
        u = Utilisateur.objects.get()
        self.assertNotEqual(u.mot_de_passe, MOT_DE_PASSE)
        self.assertTrue(check_password(MOT_DE_PASSE, u.mot_de_passe))

    def test_ni_mot_de_passe_ni_email_dans_les_logs(self):
        with self.assertLogs('quali_formation', level='INFO') as logs:
            self.inscrire()
            self.inscrire()  # 409
            self.inscrire(email='autre@organisme.fr', confirmation='Autre#2026')  # 400
        texte = ' '.join(logs.output)
        self.assertNotIn(MOT_DE_PASSE, texte)
        self.assertNotIn('organisme.fr', texte)

    # RG-CC-02, critère 2 / jeu « E-mail déjà pris »
    def test_email_deja_utilise(self):
        self.assertEqual(self.inscrire().status_code, 201)
        r = self.inscrire()
        self.assertEqual(r.status_code, 409)
        self.assertEqual(r.json()['code'], 'EMAIL_DEJA_UTILISE')
        self.assertEqual(r.json()['champ'], 'email')
        self.assertEqual(r.json()['detail'], 'Un compte existe déjà avec cet e-mail.')
        self.assertEqual(Utilisateur.objects.count(), 1)

    def test_email_deja_utilise_sans_tenir_compte_des_majuscules_ni_des_espaces(self):
        self.assertEqual(self.inscrire(email='Nouveau@Organisme.fr').status_code, 201)
        self.assertEqual(Utilisateur.objects.get().email, 'nouveau@organisme.fr')
        self.assertEqual(self.inscrire(email='  NOUVEAU@organisme.FR ').status_code, 409)
        self.assertEqual(Utilisateur.objects.count(), 1)

    # RG-CC-01 / jeu « E-mail invalide »
    def test_email_obligatoire(self):
        r = self.inscrire(email='  ')
        self.assertEqual(r.json()['code'], 'EMAIL_REQUIS')
        self.assertEqual(r.json()['champ'], 'email')
        self.assert_refuse(r, {'email': 'EMAIL_REQUIS'})

    def test_email_au_bon_format(self):
        for email in ('nouveau@', 'pas-un-email', 'a@b'):
            with self.subTest(email=email):
                self.assert_refuse(self.inscrire(email=email), {'email': 'EMAIL_INVALIDE'})

    # RG-CC-03 / jeu « Trop court »
    def test_mot_de_passe_obligatoire(self):
        self.assert_refuse(self.inscrire(mot_de_passe='', confirmation=''), {'mot_de_passe': 'MOT_DE_PASSE_REQUIS'})

    def test_mot_de_passe_trop_court(self):
        r = self.inscrire(mot_de_passe='Se#1', confirmation='Se#1')
        self.assertIn('8 caractères minimum', r.json()['erreurs'][0]['message'])
        self.assert_refuse(r, {'mot_de_passe': 'MOT_DE_PASSE_NON_CONFORME'})

    # RG-CC-04 / jeux « Sans majuscule », « Sans caractère spécial » ; critère 3
    def test_mot_de_passe_chaque_critere_manquant_indique(self):
        cas = {
            'secret#2026': 'une majuscule',
            'SECRET#2026': 'une minuscule',
            'Secret#abcd': 'un chiffre',
            'Secret2026': 'un caractère spécial',
        }
        for mot, manque in cas.items():
            with self.subTest(mot=mot):
                r = self.inscrire(mot_de_passe=mot, confirmation=mot)
                self.assertEqual(r.json()['erreurs'][0]['message'], f'Le mot de passe doit contenir : {manque}.')
                self.assert_refuse(r, {'mot_de_passe': 'MOT_DE_PASSE_NON_CONFORME'})

    # RG-CC-05 / jeu « Confirmation différente » ; critère 3
    def test_confirmation_differente(self):
        self.assert_refuse(self.inscrire(confirmation='Secret#2027'), {'confirmation': 'CONFIRMATION_DIFFERENTE'})

    # RG-CC-06 / jeu « CGU non cochées » ; critère 4
    def test_cgu_non_acceptees(self):
        for valeur in (False, None, 'oui', 1):
            with self.subTest(valeur=valeur):
                self.assert_refuse(self.inscrire(cgu_acceptees=valeur), {'cgu_acceptees': 'CGU_NON_ACCEPTEES'})

    # RG-CC-08 : les champs obligatoires de la maquette, tous vides
    def test_formulaire_vide_toutes_les_erreurs_listees(self):
        r = self.client.post('/auth/register', {}, content_type='application/json')
        self.assert_refuse(r, {'email': 'EMAIL_REQUIS', 'mot_de_passe': 'MOT_DE_PASSE_REQUIS',
                               'cgu_acceptees': 'CGU_NON_ACCEPTEES'})

    # Chaque compte n'accède qu'à ses informations : le compte créé est connecté, pas un compte précédent
    def test_le_compte_cree_est_connecte(self):
        self.assertEqual(self.client.get('/auth/moi').status_code, 401)
        r = self.inscrire()
        self.assertEqual(self.client.get('/auth/moi').json(), {'id': r.json()['id'], 'email': 'nouveau@organisme.fr'})
        self.assertEqual(self.client.get('/formations/').json(), [])

    def test_le_compte_cree_remplace_la_connexion_precedente(self):
        ancien = self.inscrire(email='ancien@organisme.fr')
        self.client.post('/formations/', {'action': 'brouillon', 'intitule': 'Formation de l’ancien', 'modalite': 'PRESENTIEL'},
                         content_type='application/json')
        nouveau = self.inscrire()
        self.assertNotEqual(nouveau.json()['id'], ancien.json()['id'])
        self.assertEqual(self.client.get('/auth/moi').json()['email'], 'nouveau@organisme.fr')
        self.assertEqual(self.client.get('/formations/').json(), [])  # rien de l'ancien compte

    def test_une_creation_refusee_ne_change_pas_la_connexion(self):
        self.inscrire(email='ancien@organisme.fr')
        self.assertEqual(self.inscrire(email='ancien@organisme.fr').status_code, 409)
        self.assertEqual(self.inscrire(email='pas-un-email').status_code, 400)
        self.assertEqual(self.client.get('/auth/moi').json()['email'], 'ancien@organisme.fr')

    def test_seul_post_est_accepte(self):
        self.assertEqual(self.client.get('/auth/register').status_code, 405)
