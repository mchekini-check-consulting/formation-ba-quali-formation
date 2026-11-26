"""SCRUM-112 : liste des apprenants du centre (tri, recherche, nombre de sessions) et fenêtre « Nouvel apprenant »
complétée (téléphone, statut, entreprise cliente, poste) ; table entreprise minimale."""

from django.test import TestCase

from quali_formation.models import Apprenant, Entreprise, Formation, Session
from quali_formation.tests import connecter, creer_centre


class ApprenantsTests(TestCase):
    def setUp(self):
        self.compte = connecter(self.client)
        self.centre = self.compte.organisme
        self.durand = Entreprise.objects.create(raison_sociale='Société Durand', siret='12345678900012',
                                                organisme=self.centre)

    def apprenant(self, prenom, nom, **champs):
        champs.setdefault('email', f'{prenom.lower()}.{nom.lower()}@exemple.fr')
        return Apprenant.objects.create(prenom=prenom, nom=nom, organisme=self.centre, **champs)

    def lister(self, recherche=None):
        url = '/apprenants/' if recherche is None else f'/apprenants/?recherche={recherche}'
        reponse = self.client.get(url)
        self.assertEqual(reponse.status_code, 200)
        return reponse.json()

    def poster(self, **corps):
        corps = {'prenom': 'Sophie', 'nom': 'Lambert', 'email': 'sophie.lambert@exemple.fr', **corps}
        return self.client.post('/apprenants/', corps, content_type='application/json')

    # ---- CA2 : triés par nom, toutes les informations ----

    def test_liste_triee_par_nom_avec_toutes_les_informations(self):
        camille = self.apprenant('Camille', 'Martin', telephone='0745213698', statut='SALARIE',
                                 entreprise_cliente=self.durand, poste='Cheffe de projet')
        self.apprenant('Karim', 'Benali', statut='PARTICULIER')
        self.apprenant('laura', 'petit')  # minuscules : triée comme « Petit »
        formation = Formation.objects.create(reference='FOR-1', intitule='Excel', proprietaire=self.compte)
        for jour in ('2026-12-01', '2026-12-08'):
            Session.objects.create(formation=formation, date_debut=jour, date_fin=jour).apprenants.add(camille)

        apprenants = self.lister()
        self.assertEqual([a['nom'] for a in apprenants], ['Benali', 'Martin', 'petit'])
        self.assertEqual(apprenants[1], {
            'id': camille.id, 'prenom': 'Camille', 'nom': 'Martin', 'email': 'camille.martin@exemple.fr',
            'telephone': '0745213698', 'statut': 'SALARIE', 'entreprise': 'Société Durand',
            'entreprise_id': self.durand.id, 'poste': 'Cheffe de projet', 'nombre_sessions': 2})
        # Informations vides : l'écran affiche « — »
        self.assertEqual({k: apprenants[2][k] for k in ('telephone', 'statut', 'entreprise', 'entreprise_id', 'poste',
                                                         'nombre_sessions')},
                         {'telephone': '', 'statut': '', 'entreprise': '', 'entreprise_id': None, 'poste': '',
                          'nombre_sessions': 0})

    def test_ancien_texte_entreprise_affiche_en_secours(self):
        self.apprenant('Hugo', 'Bernard', entreprise='Acme')
        self.apprenant('Ana', 'Durand', entreprise='Acme', entreprise_cliente=self.durand, statut='SALARIE')
        self.assertEqual([a['entreprise'] for a in self.lister()], ['Acme', 'Société Durand'])

    # ---- CA3 : recherche par nom, e-mail ou entreprise ----

    def test_recherche_par_nom_email_ou_entreprise(self):
        self.apprenant('Camille', 'Martin', statut='SALARIE', entreprise_cliente=self.durand)
        self.apprenant('Hugo', 'Weber', email='hugo@globex.fr', entreprise='Acme')
        self.apprenant('Laura', 'Petit')
        cas = {
            'durand': ['Martin'],            # entreprise cliente
            'acme': ['Weber'],               # ancien texte libre
            'GLOBEX': ['Weber'],             # e-mail, sans tenir compte des majuscules
            'camille martin': ['Martin'],    # prénom et nom
            'pet': ['Petit'],
            '  ': ['Martin', 'Petit', 'Weber'],
            'inconnu': [],
        }
        for recherche, noms in cas.items():
            with self.subTest(recherche=recherche):
                self.assertEqual([a['nom'] for a in self.lister(recherche)], noms)

    def test_texte_ancien_ignore_si_une_entreprise_cliente_est_choisie(self):
        self.apprenant('Ana', 'Ici', entreprise='Acme', entreprise_cliente=self.durand, statut='SALARIE')
        self.assertEqual(self.lister('acme'), [])

    # ---- CA4 : aucun apprenant ----

    def test_aucun_apprenant(self):
        self.assertEqual(self.lister(), [])

    # ---- CA5 : statut obligatoire, téléphone de 10 chiffres ----

    def test_sans_statut_rien_n_est_enregistre(self):
        for statut in (None, '', 'ETUDIANT'):
            with self.subTest(statut=statut):
                corps = {} if statut is None else {'statut': statut}
                reponse = self.poster(**corps)
                self.assertEqual((reponse.status_code, reponse.json()), (400, {'statut': ['Le statut est obligatoire']}))
        self.assertFalse(Apprenant.objects.filter(organisme=self.centre).exists())

    def test_telephone_qui_n_a_pas_10_chiffres_refuse(self):
        for telephone in ('06 11 22 33 4', '061122334455', '06112233AB'):
            with self.subTest(telephone=telephone):
                reponse = self.poster(statut='PARTICULIER', telephone=telephone)
                self.assertEqual((reponse.status_code, reponse.json()),
                                 (400, {'telephone': ['Le téléphone doit contenir 10 chiffres']}))
        self.assertFalse(Apprenant.objects.filter(organisme=self.centre).exists())

    def test_telephone_facultatif_enregistre_sans_espaces(self):
        for telephone, attendu in (('06 11 22 33 44', '0611223344'), ('06.11.22.33.44', '0611223344'), ('', '')):
            with self.subTest(telephone=telephone):
                reponse = self.poster(statut='PARTICULIER', telephone=telephone)
                self.assertEqual((reponse.status_code, reponse.json()['telephone']), (201, attendu))

    # ---- CA6 : entreprise et poste pour un salarié seulement ----

    def test_salarie_avec_entreprise_cliente_et_poste(self):
        reponse = self.poster(statut='SALARIE', telephone='0611223344', entreprise_id=self.durand.id,
                              poste='Assistante RH')
        self.assertEqual(reponse.status_code, 201)
        json = reponse.json()
        self.assertEqual((json['statut'], json['entreprise'], json['entreprise_id'], json['poste'], json['nombre_sessions']),
                         ('SALARIE', 'Société Durand', self.durand.id, 'Assistante RH', 0))
        apprenant = Apprenant.objects.get(pk=json['id'])
        self.assertEqual((apprenant.organisme, apprenant.entreprise_cliente), (self.centre, self.durand))

    def test_salarie_sans_entreprise_ni_poste(self):
        json = self.poster(statut='SALARIE').json()
        self.assertEqual((json['entreprise'], json['entreprise_id'], json['poste']), ('', None, ''))

    def test_entreprise_et_poste_ignores_pour_un_autre_statut(self):
        json = self.poster(statut='INDEPENDANT', entreprise_id=self.durand.id, poste='Gérant').json()
        self.assertEqual((json['statut'], json['entreprise_id'], json['poste']), ('INDEPENDANT', None, ''))

    def test_entreprise_d_un_autre_centre_refusee(self):
        ailleurs = Entreprise.objects.create(raison_sociale='Globex', siret='98765432100012', organisme=creer_centre('Autre'))
        for entreprise_id in (ailleurs.id, 999999):
            with self.subTest(entreprise_id=entreprise_id):
                reponse = self.poster(statut='SALARIE', entreprise_id=entreprise_id)
                self.assertEqual((reponse.status_code, reponse.json()['code'], list(reponse.json()['champs'])),
                                 (400, 'ENTREPRISE_INTROUVABLE', ['entreprise_id']))
        self.assertFalse(Apprenant.objects.filter(organisme=self.centre).exists())

    # ---- CA7 : l'apprenant ajouté figure dans la liste ----

    def test_apprenant_ajoute_dans_la_liste(self):
        cree = self.poster(statut='DEMANDEUR_EMPLOI').json()
        self.assertEqual([a['id'] for a in self.lister()], [cree['id']])

    # ---- CA8 : chaque centre ne voit que ses apprenants et ses entreprises ----

    def test_apprenants_et_entreprises_du_centre_seulement(self):
        autre = creer_centre('Autre centre')
        Apprenant.objects.create(prenom='Léo', nom='Ailleurs', email='leo@ailleurs.fr', organisme=autre,
                                 entreprise='Société Durand')
        Entreprise.objects.create(raison_sociale='Globex', siret='98765432100012', organisme=autre)
        self.apprenant('Ana', 'Ici')
        self.assertEqual([a['nom'] for a in self.lister()], ['Ici'])
        self.assertEqual(self.lister('durand'), [])
        self.assertEqual(self.client.get('/entreprises/').json(), [{'id': self.durand.id, 'raison_sociale': 'Société Durand'}])


class EntreprisesClientesTests(TestCase):
    """GET /entreprises/ : liste « Entreprise » de la fenêtre « Nouvel apprenant », triée par raison sociale."""

    def test_entreprises_du_centre_triees(self):
        centre = connecter(self.client).organisme
        for nom in ('Zeta', 'Alpha'):
            Entreprise.objects.create(raison_sociale=nom, siret='12345678900012', organisme=centre)
        self.assertEqual([e['raison_sociale'] for e in self.client.get('/entreprises/').json()], ['Alpha', 'Zeta'])
        self.assertEqual(str(Entreprise.objects.first()), 'Alpha')

    def test_aucune_entreprise_liste_vide(self):
        connecter(self.client)
        self.assertEqual(self.client.get('/entreprises/').json(), [])

    def test_non_connecte(self):
        reponse = self.client.get('/entreprises/')
        self.assertEqual((reponse.status_code, reponse.json()['code']), (401, 'NON_CONNECTE'))

    def test_bloque_tant_que_le_centre_n_est_pas_renseigne(self):
        connecter(self.client, centre=False)
        reponse = self.client.get('/entreprises/')
        self.assertEqual((reponse.status_code, reponse.json()['code']), (403, 'ORGANISME_A_RENSEIGNER'))
