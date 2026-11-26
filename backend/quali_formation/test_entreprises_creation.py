"""SCRUM-113 : création d'une entreprise cliente (recherche dans l'annuaire officiel, enregistrement, SIRET unique par
centre). L'API de l'État est simulée : aucun appel réseau."""

import io
import json
from types import SimpleNamespace
from unittest import mock
from urllib.error import URLError

from django.test import SimpleTestCase, TestCase

from quali_formation.entreprises import (
    RechercheEntreprises,
    RechercheTropCourte,
    ServiceEntreprisesIndisponible,
    forme_juridique,
    recherche_entreprises,
)
from quali_formation.formes_juridiques import CATEGORIES_JURIDIQUES
from quali_formation.models import Entreprise
from quali_formation.tests import connecter, creer_centre

UTILISATEUR = SimpleNamespace(id=42)
DURAND = {
    'nom_complet': 'SOCIETE DURAND (SD)', 'nom_raison_sociale': 'SOCIETE DURAND', 'nature_juridique': '5710',
    'activite_principale': '47.11B',
    'siege': {'siret': '38945612300034', 'numero_voie': '12', 'type_voie': 'RUE', 'libelle_voie': 'DE LA PAIX',
              'code_postal': '75002', 'libelle_commune': 'PARIS', 'activite_principale': '47.11B'},
    'matching_etablissements': [],
}
FILS = {
    'nom_complet': 'DURAND ET FILS', 'nom_raison_sociale': None, 'nature_juridique': '5499',
    'siege': {'siret': '51287496300027', 'adresse': '3 QUAI DU RHONE 69002 LYON', 'code_postal': '69002',
              'libelle_commune': 'LYON'},
    'matching_etablissements': [{'siret': '51287496300035', 'adresse': '8 RUE NEUVE 69001 LYON', 'code_postal': '69001',
                                 'libelle_commune': 'LYON'}],
}
SOCIETE_DURAND = {'siret': '38945612300034', 'raison_sociale': 'SOCIETE DURAND', 'forme_juridique': 'SAS',
                  'code_naf': '47.11B', 'adresse': '12 RUE DE LA PAIX', 'code_postal': '75002', 'ville': 'PARIS'}


def api(reponse=None, erreur=None):
    appels = []

    def ouvrir(requete, timeout):
        appels.append(requete.full_url)
        if erreur:
            raise erreur
        return io.BytesIO(json.dumps(reponse).encode())
    return ouvrir, appels


