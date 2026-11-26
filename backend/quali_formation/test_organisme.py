"""SCRUM-221 : informations du centre à la première connexion (POST /organisme/) et données filtrées par centre."""

import json
from unittest import mock

from django.test import TestCase

from quali_formation.models import (
    Apprenant,
    Formateur,
    Formation,
    Organisme,
    Utilisateur,
)
from quali_formation.tests import connecter, connecter_existant, creer_centre

VALIDE = {'raison_sociale': ' HiTech Formation ', 'siret': '123 456 789 00012', 'adresse': '12 rue des Lilas, 75011 Paris',
          'prenom': ' Marie ', 'nom': 'Arnaud'}


class PremiereConnexionTests(TestCase):
    def setUp(self):
        self.compte = connecter(self.client, email='marie.arnaud@hitech-formation.fr', centre=False)

    def poster(self, **modif):
        return self.client.post('/organisme/', {**VALIDE, **modif}, content_type='application/json')

    def erreurs(self, reponse):
        self.assertEqual(reponse.status_code, 400)
        return {e['champ']: e['message'] for e in reponse.json()['erreurs']}

    def test_compte_cree_sans_centre(self):
        # CA1 : le formulaire s'affiche tant que le centre n'est pas renseigné (organisme null)
        moi = self.client.get('/auth/moi').json()
        self.assertEqual((moi['email'], moi['organisme'], moi['role']), ('marie.arnaud@hitech-formation.fr', None, 'UTILISATEUR'))

    def test_formulaire_valide_cree_le_centre_et_le_gestionnaire(self):
        # CA4 : le centre est créé et l'utilisateur en devient gestionnaire
        reponse = self.poster(numero_declaration_activite='11756543210', region_nda='Île-de-France', ville_signature='Paris')
        self.assertEqual(reponse.status_code, 201, reponse.content)
        centre = Organisme.objects.get()
        self.assertEqual((centre.raison_sociale, centre.siret, centre.numero_declaration_activite, centre.region_nda,
                          centre.ville_signature), ('HiTech Formation', '12345678900012', '11756543210', 'Île-de-France', 'Paris'))
        self.compte.refresh_from_db()
        self.assertEqual((self.compte.prenom, self.compte.nom, self.compte.role, self.compte.organisme),
                         ('Marie', 'Arnaud', 'GESTIONNAIRE', centre))
        attendu = {'id': self.compte.id, 'email': 'marie.arnaud@hitech-formation.fr', 'prenom': 'Marie', 'nom': 'Arnaud',
                   'role': 'GESTIONNAIRE', 'organisme': {'id': centre.id, 'raison_sociale': 'HiTech Formation'}}
        self.assertEqual(reponse.json(), attendu)
        # CA5 / CA6 : à la reconnexion, le centre est connu (bas du menu : initiales et raison sociale)
        self.assertEqual(self.client.get('/auth/moi').json(), attendu)

    def test_champs_obligatoires_vides_rien_n_est_enregistre(self):
        # CA3
        erreurs = self.erreurs(self.poster(raison_sociale=' ', siret='', adresse='', prenom='', nom=''))
        self.assertEqual(erreurs, {
            'raison_sociale': 'La raison sociale est obligatoire', 'siret': 'Le SIRET est obligatoire',
            'adresse': 'L’adresse est obligatoire', 'prenom': 'Le prénom est obligatoire', 'nom': 'Le nom est obligatoire'})
        self.assertFalse(Organisme.objects.exists())
        self.compte.refresh_from_db()
        self.assertEqual((self.compte.organisme, self.compte.role, self.compte.nom), (None, 'UTILISATEUR', ''))

    def test_formats_incorrects(self):
        # CA5 : SIRET 14 chiffres, N° de déclaration d'activité 11 chiffres
        erreurs = self.erreurs(self.poster(siret='123456789000', numero_declaration_activite='1175654321A'))
        self.assertEqual(erreurs, {'siret': 'Le SIRET doit contenir 14 chiffres',
                                   'numero_declaration_activite': 'Le N° de déclaration d’activité doit contenir 11 chiffres'})
        self.assertFalse(Organisme.objects.exists())

    def test_siret_deja_inscrit_rien_n_est_enregistre(self):
        # CA8 : un seul centre par SIRET (espaces ignorés), message sous le champ SIRET
        creer_centre('Centre existant', siret='12345678900012')
        erreurs = self.erreurs(self.poster(siret='123 456 789 00012'))
        self.assertEqual(erreurs, {'siret': 'Ce centre est déjà inscrit sur Quali-formation. Contactez son gestionnaire.'})
        self.assertEqual(Organisme.objects.count(), 1)
        self.compte.refresh_from_db()
        self.assertEqual((self.compte.organisme, self.compte.role), (None, 'UTILISATEUR'))

    def test_siret_deja_inscrit_signale_avec_les_autres_champs(self):
        creer_centre('Centre existant', siret='12345678900012')
        reponse = self.poster(nom='')
        self.assertEqual(self.erreurs(reponse), {
            'nom': 'Le nom est obligatoire',
            'siret': 'Ce centre est déjà inscrit sur Quali-formation. Contactez son gestionnaire.'})

    def test_siret_au_mauvais_format_pas_de_recherche_de_doublon(self):
        creer_centre('Centre existant', siret='12345678900012')
        self.assertEqual(self.erreurs(self.poster(siret='123')), {'siret': 'Le SIRET doit contenir 14 chiffres'})

    def test_texte_trop_long(self):
        self.assertEqual(self.erreurs(self.poster(ville_signature='x' * 101)), {'ville_signature': '100 caractères maximum'})

    def test_champs_retires_du_formulaire_ignores(self):
        # Représentant, contacts et conditions de vente ne font plus partie du formulaire : envoyés quand même, ils
        # ne sont ni vérifiés ni enregistrés (colonnes gardées vides, pour Paramètres)
        reponse = self.poster(email_contact='contact@', representant_legal='Jean Dupont', regime_tva='Exonéré')
        self.assertEqual(reponse.status_code, 201, reponse.content)
        centre = Organisme.objects.get()
        self.assertEqual((centre.email_contact, centre.representant_legal, centre.regime_tva), ('', '', ''))

    def test_corps_illisible(self):
        reponse = self.client.post('/organisme/', ['pas', 'un', 'objet'], content_type='application/json')
        self.assertIn('raison_sociale', self.erreurs(reponse))

    def test_si_une_etape_echoue_rien_n_est_enregistre(self):
        with mock.patch.object(Utilisateur, 'save', side_effect=RuntimeError('panne')), self.assertRaises(RuntimeError):
            self.poster()
        self.assertFalse(Organisme.objects.exists())

    def test_centre_deja_renseigne(self):
        self.assertEqual(self.poster().status_code, 201)
        reponse = self.poster(raison_sociale='Autre centre')
        self.assertEqual((reponse.status_code, reponse.json()['code']), (409, 'ORGANISME_DEJA_RENSEIGNE'))
        self.assertEqual(Organisme.objects.count(), 1)

    def test_non_connecte(self):
        self.client.post('/auth/logout')
        self.assertEqual(self.poster().status_code, 401)

    def test_sans_centre_rien_ne_se_cree(self):
        # CA2 : tant que le centre n'est pas renseigné, l'application est bloquée (aussi côté serveur)
        personne = {'prenom': 'Zoé', 'nom': 'Roux', 'email': 'zoe@exemple.fr'}
        avant = (Formateur.objects.count(), Apprenant.objects.count())
        for chemin in ('/formateurs/', '/apprenants/'):
            reponse = self.client.post(chemin, personne, content_type='application/json')
            self.assertEqual((reponse.status_code, reponse.json()['code']), (403, 'ORGANISME_A_RENSEIGNER'))
        reponse = self.client.post('/formations/', {'action': 'brouillon', 'intitule': 'Excel', 'modalite': 'PRESENTIEL'},
                                   content_type='application/json')
        self.assertEqual(reponse.status_code, 403)
        self.assertFalse(Formation.objects.exists())
        self.assertEqual((Formateur.objects.count(), Apprenant.objects.count()), avant)


