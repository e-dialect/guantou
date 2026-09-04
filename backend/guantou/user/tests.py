from unittest.mock import patch
from datetime import timedelta

from django.contrib.auth.models import User
from django.core.cache import cache
from django.db import IntegrityError, transaction
from django.test import Client, TestCase, override_settings
from django.utils import timezone

from guantou.models import Can, Dialect, Flavor, Nameplate
from user.models import EmailVerification, UserInfo
from user.view.wechat import OpenId
from utils.exceptions.types.not_found import NotFoundException
from utils.exceptions.types.unauthorized import InvalidTokenException

from .tokens import generate_token, token_user
from .verification import (
    check_email_code,
    issue_email_code,
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
        record = EmailVerification.objects.get(normalized_email="user@example.com")
        self.assertNotIn("123456", record.code_digest)
        self.assertIsNotNone(record.delivered_at)
        self.assertTrue(
            check_email_code(
                "user@example.com",
                "123456",
                EmailVerification.Purpose.REGISTER,
            )
        )
        self.assertFalse(
            check_email_code(
                "user@example.com",
                "123456",
                EmailVerification.Purpose.REGISTER,
            )
        )

    def test_reject_invalid_email(self):
        response = self.client.post(
            "/users/email-code",
            data='{"email": "invalid"}',
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

    def test_rejects_email_already_bound_to_an_account(self):
        User.objects.create_user(username="bound", email="bound@example.com")
        response = self.client.post(
            "/users/email-code",
            data='{"email": "BOUND@example.com", "purpose": "register"}',
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 409)

    @patch("user.verification.generate_email_code", return_value="123456")
    def test_email_registration_normalizes_address_and_preserves_password_hash(
        self, _generate
    ):
        issue_email_code("New@Example.com", EmailVerification.Purpose.REGISTER)
        response = self.client.post(
            "/users",
            data={
                "username": "email-register",
                "password": "new-pass-123",
                "email": " New@Example.com ",
                "code": "123456",
            },
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        user = User.objects.get(username="email-register")
        self.assertEqual(user.email, "new@example.com")
        self.assertTrue(user.check_password("new-pass-123"))

    @patch("user.verification.generate_email_code", return_value="123456")
    def test_bind_purpose_is_required_and_email_binding_succeeds(self, _generate):
        user = User.objects.create_user(username="binder", password="old-pass")
        UserInfo.objects.create(user=user, nickname="Binder")
        issue_email_code("bind@example.com", EmailVerification.Purpose.BIND)
        self.assertFalse(
            check_email_code(
                "bind@example.com", "123456", EmailVerification.Purpose.REGISTER
            )
        )
        response = self.client.put(
            f"/users/{user.id}/email",
            data={"email": "BIND@example.com", "code": "123456"},
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {generate_token(user)}",
        )
        self.assertEqual(response.status_code, 200)
        user.refresh_from_db()
        self.assertEqual(user.email, "bind@example.com")

    @override_settings(EMAIL_CODE_THROTTLE_SECONDS=0)
    @patch("user.verification.generate_email_code", side_effect=["111111", "222222"])
    def test_resend_invalidates_the_previous_code(self, _generate):
        issue_email_code("resend@example.com", EmailVerification.Purpose.REGISTER)
        issue_email_code("resend@example.com", EmailVerification.Purpose.REGISTER)
        self.assertFalse(
            check_email_code(
                "resend@example.com", "111111", EmailVerification.Purpose.REGISTER
            )
        )
        self.assertTrue(
            check_email_code(
                "resend@example.com", "222222", EmailVerification.Purpose.REGISTER
            )
        )

    @patch("user.verification.generate_email_code", return_value="123456")
    def test_expired_code_is_rejected(self, _generate):
        issue_email_code("expired@example.com", EmailVerification.Purpose.REGISTER)
        EmailVerification.objects.filter(normalized_email="expired@example.com").update(
            expires_at=timezone.now() - timedelta(seconds=1)
        )
        self.assertFalse(
            check_email_code(
                "expired@example.com", "123456", EmailVerification.Purpose.REGISTER
            )
        )

    @override_settings(EMAIL_CODE_MAX_ATTEMPTS=2)
    @patch("user.verification.generate_email_code", return_value="123456")
    def test_maximum_attempts_consumes_the_code(self, _generate):
        issue_email_code("attempts@example.com", EmailVerification.Purpose.REGISTER)
        for _ in range(2):
            self.assertFalse(
                check_email_code(
                    "attempts@example.com",
                    "000000",
                    EmailVerification.Purpose.REGISTER,
                )
            )
        self.assertFalse(
            check_email_code(
                "attempts@example.com", "123456", EmailVerification.Purpose.REGISTER
            )
        )

    @patch("user.verification.generate_email_code", return_value="123456")
    def test_email_delivery_is_throttled(self, _generate):
        first = self.client.post(
            "/users/email-code",
            data={"email": "throttle@example.com", "purpose": "register"},
            content_type="application/json",
        )
        second = self.client.post(
            "/users/email-code",
            data={"email": "throttle@example.com", "purpose": "register"},
            content_type="application/json",
        )
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 429)

    @override_settings(EMAIL_CODE_DEMO_MODE=True)
    @patch("user.verification.generate_email_code", return_value="123456")
    @patch("user.verification.send_mail")
    def test_demo_mode_returns_code_without_smtp(self, send_mail, _generate):
        response = self.client.post(
            "/users/email-code",
            data={"email": "demo@example.com", "purpose": "bind"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["demo_code"], "123456")
        self.assertEqual(payload["delivery"], "demo")
        send_mail.assert_not_called()
        self.assertTrue(
            check_email_code(
                "demo@example.com",
                "123456",
                EmailVerification.Purpose.BIND,
            )
        )

    @override_settings(EMAIL_CODE_DEMO_MODE=False)
    @patch("user.verification.generate_email_code", return_value="123456")
    def test_real_delivery_omits_demo_code(self, _generate):
        response = self.client.post(
            "/users/email-code",
            data={"email": "live@example.com", "purpose": "bind"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertNotIn("demo_code", response.json())
        self.assertEqual(response.json()["retry_after"], 60)

    @patch("user.verification.generate_email_code", return_value="123456")
    def test_password_reset_uses_username_scope_without_old_token(self, _generate):
        user = User.objects.create_user(
            username="forgotten", email="owner@example.com", password="old-pass"
        )
        UserInfo.objects.create(user=user, nickname="Owner")

        lookup = self.client.get("/login/forget", {"username": "forgotten"})
        self.assertEqual(lookup.status_code, 200)
        self.assertNotIn("owner@example.com", lookup.content.decode())

        sent = self.client.post(
            "/login/forget",
            data='{"username": "forgotten"}',
            content_type="application/json",
        )
        self.assertEqual(sent.status_code, 200)

        reset = self.client.put(
            "/login/forget",
            data='{"username": "forgotten", "code": "123456", "password": "new-pass-123"}',
            content_type="application/json",
        )
        self.assertEqual(reset.status_code, 200)
        user.refresh_from_db()
        self.assertTrue(user.check_password("new-pass-123"))

    def test_forget_lookup_requires_a_bound_email(self):
        user = User.objects.create_user(username="phoneless", password="pw")
        UserInfo.objects.create(user=user, nickname="Phone")
        response = self.client.get("/login/forget", {"username": "phoneless"})
        self.assertEqual(response.status_code, 404)
        self.assertIn("邮箱", response.json()["message"])

    @override_settings(EMAIL_CODE_DEMO_MODE=True)
    @patch("user.verification.generate_email_code", return_value="123456")
    @patch("user.verification.send_mail")
    def test_forget_post_returns_demo_code_without_smtp(self, send_mail, _generate):
        user = User.objects.create_user(
            username="demo-reset", email="reset@example.com", password="old-pass"
        )
        UserInfo.objects.create(user=user, nickname="Reset")
        response = self.client.post(
            "/login/forget",
            data='{"username": "demo-reset"}',
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["demo_code"], "123456")
        send_mail.assert_not_called()


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

    @override_settings(WECHAT_BIND_DEMO_MODE=True)
    def test_demo_bind_writes_a_local_openid(self):
        user = User.objects.create_user(username="binder")
        UserInfo.objects.create(user=user, nickname="Binder")
        response = self.client.put(
            f"/users/{user.id}/wechat",
            data='{"demo": true, "overwrite": false}',
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {generate_token(user)}",
        )
        self.assertEqual(response.status_code, 200)
        user.user_info.refresh_from_db()
        self.assertEqual(user.user_info.wechat, f"demo-wechat-{user.id}")

    @override_settings(WECHAT_BIND_DEMO_MODE=False)
    def test_demo_bind_is_rejected_when_wechat_is_configured(self):
        user = User.objects.create_user(username="live-bind")
        UserInfo.objects.create(user=user, nickname="Live")
        response = self.client.put(
            f"/users/{user.id}/wechat",
            data='{"demo": true, "overwrite": false}',
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {generate_token(user)}",
        )
        self.assertEqual(response.status_code, 400)
        user.user_info.refresh_from_db()
        self.assertEqual(user.user_info.wechat, "")


@override_settings(APP_ID="mini-app-id", APP_SECRET="canonical-mini-secret")
class WechatOpenIdTests(TestCase):
    @patch("user.view.wechat.requests.get")
    def test_uses_canonical_secret_params_and_timeout(self, request_get):
        request_get.return_value.json.return_value = {
            "openid": " openid-from-wechat ",
            "session_key": "session-key",
        }
        self.assertEqual(OpenId("one-time-code").get_openid(), "openid-from-wechat")
        request_get.assert_called_once_with(
            "https://api.weixin.qq.com/sns/jscode2session",
            params={
                "appid": "mini-app-id",
                "secret": "canonical-mini-secret",
                "js_code": "one-time-code",
                "grant_type": "authorization_code",
            },
            timeout=8,
        )

    @patch("user.view.wechat.requests.get")
    def test_rejects_wechat_error_and_malformed_json(self, request_get):
        request_get.return_value.json.return_value = {"errcode": 40029, "errmsg": "bad"}
        with self.assertRaises(NotFoundException):
            OpenId("expired-code").get_openid()

        request_get.return_value.json.side_effect = ValueError("not json")
        with self.assertRaises(NotFoundException):
            OpenId("malformed-response").get_openid()


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

    def test_token_is_invalid_after_account_username_is_replaced(self):
        token = generate_token(self.user)
        self.user.username = "replacement-login"
        self.user.save(update_fields=["username"])

        with self.assertRaises(InvalidTokenException):
            token_user(token)


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


class UserManageProfileTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(username="collector", password="pw")
        UserInfo.objects.create(user=self.user, nickname="采集者")
        self.auth = {"HTTP_AUTHORIZATION": f"Bearer {generate_token(self.user)}"}
        self.public_can = Can.objects.create(
            recorder=self.user,
            audio_url="https://example.com/public.mp3",
            visibility=True,
        )
        self.hidden_can = Can.objects.create(
            recorder=self.user,
            audio_url="https://example.com/hidden.mp3",
            visibility=False,
        )
        Flavor.objects.create(
            name="公开义项",
            definition="公开",
            created_by=self.user,
            visibility=True,
        )
        Flavor.objects.create(
            name="隐藏义项",
            definition="隐藏",
            created_by=self.user,
            visibility=False,
        )
        Nameplate.objects.create(
            can=self.public_can,
            creator=self.user,
            text_content="公开铭牌",
            definition="公开",
            source={"type": "creator"},
        )
        Nameplate.objects.create(
            can=self.hidden_can,
            creator=self.user,
            text_content="隐藏铭牌",
            definition="隐藏",
            source={"type": "creator"},
        )

    def test_owner_can_update_username_and_receives_a_new_token(self):
        old_token = generate_token(self.user)
        response = self.client.put(
            f"/users/{self.user.id}",
            data='{"user": {"username": "new-handle"}}',
            content_type="application/json",
            **self.auth,
        )

        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.username, "new-handle")
        self.assertEqual(response.json()["user"]["username"], "new-handle")
        new_token = response.json()["token"]
        self.assertEqual(token_user(new_token).id, self.user.id)
        with self.assertRaises(InvalidTokenException):
            token_user(old_token)

    def test_username_change_rejects_a_taken_name_without_saving(self):
        User.objects.create_user(username="taken", password="pw")
        response = self.client.put(
            f"/users/{self.user.id}",
            data='{"user": {"username": "Taken"}}',
            content_type="application/json",
            **self.auth,
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["message"], "用户名已被占用")
        self.assertEqual(
            response.json()["data"]["username"]["message"], "用户名已被占用"
        )
        self.user.refresh_from_db()
        self.assertEqual(self.user.username, "collector")

    def test_anonymous_profile_omits_uploaded_counts(self):
        response = self.client.get(f"/users/{self.user.id}")

        self.assertEqual(response.status_code, 200)
        contribution = response.json()["contribution"]
        self.assertEqual(contribution["cans"], 1)
        self.assertEqual(contribution["flavors"], 1)
        self.assertEqual(contribution["nameplates"], 1)
        self.assertNotIn("cans_uploaded", contribution)
        self.assertNotIn("flavors_uploaded", contribution)
        self.assertNotIn("nameplates_uploaded", contribution)

    def test_owner_profile_includes_uploaded_counts(self):
        response = self.client.get(f"/users/{self.user.id}", **self.auth)

        self.assertEqual(response.status_code, 200)
        contribution = response.json()["contribution"]
        self.assertEqual(contribution["cans"], 1)
        self.assertEqual(contribution["cans_uploaded"], 2)
        self.assertEqual(contribution["flavors"], 1)
        self.assertEqual(contribution["flavors_uploaded"], 2)
        self.assertEqual(contribution["nameplates"], 1)
        self.assertEqual(contribution["nameplates_uploaded"], 2)

    def test_owner_profile_includes_password_flag(self):
        response = self.client.get(f"/users/{self.user.id}", **self.auth)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["user"]["has_password"])

    def test_passwordless_owner_can_set_a_password_without_the_old_one(self):
        self.user.set_unusable_password()
        self.user.save(update_fields=["password"])
        response = self.client.put(
            f"/users/{self.user.id}/password",
            data='{"oldpassword": "", "newpassword": "new-pass"}',
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("new-pass"))

    def test_password_change_still_requires_the_old_password(self):
        response = self.client.put(
            f"/users/{self.user.id}/password",
            data='{"oldpassword": "wrong", "newpassword": "new-pass"}',
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(response.status_code, 401)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("pw"))


class AvatarUrlTests(TestCase):
    def test_keeps_local_dev_avatar_urls(self):
        from user.avatar import upload_avatar

        local = "http://localhost:8000/files/image/8/2026/08/27/abc.png"
        loopback = "http://127.0.0.1:8000/files/image/8/2026/08/27/abc.png"
        trusted = "https://cos.edialect.top/files/image/8/x.png"
        self.assertEqual(upload_avatar(8, local), local)
        self.assertEqual(upload_avatar(8, loopback), loopback)
        self.assertEqual(upload_avatar(8, trusted), trusted)

    def test_rejects_untrusted_avatar_when_download_fails(self):
        from user.avatar import upload_avatar

        with patch("user.avatar.download_file", return_value=None):
            with self.assertRaises(NotFoundException):
                upload_avatar(8, "https://evil.example/a.png")