class RechercheAnnuaireTests(SimpleTestCase):
    def chercher(self, texte, reponse=None, erreur=None):
        ouvrir, appels = api(reponse, erreur)
        with self.assertLogs('quali_formation.metier', level='INFO') as logs:
            resultat = RechercheEntreprises(ouvrir).chercher(texte, UTILISATEUR)
        return resultat, appels, logs.records[0]

    def test_etablissements_avec_tous_leurs_champs(self):
        resultat, appels, ligne = self.chercher(' durand ', {'results': [DURAND, FILS]})
        self.assertEqual(resultat['statut'], 'TROUVEE')
        self.assertEqual(resultat['nombre'], 2)
        self.assertEqual(resultat['etablissements'][0], SOCIETE_DURAND)
        # Établissement correspondant à la recherche plutôt que le siège ; adresse sans code postal ni ville
        self.assertEqual(resultat['etablissements'][1], {
            'siret': '51287496300035', 'raison_sociale': 'DURAND ET FILS', 'forme_juridique': 'SARL', 'code_naf': '',
            'adresse': '8 RUE NEUVE', 'code_postal': '69001', 'ville': 'LYON'})
        self.assertIn('q=durand', appels[0])
        self.assertIn('per_page=10', appels[0])
        # Mêmes logs que SCRUM-221, sans le texte cherché
        self.assertEqual((ligne.levelname, ligne.method, getattr(ligne, 'utilisateur.id'), getattr(ligne, 'resultat.statut'),
                          getattr(ligne, 'resultat.nombre')), ('INFO', 'chercher', '42', 'TROUVEE', '2'))
        self.assertFalse(hasattr(ligne, 'texte'))

    def test_siret_complet_ne_garde_que_cet_etablissement(self):
        resultat, appels, _ = self.chercher('512 874 963 00027', {'results': [FILS]})
        self.assertEqual([e['siret'] for e in resultat['etablissements']], ['51287496300027'])
        self.assertIn('q=51287496300027', appels[0])

    def test_aucun_etablissement(self):
        resultat, _, ligne = self.chercher('zyxwq', {'results': []})
        self.assertEqual(resultat, {'statut': 'INTROUVABLE', 'nombre': 0, 'etablissements': []})
        self.assertEqual(getattr(ligne, 'resultat.statut'), 'INTROUVABLE')
        self.assertEqual(self.chercher('zyx', {'inattendu': 1})[0]['nombre'], 0)

    def test_dix_resultats_au_plus(self):
        reponse = {'results': [{**DURAND, 'siege': {**DURAND['siege'], 'siret': f'389456123{i:05d}'}} for i in range(12)]}
        self.assertEqual(self.chercher('durand', reponse)[0]['nombre'], 10)

    def test_moins_de_3_caracteres_sans_appel(self):
        ouvrir, appels = api({'results': []})
        with self.assertRaises(RechercheTropCourte):
            RechercheEntreprises(ouvrir).chercher(' du ', UTILISATEUR)
        self.assertEqual(appels, [])

    def test_annuaire_indisponible(self):
        ouvrir, _ = api(erreur=URLError('hors ligne'))
        with self.assertLogs('quali_formation.metier', level='ERROR'), self.assertRaises(ServiceEntreprisesIndisponible):
            RechercheEntreprises(ouvrir).chercher('durand', UTILISATEUR)

    def test_formes_juridiques(self):
        # Libellé court des formes courantes, sinon libellé officiel INSEE (ex. : SIRET 13002526500013, code 7120)
        self.assertEqual([forme_juridique(c) for c in ('5710', '5720', '5499', '6540', '1000', '7120', '2110', '5599')],
                         ['SAS', 'SASU', 'SARL', 'SCI', 'Entrepreneur individuel', "Service central d'un ministère",
                          'Indivision entre personnes physiques', "SA à conseil d'administration (s.a.i.)"])
        # Code hors nomenclature : libellé de sa famille, sinon vide
        self.assertEqual([forme_juridique(c) for c in ('5799', '9999', None)], ['SAS', '', ''])

    def test_toutes_les_formes_juridiques_ont_un_libelle_enregistrable(self):
        self.assertEqual(len(CATEGORIES_JURIDIQUES), 260)
        for code in CATEGORIES_JURIDIQUES:
            self.assertTrue(len(code) == 4 and code.isdigit() and 0 < len(forme_juridique(code)) <= 100, code)
        # Libellé trop long pour le champ : sigle officiel
        self.assertEqual([forme_juridique(c) for c in ('5570', '5770')], ["SPFPL SA à conseil d'administration", 'SPFPL SAS'])


class AnnuaireVueTests(TestCase):
    def setUp(self):
        connecter(self.client)

    def get(self, recherche, reponse=None, erreur=None):
        ouvrir, _ = api(reponse, erreur)
        with mock.patch.object(recherche_entreprises, '_ouvrir', ouvrir), self.assertLogs('quali_formation', level='INFO'):
            return self.client.get(f'/annuaire-entreprises/?recherche={recherche}')

    def test_resultats(self):
        reponse = self.get('durand', {'results': [DURAND]})
        self.assertEqual((reponse.status_code, reponse.json()), (200, [SOCIETE_DURAND]))

    def test_aucun_resultat(self):
        self.assertEqual(self.get('zyxwq', {'results': []}).json(), [])

    def test_trop_court_et_indisponible(self):
        reponse = self.client.get('/annuaire-entreprises/?recherche=du')
        self.assertEqual((reponse.status_code, reponse.json()['code']), (400, 'RECHERCHE_TROP_COURTE'))
        reponse = self.get('durand', erreur=URLError('hors ligne'))
        self.assertEqual((reponse.status_code, reponse.json()['code']), (503, 'SERVICE_INDISPONIBLE'))

    def test_non_connecte(self):
        self.client.logout()
        self.assertEqual(self.client.get('/annuaire-entreprises/?recherche=durand').status_code, 401)


