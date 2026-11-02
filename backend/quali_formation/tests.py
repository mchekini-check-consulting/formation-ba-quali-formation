from datetime import date
from io import StringIO

from django.core.management import call_command
from django.test import SimpleTestCase, TestCase
from django.utils import timezone

from quali_formation.blocs import BLOCS, blocs_manquants
from quali_formation.models import Formation, Item

ANNEE = timezone.localdate().year

# Réponses qui rendent les 12 blocs (hors programme) complets
VALEURS_COMPLETES = {
    'public': ['Managers'], 'besoin': 'Animer une équipe', 'prerequis': 'Aucun',
    'objectifs': 'Fixer des objectifs ; déléguer',
    'methodes': ['Exposés'], 'materiel': ['Salle équipée'], 'supports': ['Support de cours'],
    'formateurs': ['Thomas Martin'], 'assistance_dist': 'support@centre.fr',
    'acces': ['Formulaire'], 'delai': '15 jours', 'lieu': 'Lyon', 'contact': 'Camille',
    'tarif': '1 200', 'unite': 'Par apprenant', 'taxe': 'HT', 'financements': ['OPCO'],
    'ref_handicap': 'Yanis Morel', 'amenagements': ['Rythme aménagé'], 'locaux': 'PMR',
    'positionnement': ['Test de niveau'], 'eval_pendant': ['Quiz'], 'evaluation': ['QCM'], 'criteres': '70 %',
    'document': 'Attestation de réalisation', 'satisfaction': ['À chaud (fin de formation)'],
    'resultats_plan': 'Questionnaire à chaud',
}
SEQUENCE = {'titre': 'Fédérer', 'duree_heures': '7', 'objectif_vise': 'Fixer des objectifs', 'modalite': 'PRESENTIEL',
            'contenu': 'Rôle du manager', 'methodes_activites': 'Études de cas'}


class HelloViewTests(SimpleTestCase):
    def test_hello_retourne_le_message(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), "Hello, World!")


