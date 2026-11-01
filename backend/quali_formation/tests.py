from django.test import SimpleTestCase, TestCase

from quali_formation.models import Formation, Item


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


class FormationsViewTests(TestCase):
    def test_liste_les_formations_par_id(self):
        Formation.objects.create(nom="a")
        Formation.objects.create(nom="b", description="d", duree_heures=7, date_debut="2026-01-05")
        response = self.client.get("/formations")
        self.assertEqual(response.status_code, 200)
        self.assertEqual([f["nom"] for f in response.json()], ["a", "b"])
        self.assertEqual(
            set(response.json()[1]), {"id", "nom", "description", "dureeHeures", "dateDebut", "creeLe"}
        )
        self.assertEqual(response.json()[1]["dureeHeures"], 7)
        self.assertEqual(response.json()[1]["dateDebut"], "2026-01-05")

    def test_cree_une_formation_nettoyee(self):
        response = self.client.post(
            "/formations",
            {"nom": "  Django avancé  ", "description": "  ", "dureeHeures": 14},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["nom"], "Django avancé")
        self.assertIsNone(response.json()["description"])
        self.assertEqual(response.json()["dureeHeures"], 14)
        self.assertIsNotNone(response.json()["creeLe"])
        self.assertEqual(Formation.objects.count(), 1)

    def test_refuse_un_nom_vide(self):
        response = self.client.post("/formations", {"nom": " "}, content_type="application/json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Formation.objects.count(), 0)

    def test_recupere_une_formation(self):
        formation = Formation.objects.create(nom="a")
        response = self.client.get(f"/formations/{formation.id}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["nom"], "a")

    def test_formation_introuvable_renvoie_404(self):
        response = self.client.get("/formations/999")
        self.assertEqual(response.status_code, 404)

    def test_modifie_une_formation(self):
        formation = Formation.objects.create(nom="a", duree_heures=5)
        response = self.client.put(
            f"/formations/{formation.id}",
            {"nom": "a modifiée", "dureeHeures": 10},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["nom"], "a modifiée")
        self.assertEqual(response.json()["dureeHeures"], 10)

    def test_modifier_une_formation_introuvable_renvoie_404(self):
        response = self.client.put(
            "/formations/999", {"nom": "x"}, content_type="application/json"
        )
        self.assertEqual(response.status_code, 404)

    def test_supprime_une_formation(self):
        formation = Formation.objects.create(nom="a")
        response = self.client.delete(f"/formations/{formation.id}")
        self.assertEqual(response.status_code, 204)
        self.assertEqual(Formation.objects.count(), 0)

    def test_supprimer_une_formation_introuvable_renvoie_404(self):
        response = self.client.delete("/formations/999")
        self.assertEqual(response.status_code, 404)