class CreationEntrepriseTests(TestCase):
    def setUp(self):
        self.compte = connecter(self.client)

    def poster(self, **corps):
        corps = {'raison_sociale': 'SOCIETE DURAND', 'siret': '389 456 123 00034', 'forme_juridique': 'SAS',
                 'code_naf': '47.11B', 'adresse': '12 RUE DE LA PAIX', 'code_postal': '75002', 'ville': 'PARIS', **corps}
        return self.client.post('/entreprises/', corps, content_type='application/json')

    def test_cree_avec_les_seuls_champs_obligatoires(self):
        reponse = self.poster(forme_juridique='', code_naf='')
        self.assertEqual(reponse.status_code, 201)
        self.assertEqual(reponse.json(), {'id': reponse.json()['id'], 'raison_sociale': 'SOCIETE DURAND',
                                          'siret': '38945612300034', 'ville': 'PARIS', 'opco': '', 'interlocuteur': '',
                                          'nombre_salaries': 0})
        entreprise = Entreprise.objects.get()
        self.assertEqual((entreprise.organisme, entreprise.adresse, entreprise.code_postal, entreprise.adresse_facturation),
                         (self.compte.organisme, '12 RUE DE LA PAIX', '75002', ''))
        # Elle apparaît dans la liste de l'onglet (SCRUM-120)
        self.assertEqual([e['raison_sociale'] for e in self.client.get('/entreprises/').json()], ['SOCIETE DURAND'])

    def test_cree_avec_facturation_contact_et_interlocuteur(self):
        reponse = self.poster(adresse_facturation_identique=False, adresse_facturation='5 AVENUE DES CHAMPS, 75008 PARIS',
                              email='contact@durand.fr', interlocuteur_prenom='Hugo', interlocuteur_nom='Weber',
                              interlocuteur_role='RESSOURCES_HUMAINES', interlocuteur_email='h.weber@durand.fr',
                              interlocuteur_telephone='06 12 34 56 78')
        self.assertEqual(reponse.status_code, 201)
        self.assertEqual(reponse.json()['interlocuteur'], 'Hugo Weber')
        e = Entreprise.objects.get()
        self.assertEqual((e.forme_juridique, e.code_naf, e.adresse_facturation, e.email, e.interlocuteur_role,
                          e.interlocuteur_email, e.interlocuteur_telephone),
                         ('SAS', '47.11B', '5 AVENUE DES CHAMPS, 75008 PARIS', 'contact@durand.fr', 'RESSOURCES_HUMAINES',
                          'h.weber@durand.fr', '0612345678'))

    def test_adresse_de_facturation_ignoree_si_identique(self):
        self.poster(adresse_facturation='ailleurs')
        self.assertEqual(Entreprise.objects.get().adresse_facturation, '')

    def test_champs_obligatoires_et_formats(self):
        reponse = self.poster(raison_sociale='', siret='3894561230003', adresse=' ', code_postal='', ville='',
                              adresse_facturation_identique=False, email='contact@durand', interlocuteur_email='h.weber@',
                              interlocuteur_telephone='06 12 34 5', interlocuteur_role='STAGIAIRE')
        self.assertEqual(reponse.status_code, 400)
        erreurs = reponse.json()
        self.assertEqual({k: erreurs[k] for k in ('raison_sociale', 'siret', 'adresse', 'code_postal', 'ville', 'email',
                                                   'interlocuteur_email', 'interlocuteur_telephone')}, {
            'raison_sociale': ['Champ obligatoire'], 'siret': ['Le SIRET doit contenir 14 chiffres'],
            'adresse': ['Champ obligatoire'], 'code_postal': ['Champ obligatoire'], 'ville': ['Champ obligatoire'],
            'email': ["Format d'e-mail invalide"], 'interlocuteur_email': ["Format d'e-mail invalide"],
            'interlocuteur_telephone': ['Le téléphone doit contenir 10 chiffres']})
        self.assertIn('interlocuteur_role', erreurs)
        self.assertFalse(Entreprise.objects.exists())

    def test_adresse_de_facturation_obligatoire_si_differente(self):
        reponse = self.poster(adresse_facturation_identique=False, adresse_facturation=' ')
        self.assertEqual((reponse.status_code, reponse.json()), (400, {'adresse_facturation': ['Champ obligatoire']}))

    def test_siret_deja_enregistre_dans_le_centre(self):
        self.poster()
        reponse = self.poster(raison_sociale='Autre nom')
        self.assertEqual(reponse.status_code, 409)
        self.assertEqual(reponse.json(), {'code': 'SIRET_DEJA_ENREGISTRE', 'detail': 'Cette entreprise est déjà enregistrée',
                                          'siret': ['Cette entreprise est déjà enregistrée']})
        self.assertEqual(Entreprise.objects.count(), 1)

    def test_enregistrements_simultanes_du_meme_siret(self):
        self.poster()
        with mock.patch('quali_formation.services.Entreprise.objects.filter') as filtre:
            filtre.return_value.exists.return_value = False
            reponse = self.poster()
        self.assertEqual((reponse.status_code, reponse.json()['code']), (409, 'SIRET_DEJA_ENREGISTRE'))

    def test_un_autre_centre_peut_enregistrer_le_meme_siret(self):
        Entreprise.objects.create(raison_sociale='SOCIETE DURAND', siret='38945612300034', organisme=creer_centre('Autre'))
        self.assertEqual(self.poster().status_code, 201)
        self.assertEqual(Entreprise.objects.filter(siret='38945612300034').count(), 2)

    def test_compte_sans_centre(self):
        connecter(self.client, email='nouveau@organisme.fr', centre=False)
        self.assertEqual(self.poster().status_code, 403)
