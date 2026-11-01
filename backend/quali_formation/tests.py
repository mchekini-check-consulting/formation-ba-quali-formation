from django.test import SimpleTestCase, TestCase

from quali_formation.models import Item


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
