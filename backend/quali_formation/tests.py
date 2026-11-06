from datetime import date
from io import StringIO

from django.core.management import call_command
from django.test import SimpleTestCase, TestCase
from django.utils import timezone

from quali_formation.blocs import BLOCS, blocs_manquants
from quali_formation.models import Formation, FormationHistorique, Item, Utilisateur

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
def connecter(client, email='camille@organisme.fr'):
    """Crée un compte et ouvre sa session (SCRUM-16) : les formations sont réservées au compte connecté."""
    compte = Utilisateur.objects.create(email=email, mot_de_passe='x', cgu_acceptees_le=timezone.now())
    connecter_existant(client, compte)
    return compte


def connecter_existant(client, compte):
    session = client.session
    session['utilisateur_id'] = compte.pk
    session.save()


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
    def setUp(self):
        self.compte = connecter(self.client)

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
        self.assertEqual(self.creer(intitule='Excel').json()['reference'], f'FOR-{ANNEE}-002')

    def test_version_augmente_a_chaque_modification(self):  # RG04
        f = self.creer().json()
        self.assertEqual(f['version'], 1)
        self.assertEqual(self.modifier(f['id']).json()['version'], 2)
        self.assertEqual(self.modifier(f['id'], intitule='Management 2').json()['version'], 3)

    # ---------- Même intitulé (SCRUM-20) ----------
    def test_meme_intitule_refuse_en_brouillon_et_en_validation(self):
        self.creer(intitule="Management d'équipe")
        for corps in ({}, {'action': 'valider', 'duree_heures': '7', 'forcer': True}):
            r = self.creer(intitule="Management d'équipe", **corps)
            self.assertEqual(r.status_code, 409)
            self.assertEqual(r.json()['code'], 'INTITULE_EXISTANT')
            self.assertEqual(r.json()['detail'], 'Une formation portant le même nom existe déjà.')
        self.assertEqual(Formation.objects.count(), 1)

    def test_meme_intitule_ignore_majuscules_et_espaces(self):
        self.creer(intitule="Management d'équipe")
        self.assertEqual(self.creer(intitule="  MANAGEMENT   d'Équipe ").json()['code'], 'INTITULE_EXISTANT')

    def test_meme_intitule_accepte_avec_valider_quand_meme(self):
        self.creer(intitule="Management d'équipe")
        r = self.creer(intitule="Management d'équipe", doublon_accepte=True)
        self.assertEqual(r.status_code, 201)
        self.assertEqual(Formation.objects.filter(intitule="Management d'équipe").count(), 2)

    def test_modifier_une_formation_sans_changer_son_intitule(self):
        f = self.creer(intitule="Management d'équipe").json()
        self.assertEqual(self.modifier(f['id']).status_code, 200)

    def test_renommer_avec_l_intitule_d_une_autre_formation(self):
        self.creer(intitule="Management d'équipe")
        f = self.creer(intitule='Excel').json()
        self.assertEqual(self.modifier(f['id'], intitule="Management d'équipe").json()['code'], 'INTITULE_EXISTANT')

    def test_meme_intitule_dans_un_autre_compte(self):
        self.creer(intitule="Management d'équipe")
        connecter(self.client, 'autre@organisme.fr')
        self.assertEqual(self.creer(intitule="Management d'équipe").status_code, 201)

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

    # ---------- Modifier, archiver, supprimer (SCRUM-23) ----------
    def ajouter_session(self, pk):
        return self.action(pk, 'sessions', date_debut='2027-02-08', date_fin='2027-02-09')

    def patch(self, pk, nom):
        return self.client.patch(f'/formations/{pk}/{nom}/', {}, content_type='application/json')

    def test_modifier_recalcule_le_statut_et_augmente_la_version(self):
        f = self.creer().json()
        r = self.modifier(f['id'], action='valider', duree_heures='7', valeurs=VALEURS_COMPLETES, sequences=[SEQUENCE])
        self.assertEqual(r.status_code, 200)
        self.assertEqual((r.json()['statut'], r.json()['version']), ('VALIDEE', 2))

    def test_modifier_400_et_404(self):
        f = self.creer().json()
        self.assertEqual(self.modifier(f['id'], intitule=' ').status_code, 400)
        self.assertEqual(self.client.put('/formations/999/', {}, content_type='application/json').status_code, 404)

    def test_archiver_puis_restaurer_en_brouillon(self):
        f = self.formation_validee()
        r = self.patch(f['id'], 'archiver')
        self.assertEqual((r.status_code, r.json()['statut']), (200, 'ARCHIVEE'))
        r = self.patch(f['id'], 'restaurer')
        self.assertEqual((r.status_code, r.json()['statut']), (200, 'BROUILLON'))

    def test_archiver_et_restaurer_en_patch_seulement(self):
        f = self.creer().json()
        self.assertEqual(self.action(f['id'], 'archiver').status_code, 405)

    def test_restaurer_une_formation_non_archivee_refuse(self):
        f = self.creer().json()
        self.assertEqual(self.patch(f['id'], 'restaurer').json()['code'], 'NON_ARCHIVEE')

    def test_une_formation_archivee_ne_se_modifie_pas(self):
        f = self.creer().json()
        self.patch(f['id'], 'archiver')
        r = self.modifier(f['id'])
        self.assertEqual((r.status_code, r.json()['code']), (409, 'ARCHIVEE'))
        self.assertEqual(self.ajouter_session(f['id']).json()['code'], 'ARCHIVEE')

    def test_supprimer_204(self):
        f = self.creer().json()
        self.assertEqual(self.client.delete(f'/formations/{f["id"]}/').status_code, 204)
        self.assertFalse(Formation.objects.exists())
        self.assertEqual(self.client.delete(f'/formations/{f["id"]}/').status_code, 404)

    def test_supprimer_une_formation_avec_sessions_409_sauf_archivee(self):
        f = self.creer().json()
        self.ajouter_session(f['id'])
        r = self.client.delete(f'/formations/{f["id"]}/')
        self.assertEqual((r.status_code, r.json()['code']), (409, 'A_DES_SESSIONS'))
        self.patch(f['id'], 'archiver')
        self.assertEqual(self.client.delete(f'/formations/{f["id"]}/').status_code, 204)

    # ---------- Historique : une ligne par action (SCRUM-20, SCRUM-23) ----------
    def test_historique_de_chaque_action_avec_la_date(self):
        f = self.creer().json()
        self.modifier(f['id'])
        self.patch(f['id'], 'archiver')
        self.patch(f['id'], 'restaurer')
        self.client.delete(f'/formations/{f["id"]}/')
        lignes = list(FormationHistorique.objects.all())
        self.assertEqual([h.action for h in lignes], ['CREATION', 'MODIFICATION', 'ARCHIVAGE', 'RESTAURATION', 'SUPPRESSION'])
        self.assertTrue(all(h.date and h.reference == f['reference'] and h.intitule == 'Management' for h in lignes))
        self.assertTrue(all(h.formation is None for h in lignes))  # la formation supprimée, l'historique reste
        self.assertTrue(all(h.utilisateur == self.compte for h in lignes))  # le compte connecté

    def test_pas_d_historique_si_l_action_est_refusee(self):
        f = self.creer().json()
        self.ajouter_session(f['id'])
        self.client.delete(f'/formations/{f["id"]}/')
        self.modifier(f['id'], intitule=' ')
        self.assertEqual([h.action for h in FormationHistorique.objects.all()], ['CREATION'])