class LogsEnregistrementTests(TestCase):
    """Log métier de l'enregistrement du formulaire (layer service) : identifiant de l'utilisateur, puis centre créé
    et rôle attribué, ou champs en erreur, ou type d'erreur technique."""

    def setUp(self):
        self.compte = connecter(self.client, email='marie.arnaud@hitech-formation.fr', centre=False)

    def enregistrer(self, **modif):
        with self.assertLogs('quali_formation.metier', level='INFO') as logs:
            self.client.post('/organisme/', {**VALIDE, **modif}, content_type='application/json')
        (ligne,) = [r for r in logs.records if getattr(r, 'layer', None) == 'service']
        self.assertEqual((getattr(ligne, 'class'), ligne.method), ('OrganismeService', 'enregistrer'))
        self.assertEqual(getattr(ligne, 'utilisateur.id'), str(self.compte.id))
        self.assertIsInstance(ligne.durationMs, int)
        texte = json.dumps(ligne.__dict__, default=str)
        for personnel in ('marie.arnaud', 'Marie', 'Arnaud', 'Lilas', 'HiTech'):
            self.assertNotIn(personnel, texte)
        return ligne

    def test_reussite_info_centre_cree_et_role(self):
        ligne = self.enregistrer()
        self.assertEqual((ligne.levelname, getattr(ligne, 'resultat.id'), getattr(ligne, 'utilisateur.role')),
                         ('INFO', str(Organisme.objects.get().id), 'GESTIONNAIRE'))
        self.assertFalse(hasattr(ligne, 'erreur.champs'))

    def test_refus_warn_champs_en_erreur_sans_les_valeurs(self):
        ligne = self.enregistrer(siret='123', raison_sociale='', nom='')
        self.assertEqual((ligne.levelname, ligne.error, getattr(ligne, 'erreur.champs')),
                         ('WARNING', 'DonneesInvalides', 'raison_sociale,nom,siret'))
        self.assertFalse(hasattr(ligne, 'resultat.id'))

    def test_siret_deja_utilise_warn_avec_code_et_siret(self):
        creer_centre('Centre existant', siret='12345678900012')
        ligne = self.enregistrer()
        self.assertEqual((ligne.levelname, ligne.errorCode, getattr(ligne, 'erreur.siret'), getattr(ligne, 'erreur.champs')),
                         ('WARNING', 'SIRET_DEJA_UTILISE', '12345678900012', 'siret'))

    def test_refus_ordinaire_sans_code_ni_siret(self):
        ligne = self.enregistrer(nom='')
        self.assertFalse(hasattr(ligne, 'errorCode'))
        self.assertFalse(hasattr(ligne, 'erreur.siret'))

    def test_erreur_technique_ligne(self):
        with mock.patch.object(Organisme.objects, 'create', side_effect=RuntimeError('panne marie.arnaud')), \
                self.assertLogs('quali_formation.metier', level='INFO') as logs, self.assertRaises(RuntimeError):
            self.client.post('/organisme/', VALIDE, content_type='application/json')
        (ligne,) = [r for r in logs.records if getattr(r, 'layer', None) == 'service']
        self.assertEqual((ligne.levelname, ligne.error, getattr(ligne, 'utilisateur.id')),
                         ('ERROR', 'RuntimeError', str(self.compte.id)))
        self.assertNotIn('marie.arnaud', json.dumps(ligne.__dict__, default=str))


