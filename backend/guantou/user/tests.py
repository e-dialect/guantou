from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import Client, TestCase, override_settings

from .tokens import generate_token
from .verification import check_email_code, email_cache_key


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class EmailVerificationTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = Client()

    @patch("user.verification.generate_email_code", return_value="123456")
    def test_send_and_consume_email_code(self, generate_email_code):
        response = self.client.post(
            "/users/email-code",
            data='{"email": "User@Example.com"}',
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(cache.get(email_cache_key("user@example.com")), "123456")
        self.assertTrue(check_email_code("user@example.com", "123456"))
        self.assertFalse(check_email_code("user@example.com", "123456"))

    def test_reject_invalid_email(self):
        response = self.client.post(
            "/users/email-code",
            data='{"email": "invalid"}',
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)


class BearerTokenTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(username="collector", password="pw")

    def test_login_and_refresh_token_with_authorization_bearer(self):
        response = self.client.post(
            "/login",
            data='{"username": "collector", "password": "pw"}',
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        token = response.json()["token"]

        response = self.client.put(
            "/login",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["id"], self.user.id)
        self.assertIn("token", response.json())

    def test_refresh_token_rejects_legacy_token_header(self):
        response = self.client.put(
            "/login",
            HTTP_TOKEN=generate_token(self.user),
        )

        self.assertEqual(response.status_code, 401)
