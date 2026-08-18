from django.contrib.auth.models import User
from django.test import Client, TestCase

from announcements.models import Announcement
from guantou.models import Can
from user.models import UserInfo
from user.tokens import generate_token

from .models import SiteSettings


def bearer(user):
    return f"Bearer {generate_token(user)}"


class SiteSettingsTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(
            username="admin", password="pw", email="admin@example.com"
        )
        UserInfo.objects.create(user=self.admin, nickname="管理员")
        self.author = User.objects.create_user(
            username="author", password="pw", email="author@example.com"
        )
        UserInfo.objects.create(user=self.author, nickname="作者")
        self.client = Client()

    def test_singleton_settings_are_reused(self):
        first = SiteSettings.get_solo()
        second = SiteSettings.get_solo()
        self.assertEqual(first.id, 1)
        self.assertEqual(first.id, second.id)

    def test_featured_announcements_keep_configured_order(self):
        first = Announcement.objects.create(
            author=self.author,
            title="第一条",
            description="",
            content="",
            visibility=True,
        )
        second = Announcement.objects.create(
            author=self.author,
            title="第二条",
            description="",
            content="",
            visibility=True,
        )
        response = self.client.put(
            "/site-settings/featured-announcements",
            data='{"featured_announcements": [%d, %d]}' % (second.id, first.id),
            content_type="application/json",
            HTTP_AUTHORIZATION=bearer(self.admin),
        )
        self.assertEqual(response.status_code, 200)
        response = self.client.get("/site-settings/featured-announcements")
        self.assertEqual(response.status_code, 200)
        ids = [
            item["announcement"]["id"]
            for item in response.json()["featured_announcements"]
        ]
        self.assertEqual(ids, [second.id, first.id])

    def test_announcement_settings_reject_dangling_hidden_and_duplicate_ids(self):
        visible = Announcement.objects.create(
            author=self.author,
            title="公开",
            content="",
            visibility=True,
        )
        hidden = Announcement.objects.create(
            author=self.author,
            title="未发布",
            content="",
            visibility=False,
        )
        settings = SiteSettings.get_solo()
        settings.featured_announcements = [visible.id]
        settings.save(update_fields=["featured_announcements"])

        for ids in ([hidden.id], [999999], [visible.id, visible.id], ["bad-id"]):
            with self.subTest(ids=ids):
                response = self.client.put(
                    "/site-settings/featured-announcements",
                    data={"featured_announcements": ids},
                    content_type="application/json",
                    HTTP_AUTHORIZATION=bearer(self.admin),
                )
                self.assertEqual(response.status_code, 400)
                settings.refresh_from_db()
                self.assertEqual(settings.featured_announcements, [visible.id])

    def test_featured_cans_configure_and_get(self):
        first = Can.objects.create(
            audio_url="https://example.com/first.mp3", visibility=True
        )
        second = Can.objects.create(
            audio_url="https://example.com/second.mp3", visibility=True
        )
        response = self.client.put(
            "/site-settings/featured-cans",
            data={"featured_cans": [second.id, first.id]},
            content_type="application/json",
            HTTP_AUTHORIZATION=bearer(self.admin),
        )
        self.assertEqual(response.status_code, 200)
        response = self.client.get(
            "/site-settings/featured-cans", HTTP_AUTHORIZATION=bearer(self.admin)
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["featured_cans"], [second.id, first.id])

    def test_featured_cans_anonymous_get_requires_admin(self):
        response = self.client.get("/site-settings/featured-cans")
        self.assertEqual(response.status_code, 401)

    def test_featured_cans_reject_dangling_hidden_and_duplicate_ids(self):
        visible = Can.objects.create(
            audio_url="https://example.com/visible.mp3", visibility=True
        )
        hidden = Can.objects.create(
            audio_url="https://example.com/hidden.mp3", visibility=False
        )
        settings = SiteSettings.get_solo()
        settings.featured_cans = [visible.id]
        settings.save(update_fields=["featured_cans"])

        for ids in (
            [hidden.id],
            [999999],
            [visible.id, visible.id],
            ["bad-id"],
            [True],
            [1.5],
            ["1"],
        ):
            with self.subTest(ids=ids):
                response = self.client.put(
                    "/site-settings/featured-cans",
                    data={"featured_cans": ids},
                    content_type="application/json",
                    HTTP_AUTHORIZATION=bearer(self.admin),
                )
                self.assertEqual(response.status_code, 400)
                settings.refresh_from_db()
                self.assertEqual(settings.featured_cans, [visible.id])
