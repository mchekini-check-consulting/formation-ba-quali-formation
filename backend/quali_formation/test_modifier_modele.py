"""SCRUM-213 « Modifier un modèle dans l'éditeur » : PUT /modeles/<type> (RG3, RG6, RG8, RG12)."""

import json

from django.test import TestCase

from quali_formation.models import Formation, ModeleGenerique, ModeleOrigine
from quali_formation.services import TAILLE_MAX_CONTENU
from quali_formation.tests import connecter, connecter_existant

PERSONNALISE = ModeleGenerique.Statut.PERSONNALISE
# Mise en forme produite par l'éditeur : gras, titre, couleur, alignement, variable
DOCUMENT = ('<h1>CONVENTION</h1><p style="text-align:center"><strong>Entre</strong> {{org_nom}} et '
            '<span style="color:#B91C1C">le client</span></p><h3>Article 1</h3><ul><li><u>Objet</u></li></ul>')


class ModifierModeleTests(TestCase):
    def setUp(self):
        self.compte = connecter(self.client)
        self.origine = ModeleOrigine.objects.get(type='CONVENTION').contenu

    def put(self, corps, type_modele='CONVENTION'):
        return self.client.put(f'/modeles/{type_modele}', data=json.dumps(corps), content_type='application/json')

    def formation(self, statut=Formation.Statut.BROUILLON, proprietaire=None):
        self.numero = getattr(self, 'numero', 0) + 1
        return Formation.objects.create(reference=f'F-{self.numero}', intitule='Formation', statut=statut,
                                        proprietaire=proprietaire or self.compte)

    def test_ca3_enregistrer_passe_le_statut_a_personnalise(self):
        reponse = self.put({'contenu': DOCUMENT})
        self.assertEqual(reponse.status_code, 200)
        corps = reponse.json()
        self.assertEqual((corps['type'], corps['statut'], corps['contenu']), ('CONVENTION', PERSONNALISE, DOCUMENT))
        self.assertEqual([v['code'] for v in corps['variables']], ['org_nom'])
        statuts = {m['type']: m['statut'] for m in self.client.get('/modeles/').json()['modeles']}
        self.assertEqual(statuts['CONVENTION'], PERSONNALISE)

    def test_ca3_rg6_nombre_de_formations_non_archivees_du_compte(self):
        self.formation()
        self.formation(Formation.Statut.VALIDEE)
        self.formation(Formation.Statut.ARCHIVEE)
        self.formation(proprietaire=connecter(self.client, 'autre@organisme-b.fr'))
        connecter_existant(self.client, self.compte)
        corps = self.put({'contenu': DOCUMENT}).json()
        self.assertEqual((corps['nb_formations_utilisant'], corps['nb_formations']), (2, 2))

    def test_ca3_aucune_formation(self):
        corps = self.put({'contenu': DOCUMENT}).json()
        self.assertEqual((corps['nb_formations_utilisant'], corps['nb_formations']), (0, 0))

    def test_ca5_rouvrir_conserve_la_mise_en_forme(self):
        self.put({'contenu': DOCUMENT})
        modele = self.client.get('/modeles/convention').json()
        self.assertEqual((modele['contenu'], modele['statut']), (DOCUMENT, PERSONNALISE))

    def test_ca4_rg8_sans_enregistrer_rien_ne_change(self):
        # « ← Retour » n'envoie rien : le modèle reste celui d'origine, aucun modèle générique n'est créé
        modele = self.client.get('/modeles/convention').json()
        self.assertEqual((modele['contenu'], modele['statut']), (self.origine, ModeleGenerique.Statut.ORIGINE))
        self.assertFalse(ModeleGenerique.objects.exists())

    def test_rg3_le_modele_d_origine_est_inchange_apres_put(self):
        self.put({'contenu': DOCUMENT})
        self.put({'contenu': '<p>Deuxième version</p>'})
        self.assertEqual(ModeleOrigine.objects.get(type='CONVENTION').contenu, self.origine)
        self.assertEqual(ModeleGenerique.objects.filter(proprietaire=self.compte).count(), 1)
        self.assertEqual(self.client.get('/modeles/CONVENTION').json()['contenu'], '<p>Deuxième version</p>')

    def test_rg12_contenu_vide_ou_sans_mention_legale_accepte(self):
        for contenu in ('', '<p>Sans article de loi</p>'):
            self.assertEqual(self.put({'contenu': contenu}).status_code, 200)

    def test_put_invalide_400(self):
        for corps in ({}, {'contenu': None}, {'contenu': 12}, {'contenu': ['<p>x</p>']},
                      {'contenu': 'x' * (TAILLE_MAX_CONTENU + 1)}):
            reponse = self.put(corps)
            self.assertEqual(reponse.status_code, 400, str(corps)[:40])
            self.assertEqual(reponse.json()['code'], 'CONTENU_INVALIDE')
        reponse = self.client.put('/modeles/CONVENTION', data='{pas du json', content_type='application/json')
        self.assertEqual(reponse.status_code, 400)
        self.assertFalse(ModeleGenerique.objects.exists())

    def test_type_inconnu_404(self):
        reponse = self.put({'contenu': DOCUMENT}, 'DEVIS')
        self.assertEqual(reponse.status_code, 404)
        self.assertEqual(reponse.json()['code'], 'MODELE_INTROUVABLE')

    def test_sans_connexion_401(self):
        self.client.logout()
        reponse = self.put({'contenu': DOCUMENT})
        self.assertEqual(reponse.status_code, 401)
        self.assertFalse(ModeleGenerique.objects.exists())

    def test_un_compte_ne_modifie_que_son_modele(self):
        self.put({'contenu': DOCUMENT})
        connecter(self.client, 'autre@organisme-b.fr')
        self.assertEqual(self.client.get('/modeles/CONVENTION').json()['contenu'], self.origine)


class LogsModifierModeleTests(TestCase):
    def test_modele_enregistre_identifiants_seulement(self):
        compte = connecter(self.client, 'marie.dupont@organisme.fr')
        with self.assertLogs('quali_formation.metier', level='INFO') as logs:
            self.client.put('/modeles/ATTESTATION', data=json.dumps({'contenu': '<p>Texte secret du document</p>'}),
                            content_type='application/json')
        (ligne,) = logs.records  # le service seulement, pas de ligne contrôleur
        self.assertEqual(ligne.levelname, 'INFO')
        self.assertEqual((ligne.layer, ligne.method), ('service', 'enregistrer'))
        self.assertEqual((getattr(ligne, 'utilisateur.id'), ligne.type_modele, getattr(ligne, 'resultat.statut')),
                         (str(compte.pk), 'ATTESTATION', 'PERSONNALISE'))
        texte = json.dumps(ligne.__dict__, default=str)
        self.assertNotIn('Texte secret', texte)
        self.assertNotIn('marie.dupont', texte)