class FormationsParCompteTests(TestCase):
    """Chaque formation appartient au compte qui l'a créée : lui seul la voit et la modifie."""

    def setUp(self):
        self.camille = connecter(self.client)
        self.sienne = self.client.post('/formations/', {'action': 'brouillon', 'modalite': 'PRESENTIEL', 'intitule': 'Excel'},
                                       content_type='application/json').json()
        self.lucas = connecter(self.client, 'lucas@organisme.fr')

    def test_la_formation_appartient_au_compte_qui_la_cree(self):
        self.assertEqual(Formation.objects.get(pk=self.sienne['id']).proprietaire, self.camille)

    def test_un_compte_ne_voit_que_ses_formations(self):
        self.client.post('/formations/', {'action': 'brouillon', 'modalite': 'PRESENTIEL', 'intitule': 'Word'}, content_type='application/json')
        self.assertEqual([f['intitule'] for f in self.client.get('/formations/').json()], ['Word'])
        connecter_existant(self.client, self.camille)
        self.assertEqual([f['intitule'] for f in self.client.get('/formations/').json()], ['Excel'])

    def test_404_formation_introuvable_pour_la_formation_d_un_autre_compte(self):
        pk = self.sienne['id']
        appels = [
            self.client.get(f'/formations/{pk}/'),
            self.client.put(f'/formations/{pk}/', {'action': 'brouillon', 'modalite': 'PRESENTIEL', 'intitule': 'Pirate'}, content_type='application/json'),
            self.client.delete(f'/formations/{pk}/'),
            self.client.patch(f'/formations/{pk}/archiver/', {}, content_type='application/json'),
            self.client.patch(f'/formations/{pk}/restaurer/', {}, content_type='application/json'),
            self.client.post(f'/formations/{pk}/publier/', {}, content_type='application/json'),
            self.client.post(f'/formations/{pk}/retirer-publication/', {}, content_type='application/json'),
            self.client.post(f'/formations/{pk}/sessions/', {'date_debut': '2027-02-08', 'date_fin': '2027-02-08'},
                             content_type='application/json'),
        ]
        for r in appels:
            self.assertEqual((r.status_code, r.json()), (404, {'code': 'FORMATION_INTROUVABLE', 'detail': 'Formation introuvable'}))
        f = Formation.objects.get(pk=pk)  # rien n'a changé
        self.assertEqual((f.intitule, f.statut, f.version, f.sessions.count()), ('Excel', 'BROUILLON', 1, 0))

    def test_meme_message_pour_une_formation_qui_n_existe_pas(self):
        r = self.client.get('/formations/999999/')
        self.assertEqual((r.status_code, r.json()['detail']), (404, 'Formation introuvable'))

    def test_401_si_personne_n_est_connecte(self):
        self.client.logout()
        for r in (self.client.get('/formations/'), self.client.get(f'/formations/{self.sienne["id"]}/'),
                  self.client.post('/formations/', {'action': 'brouillon', 'modalite': 'PRESENTIEL', 'intitule': 'X'}, content_type='application/json'),
                  self.client.get('/sessions/')):
            self.assertEqual((r.status_code, r.json()['code']), (401, 'NON_CONNECTE'))

    def test_les_formations_d_avant_la_regle_ne_sont_plus_visibles(self):
        Formation.objects.create(reference='FOR-2025-001', intitule='Ancienne')  # sans propriétaire
        self.assertEqual([f['intitule'] for f in self.client.get('/formations/').json()], [])
        self.assertTrue(Formation.objects.filter(intitule='Ancienne').exists())  # rien n'est supprimé

    def test_la_reference_reste_unique_entre_les_comptes(self):
        r = self.client.post('/formations/', {'action': 'brouillon', 'modalite': 'PRESENTIEL', 'intitule': 'Word'}, content_type='application/json')
        self.assertEqual(r.json()['reference'], f'FOR-{ANNEE}-002')


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