class ItemsViewTests(TestCase):
    def test_liste_les_items_par_id(self):
        Item.objects.create(nom="a")
        Item.objects.create(nom="b", description="d")
        response = self.client.get("/items")
        self.assertEqual(response.status_code, 200)
        self.assertEqual([i["nom"] for i in response.json()], ["a", "b"])
        self.assertEqual(set(response.json()[1]), {"id", "nom", "description", "creeLe"})

    def test_cree_un_item_nettoye(self):
        response = self.client.post(
            "/items", {"nom": "  Premier  ", "description": "  "}, content_type="application/json"
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["nom"], "Premier")
        self.assertIsNone(response.json()["description"])
        self.assertIsNotNone(response.json()["creeLe"])
        self.assertEqual(Item.objects.count(), 1)

    def test_refuse_un_nom_vide(self):
        response = self.client.post("/items", {"nom": " "}, content_type="application/json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Item.objects.count(), 0)


class SanteViewTests(SimpleTestCase):
    def test_sante_repond_ok(self):
        response = self.client.get("/sante/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"statut": "ok"})


class BlocsTests(SimpleTestCase):
    def test_13_blocs_en_3_parties(self):  # RG07
        self.assertEqual(len(BLOCS), 13)
        self.assertEqual({b.partie for b in BLOCS}, {0, 1, 2})

    def test_formation_complete(self):  # RG08
        self.assertEqual(blocs_manquants(VALEURS_COMPLETES, 'MIXTE', 1), [])

    def test_programme_requis(self):  # RG16
        self.assertEqual([b.id for b in blocs_manquants(VALEURS_COMPLETES, 'MIXTE', 0)], ['programme'])

    def test_resultats_une_reponse_suffit(self):  # RG09
        v = {**VALEURS_COMPLETES, 'resultats_plan': '', 'resultats_mesures': '4,6/5'}
        self.assertEqual(blocs_manquants(v, 'MIXTE', 1), [])
        v['resultats_mesures'] = ''
        self.assertEqual([b.id for b in blocs_manquants(v, 'MIXTE', 1)], ['resultats'])

    def test_assistance_a_distance_seulement_hors_presentiel(self):  # RG10
        v = {**VALEURS_COMPLETES, 'assistance_dist': ''}
        self.assertEqual(blocs_manquants(v, 'PRESENTIEL', 1), [])
        self.assertEqual([b.id for b in blocs_manquants(v, 'DISTANCIEL', 1)], ['intervenants'])


class ApiFormationsTests(TestCase):
    def creer(self, **donnees):
        corps = {'action': 'brouillon', 'intitule': 'Management', 'modalite': 'PRESENTIEL', **donnees}
        return self.client.post('/formations/', corps, content_type='application/json')

    def modifier(self, pk, **donnees):
        f = self.client.get(f'/formations/{pk}/').json()
        corps = {'action': 'brouillon', 'intitule': f['intitule'], 'modalite': f['modalite'], 'duree_heures': f['duree_heures'],
                 'valeurs': f['valeurs'], 'sequences': f['sequences'], **donnees}
        return self.client.put(f'/formations/{pk}/', corps, content_type='application/json')

    def formation_validee(self, **donnees):
        r = self.creer(action='valider', duree_heures='7', valeurs=VALEURS_COMPLETES, sequences=[SEQUENCE], **donnees)
        self.assertEqual(r.status_code, 201, r.content)
        return r.json()

    def action(self, pk, nom, **corps):
        return self.client.post(f'/formations/{pk}/{nom}/', corps, content_type='application/json')

    # ---------- Créer et modifier (RG01 à RG04) ----------
    def test_brouillon_avec_le_seul_intitule(self):  # RG02
        r = self.creer()
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.json()['statut'], 'BROUILLON')
        self.assertIsNone(r.json()['duree_heures'])

    def test_intitule_obligatoire(self):
        r = self.creer(intitule='  ')
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.json()['code'], 'INTITULE_REQUIS')

    def test_validation_exige_une_duree_superieure_a_zero(self):  # RG01
        for duree in (None, '0'):
            r = self.creer(action='valider', duree_heures=duree, forcer=True)
            self.assertEqual(r.json()['code'], 'BASE_INCOMPLETE')

    def test_reference_automatique_et_sequentielle(self):  # RG03
        self.assertEqual(self.creer().json()['reference'], f'FOR-{ANNEE}-001')
        self.assertEqual(self.creer().json()['reference'], f'FOR-{ANNEE}-002')

    def test_version_augmente_a_chaque_modification(self):  # RG04
        f = self.creer().json()
        self.assertEqual(f['version'], 1)
        self.assertEqual(self.modifier(f['id']).json()['version'], 2)
        self.assertEqual(self.modifier(f['id'], intitule='Management 2').json()['version'], 3)

    # ---------- Valider (RG13 à RG15) ----------
    def test_validee_si_tous_les_blocs_sont_complets(self):  # RG13
        f = self.formation_validee()
        self.assertEqual(f['statut'], 'VALIDEE')
        self.assertEqual(f['publication'], 'A_PUBLIER')
        self.assertEqual(f['blocs_manquants'], [])

    def test_blocs_manquants_refuses_sans_valider_quand_meme(self):  # RG14
        r = self.creer(action='valider', duree_heures='7')
        self.assertEqual(r.status_code, 409)
        self.assertEqual(r.json()['code'], 'BLOCS_MANQUANTS')
        self.assertEqual(len(r.json()['blocs']), 13)

    def test_valider_quand_meme_donne_incomplete(self):  # RG15
        r = self.creer(action='valider', duree_heures='7', forcer=True)
        self.assertEqual(r.json()['statut'], 'INCOMPLETE')

    def test_sequence_incomplete_refusee(self):  # RG18
        r = self.creer(sequences=[{**SEQUENCE, 'methodes_activites': ''}])
        self.assertEqual(r.status_code, 400)
        self.assertIn('sequences', r.json())

    def test_autre_information_sans_titre_refusee(self):  # RG12
        r = self.creer(autres_informations=[{'titre': '', 'contenu': 'x'}])
        self.assertEqual(r.status_code, 400)

    # ---------- Publication (RG24 à RG28) ----------
    def test_un_brouillon_ne_peut_pas_etre_publie(self):  # RG24
        f = self.creer().json()
        self.assertEqual(self.action(f['id'], 'publier').json()['code'], 'NON_PUBLIABLE')

    def test_publication_impossible_sans_programme(self):  # RG26
        f = self.creer(action='valider', duree_heures='7', valeurs=VALEURS_COMPLETES, forcer=True).json()
        r = self.action(f['id'], 'publier', confirmer=True)
        self.assertEqual(r.status_code, 409)
        self.assertEqual(r.json()['code'], 'PROGRAMME_REQUIS')

    def test_incomplete_publiee_apres_confirmation(self):  # RG27
        f = self.creer(action='valider', duree_heures='7', sequences=[SEQUENCE], forcer=True).json()
        self.assertEqual(self.action(f['id'], 'publier').json()['code'], 'CONFIRMATION_REQUISE')
        self.assertEqual(self.action(f['id'], 'publier', confirmer=True).json()['publication'], 'PUBLIEE')

    def test_publier_puis_retirer(self):  # RG25
        f = self.formation_validee()
        self.assertEqual(self.action(f['id'], 'publier').json()['publication'], 'PUBLIEE')
        self.assertEqual(self.action(f['id'], 'retirer-publication').json()['publication'], 'A_PUBLIER')

    def test_retour_en_brouillon_redevient_a_publier(self):  # RG28
        f = self.formation_validee()
        self.action(f['id'], 'publier')
        f = self.modifier(f['id']).json()
        self.assertEqual((f['statut'], f['publication']), ('BROUILLON', 'A_PUBLIER'))

    # ---------- Liste (RG29) ----------
    def test_liste_de_la_plus_recente_a_la_plus_ancienne(self):
        a, b = self.creer(intitule='A').json(), self.creer(intitule='B').json()
        self.modifier(a['id'])
        self.assertEqual([f['intitule'] for f in self.client.get('/formations/').json()], ['A', 'B'])
        self.assertEqual(b['version'], 1)

    # ---------- Sessions (RG38) ----------
    def test_session_dates_obligatoires_et_fin_apres_debut(self):
        f = self.creer().json()
        self.assertEqual(self.action(f['id'], 'sessions', date_debut='2027-02-08').status_code, 400)
        r = self.action(f['id'], 'sessions', date_debut='2027-02-09', date_fin='2027-02-08')
        self.assertEqual(r.json()['code'], 'DATES_INVALIDES')
        r = self.action(f['id'], 'sessions', date_debut='2027-02-08', date_fin='2027-02-08')
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.json()['sessions'][0]['date_debut'], date(2027, 2, 8).isoformat())
        self.assertIsNone(r.json()['sessions'][0]['nombre_places'])  # lieu et places facultatifs



class ChargerDemoTests(TestCase):
    def test_charge_les_exemples_dans_une_base_vide_seulement(self):
        call_command('charger_demo', stdout=StringIO())
        self.assertEqual(Formation.objects.count(), 9)
        ba = Formation.objects.get(reference='FOR-2026-019')
        self.assertEqual((ba.statut, ba.sequences.count()), ('VALIDEE', 5))
        sortie = StringIO()
        call_command('charger_demo', stdout=sortie)  # 2e appel : rien n'est chargé ni supprimé
        self.assertEqual(Formation.objects.count(), 9)
        self.assertIn('rien n’est chargé', sortie.getvalue())
