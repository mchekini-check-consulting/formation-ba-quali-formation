from django.test import SimpleTestCase


class SanteViewTests(SimpleTestCase):
    def test_sante_repond_ok(self):
        response = self.client.get("/api/sante/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"statut": "ok"})
