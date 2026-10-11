from django.test import SimpleTestCase


class HelloViewTests(SimpleTestCase):
    def test_hello_retourne_le_message(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), "Hello, World!")
