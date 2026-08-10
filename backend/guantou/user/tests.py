from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.cache import cache
from django.db import IntegrityError, transaction
from django.test import Client, TestCase, override_settings

from guantou.models import Dialect
from user.models import UserInfo

from .tokens import generate_token
from .verification import (
    check_email_code,
    email_cache_key,
    phone_cache_key,
    phone_throttle_cache_key,
)


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


@override_settings(
    PHONE_CODE_DEMO_MODE=True,
    PHONE_CODE_TTL_SECONDS=300,
    PHONE_CODE_THROTTLE_SECONDS=60,
)
class PhoneAuthenticationTests(TestCase):
    phone = "13800000000"

    def setUp(self):
        cache.clear()
        self.client = Client()

    @patch("user.verification.generate_phone_code", return_value="123456")
    def test_demo_code_is_throttled_and_returned(self, generate_phone_code):
        response = self.client.post(
            "/users/phone-code",
            data={"phone": "138 0000-0000"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["demo_code"], "123456")
        self.assertEqual(response.json()["expires_in"], 300)
        self.assertEqual(cache.get(phone_cache_key(self.phone)), "123456")

        throttled = self.client.post(
            "/users/phone-code",
            data={"phone": self.phone},
            content_type="application/json",
        )
        self.assertEqual(throttled.status_code, 429)
        self.assertEqual(generate_phone_code.call_count, 1)

    @override_settings(PHONE_CODE_DEMO_MODE=False)
    @patch("user.verification.generate_phone_code", return_value="123456")
    def test_phone_login_is_disabled_without_demo_or_sms_delivery(
        self, generate_phone_code
    ):
        response = self.client.post(
            "/users/phone-code",
            data={"phone": self.phone},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 503)
        self.assertNotIn("demo_code", response.json())
        self.assertEqual(generate_phone_code.call_count, 0)

    def test_invalid_phone_is_rejected(self):
        response = self.client.post(
            "/users/phone-code",
            data={"phone": "23800000000"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)

    def test_verified_phone_auto_registers_then_logs_into_same_account(self):
        cache.set(phone_cache_key(self.phone), "123456", 300)
        first = self.client.post(
            "/login/phone",
            data={"phone": self.phone, "code": "123456"},
            content_type="application/json",
        )

        self.assertEqual(first.status_code, 200)
        self.assertTrue(first.json()["is_new"])
        user = User.objects.get(id=first.json()["id"])
        self.assertFalse(user.has_usable_password())
        self.assertEqual(user.user_info.telephone, self.phone)
        self.assertIsNone(cache.get(phone_cache_key(self.phone)))

        cache.delete(phone_throttle_cache_key(self.phone))
        cache.set(phone_cache_key(self.phone), "654321", 300)
        second = self.client.post(
            "/login/phone",
            data={"phone": self.phone, "code": "654321"},
            content_type="application/json",
        )

        self.assertEqual(second.status_code, 200)
        self.assertFalse(second.json()["is_new"])
        self.assertEqual(second.json()["id"], user.id)

    def test_code_is_one_time_and_wrong_code_is_rejected(self):
        cache.set(phone_cache_key(self.phone), "123456", 300)
        wrong = self.client.post(
            "/login/phone",
            data={"phone": self.phone, "code": "000000"},
            content_type="application/json",
        )
        self.assertEqual(wrong.status_code, 401)

        accepted = self.client.post(
            "/login/phone",
            data={"phone": self.phone, "code": "123456"},
            content_type="application/json",
        )
        self.assertEqual(accepted.status_code, 200)

        replay = self.client.post(
            "/login/phone",
            data={"phone": self.phone, "code": "123456"},
            content_type="application/json",
        )
        self.assertEqual(replay.status_code, 401)

    def test_nonempty_phone_identity_is_unique(self):
        first = User.objects.create_user(username="first")
        second = User.objects.create_user(username="second")
        UserInfo.objects.create(user=first, telephone=self.phone)

        with self.assertRaises(IntegrityError), transaction.atomic():
            UserInfo.objects.create(user=second, telephone=self.phone)


class WechatPasswordlessRegistrationTests(TestCase):
    @patch("user.view.wechat.OpenId.get_openid", return_value="openid-1")
    def test_wechat_registration_requires_no_password(self, get_openid):
        response = self.client.post(
            "/users/wechat/register",
            data={"jscode": "one-time-code", "username": "wx_demo_user"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        user = User.objects.get(id=response.json()["id"])
        self.assertFalse(user.has_usable_password())
        self.assertEqual(user.user_info.wechat, "openid-1")

    @patch("user.view.wechat.OpenId.get_openid", return_value="openid-1")
    def test_wechat_login_matches_openid_exactly(self, get_openid):
        partial = User.objects.create_user(username="partial")
        UserInfo.objects.create(user=partial, wechat="prefix-openid-1-suffix")

        missing = self.client.post(
            "/login/wechat",
            data={"jscode": "one-time-code"},
            content_type="application/json",
        )
        self.assertEqual(missing.status_code, 404)

        exact = User.objects.create_user(username="exact")
        UserInfo.objects.create(user=exact, wechat="openid-1")
        response = self.client.post(
            "/login/wechat",
            data={"jscode": "another-code"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["id"], exact.id)


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


class UserPrimaryDialectTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(username="collector", password="pw")
        UserInfo.objects.create(
            user=self.user,
            nickname="采集者",
            telephone="13800000000",
        )
        self.dialect = Dialect.objects.create(name="游洋", code="游洋")

    def test_public_profile_uses_dialect_ref_without_private_fields(self):
        self.user.is_staff = True
        self.user.save(update_fields=["is_staff"])
        response = self.client.get(f"/users/{self.user.id}")

        self.assertEqual(response.status_code, 200)
        profile = response.json()["user"]
        self.assertIsNone(profile["primary_dialect"])
        self.assertNotIn("telephone", profile)
        self.assertNotIn("email", profile)
        self.assertNotIn("is_staff", profile)

    def test_owner_profile_exposes_staff_capability(self):
        self.user.is_staff = True
        self.user.save(update_fields=["is_staff"])

        response = self.client.get(
            f"/users/{self.user.id}",
            HTTP_AUTHORIZATION=f"Bearer {generate_token(self.user)}",
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["user"]["is_staff"])
        self.assertIsNone(response.json()["user"]["birthday"])
        self.assertTrue(response.json()["user"]["avatar"])

    def test_owner_cannot_claim_another_accounts_phone(self):
        other = User.objects.create_user(username="other", password="pw")
        UserInfo.objects.create(
            user=other,
            nickname="其他用户",
            telephone="13900000000",
        )

        response = self.client.put(
            f"/users/{self.user.id}",
            data='{"user": {"telephone": "139 0000 0000"}}',
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {generate_token(self.user)}",
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["message"], "手机号已被其他账号使用")

    def test_owner_can_update_primary_dialect_id(self):
        response = self.client.put(
            f"/users/{self.user.id}",
            data=f'{{"user": {{"primary_dialect_id": {self.dialect.id}}}}}',
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {generate_token(self.user)}",
        )

        self.assertEqual(response.status_code, 200)
        self.user.user_info.refresh_from_db()
        self.assertEqual(self.user.user_info.primary_dialect_id, self.dialect.id)
        self.assertTrue(
            self.user.user_info.followed_dialects.filter(id=self.dialect.id).exists()
        )
        self.assertEqual(
            response.json()["user"]["primary_dialect"]["qualified_code"],
            "游洋",
        )
        self.assertEqual(response.json()["user"]["telephone"], "13800000000")