class AccesBloqueTests(TestCase):
    """CA2 côté serveur : compte connecté sans centre, seules les routes du formulaire répondent ; chaque refus écrit
    un log « accès bloqué » (warn, controller) avec l'identifiant de l'utilisateur et la route demandée."""

    BLOQUEES = (  # (méthode, adresse, route écrite dans le log)
        ('get', '/formations/', 'formations/'),
        ('post', '/formations/', 'formations/'),
        ('get', '/formations/1/', 'formations/<int:pk>/'),
        ('post', '/formations/1/publier/', 'formations/<int:pk>/publier/'),
        ('get', '/formations/1/sessions/', 'formations/<int:pk>/sessions/'),
        ('get', '/sessions/', 'sessions/'),
        ('post', '/sessions/', 'sessions/'),
        ('get', '/formateurs/', 'formateurs/'),
        ('get', '/apprenants/', 'apprenants/'),
        ('get', '/modeles/resume', 'modeles/resume'),
        ('get', '/modeles/', 'modeles/'),
        ('get', '/modeles/convention', 'modeles/<str:type_modele>'),
        ('get', '/items', 'items'),
    )

    def setUp(self):
        self.compte = connecter(self.client, centre=False)
        self.autre = connecter(self.client_class(), email='autre@centre.fr')  # données d'un autre centre

    def test_routes_bloquees_403_et_log_acces_bloque(self):
        avant = (Formation.objects.count(), Formateur.objects.count())
        for methode, chemin, route in self.BLOQUEES:
            with self.subTest(chemin=chemin, methode=methode), \
                    self.assertLogs('quali_formation.metier', level='INFO') as logs:
                reponse = getattr(self.client, methode)(chemin, {}, content_type='application/json')
                self.assertEqual((reponse.status_code, reponse.json()['code']), (403, 'ORGANISME_A_RENSEIGNER'))
                (ligne,) = logs.records
                self.assertEqual((ligne.levelname, ligne.layer, ligne.httpMethod, ligne.route, ligne.status,
                                  ligne.errorCode, getattr(ligne, 'utilisateur.id')),
                                 ('WARNING', 'controller', methode.upper(), route, 403,
                                  'ACCES_BLOQUE_CENTRE_NON_RENSEIGNE', str(self.compte.id)))
                self.assertIsInstance(ligne.durationMs, int)
        self.assertEqual((Formation.objects.count(), Formateur.objects.count()), avant)  # rien n'a été créé

    def test_routes_du_formulaire_autorisees(self):
        self.assertEqual(self.client.get('/auth/moi').status_code, 200)
        self.assertEqual(self.client.get('/sante/').status_code, 200)
        self.assertEqual(self.client.get('/').status_code, 200)
        with mock.patch('quali_formation.views.recherche_entreprises.rechercher',
                        return_value={'statut': 'INTROUVABLE', 'entreprise': None}):
            self.assertEqual(self.client.get('/entreprises/12345678900012/').status_code, 404)
        self.assertEqual(self.client.post('/organisme/', VALIDE, content_type='application/json').status_code, 201)
        # Centre enregistré : plus de blocage
        self.assertEqual(self.client.get('/formateurs/').status_code, 200)

    def test_deconnexion_et_connexion_autorisees(self):
        self.assertEqual(self.client.post('/auth/logout').status_code, 204)
        self.assertEqual(self.client.get('/auth/moi').status_code, 401)

    def test_non_connecte_ou_centre_renseigne_non_concernes(self):
        anonyme = self.client_class()
        self.assertEqual(anonyme.get('/formations/').status_code, 401)
        gestionnaire = self.client_class()
        connecter_existant(gestionnaire, self.autre)
        self.assertEqual(gestionnaire.get('/formateurs/').status_code, 200)

    def test_compte_supprime_laisse_la_vue_repondre(self):
        Utilisateur.objects.filter(pk=self.compte.pk).delete()
        self.assertEqual(self.client.get('/formations/').status_code, 401)


