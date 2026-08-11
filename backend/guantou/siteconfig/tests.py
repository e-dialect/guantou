from django.contrib.auth.models import User
from django.test import Client, TestCase

from announcements.models import Announcement
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
