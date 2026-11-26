"""SCRUM-120 : liste des entreprises clientes du centre (tri, recherche, OPCO, ville, interlocuteur, nombre de salariés)."""

from django.test import TestCase

from quali_formation.models import Apprenant, Entreprise
from quali_formation.services import session_service
from quali_formation.tests import connecter, creer_centre


class EntreprisesClientesListeTests(TestCase):
    def setUp(self):
        self.compte = connecter(self.client)
        self.centre = self.compte.organisme

    def entreprise(self, raison_sociale, siret, **champs):
        return Entreprise.objects.create(raison_sociale=raison_sociale, siret=siret, organisme=self.centre, **champs)

    def salarie(self, entreprise, nom, organisme=None):
        return Apprenant.objects.create(prenom='Ana', nom=nom, email=f'{nom.lower()}@exemple.fr', statut='SALARIE',
                                        entreprise_cliente=entreprise, organisme=organisme or self.centre)

    def lister(self, recherche=None):
        url = '/entreprises/' if recherche is None else f'/entreprises/?recherche={recherche}'
        reponse = self.client.get(url)
        self.assertEqual(reponse.status_code, 200)
        return reponse.json()

    # ---- CA1 / CA2 / CA3 : triées par raison sociale, avec toutes leurs informations ----

    def test_liste_triee_avec_toutes_les_informations(self):
        durand = self.entreprise('Société Durand', '38945612300034', ville='Paris',
                                 interlocuteur_prenom='Hugo', interlocuteur_nom='Weber')
        self.entreprise('transports Vidal', '73215984600012', ville='Lille')  # minuscule : triée comme « Transports »
        self.entreprise('Atelier Leroy', '41234567800021', ville='Lyon', opco='AKTO')
        for nom in ('Martin', 'Bernard'):
            self.salarie(durand, nom)

        entreprises = self.lister()
        self.assertEqual([e['raison_sociale'] for e in entreprises], ['Atelier Leroy', 'Société Durand', 'transports Vidal'])
        self.assertEqual(entreprises[1], {
            'id': durand.id, 'raison_sociale': 'Société Durand', 'siret': '38945612300034', 'ville': 'Paris', 'opco': '',
            'interlocuteur': 'Hugo Weber', 'nombre_salaries': 2})
        self.assertEqual(entreprises[0]['opco'], 'AKTO')
        # Ni OPCO ni interlocuteur (l'écran affiche « À confirmer » et « — »), aucun salarié
        self.assertEqual({k: entreprises[2][k] for k in ('opco', 'interlocuteur', 'nombre_salaries')},
                         {'opco': '', 'interlocuteur': '', 'nombre_salaries': 0})

    def test_salaries_comptes_dans_le_centre_seulement(self):
        durand = self.entreprise('Société Durand', '38945612300034')
        self.salarie(durand, 'Martin')
        self.salarie(durand, 'Ailleurs', organisme=creer_centre('Autre'))
        self.assertEqual(self.lister()[0]['nombre_salaries'], 1)
        # Lecture d'une seule entreprise (sans annotation) : même compte
        self.assertEqual(session_service.lister_entreprises(self.compte).get().nombre_salaries, 1)

    # ---- CA4 : recherche par raison sociale, SIRET ou ville ----

    def test_recherche_par_raison_sociale_siret_ou_ville(self):
        self.entreprise('Atelier Leroy', '41234567800021', ville='Lyon')
        self.entreprise('Boulangerie Martin', '52874196300015', ville='Nantes', interlocuteur_nom='Lyonnet')
        self.entreprise('Société Durand', '38945612300034', ville='Paris')
        nom = lambda r: [e['raison_sociale'] for e in self.lister(r)]
        self.assertEqual(nom('ATELIER'), ['Atelier Leroy'])
        self.assertEqual(nom('lyon'), ['Atelier Leroy'])  # l'interlocuteur n'est pas cherché
        self.assertEqual(nom('528741'), ['Boulangerie Martin'])
        self.assertEqual(nom('389 456 123'), ['Société Durand'])
        self.assertEqual(nom('marseille'), [])
        self.assertEqual(len(self.lister('  ')), 3)

    # ---- CA5 : aucune entreprise ----

    def test_aucune_entreprise(self):
        self.assertEqual(self.lister(), [])

    # ---- CA7 : chaque centre ne voit que ses entreprises ----

    def test_ne_voit_pas_les_entreprises_d_un_autre_centre(self):
        self.entreprise('Atelier Leroy', '41234567800021')
        Entreprise.objects.create(raison_sociale='Globex', siret='98765432100012', ville='Lyon', organisme=creer_centre('Autre'))
        self.assertEqual([e['raison_sociale'] for e in self.lister()], ['Atelier Leroy'])
        self.assertEqual(self.lister('globex'), [])

    def test_compte_sans_centre_ne_voit_aucune_entreprise(self):
        self.entreprise('Atelier Leroy', '41234567800021')
        sans_centre = connecter(self.client, email='nouveau@organisme.fr', centre=False)
        self.assertFalse(session_service.lister_entreprises(sans_centre, 'atelier').exists())