class FiltrageParCentreTests(TestCase):
    """Formations, sessions, formateurs et apprenants filtrés par centre."""

    def setUp(self):
        self.compte = connecter(self.client)
        self.centre = self.compte.organisme
        self.autre = creer_centre('Autre centre')

    def test_formateurs_et_apprenants_du_centre_seulement(self):
        Formateur.objects.create(prenom='Ana', nom='Ici', email='ana@ici.fr', organisme=self.centre)
        Formateur.objects.create(prenom='Bob', nom='Ailleurs', email='bob@ailleurs.fr', organisme=self.autre)
        Apprenant.objects.create(prenom='Léo', nom='Ailleurs', email='leo@ailleurs.fr', organisme=self.autre)
        # Les exemples chargés par migration (sans centre) ne sont visibles par personne
        self.assertEqual([f['email'] for f in self.client.get('/formateurs/').json()], ['ana@ici.fr'])
        self.assertEqual(self.client.get('/apprenants/').json(), [])
        cree = self.client.post('/apprenants/', {'prenom': 'Zoé', 'nom': 'Roux', 'email': 'zoe@ici.fr',
                                                     'statut': 'PARTICULIER'},
                                content_type='application/json').json()
        self.assertEqual(Apprenant.objects.get(pk=cree['id']).organisme, self.centre)

    def test_formations_des_comptes_du_centre(self):
        collegue = Utilisateur.objects.create(email='collegue@ici.fr', mot_de_passe='x', cgu_acceptees_le=self.compte.cgu_acceptees_le,
                                              organisme=self.centre)
        etranger = Utilisateur.objects.create(email='x@ailleurs.fr', mot_de_passe='x', cgu_acceptees_le=self.compte.cgu_acceptees_le,
                                              organisme=self.autre)
        Formation.objects.create(reference='FOR-1', intitule='Du collègue', proprietaire=collegue)
        Formation.objects.create(reference='FOR-2', intitule="D'ailleurs", proprietaire=etranger)
        self.assertEqual([f['intitule'] for f in self.client.get('/formations/').json()], ['Du collègue'])
        connecter_existant(self.client, etranger)
        self.assertEqual([f['intitule'] for f in self.client.get('/formations/').json()], ["D'ailleurs"])

    def test_session_avec_une_personne_d_un_autre_centre_refusee(self):
        formation = Formation.objects.create(reference='FOR-1', intitule='Excel', proprietaire=self.compte)
        ici = Formateur.objects.create(prenom='Ana', nom='Ici', email='ana@ici.fr', organisme=self.centre)
        ailleurs = Apprenant.objects.create(prenom='Léo', nom='Ailleurs', email='leo@ailleurs.fr', organisme=self.autre)
        reponse = self.client.post('/sessions/', {
            'formation': formation.pk, 'date_debut': '2026-11-18', 'date_fin': '2026-11-20', 'duree_heures': '14',
            'modalite': 'PRESENTIEL', 'lieu': 'Lyon', 'nombre_places': 5, 'formateurs': [ici.pk], 'apprenants': [ailleurs.pk],
        }, content_type='application/json')
        self.assertEqual((reponse.status_code, reponse.json()['code']), (400, 'PERSONNE_INTROUVABLE'))
