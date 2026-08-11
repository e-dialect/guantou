from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from announcements.dto.announcement import announcement_all
from announcements.models import Announcement
from inbox.dto import notification_normal
from inbox.models import Notification
from user.models import UserInfo

from .models import Can, Dialect, Nameplate


class UserContentDeletionPolicyTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.dialect = Dialect.objects.create(name="测试闽南语", code="测试闽南")
        self.author = User.objects.create_user(username="departing", password="pw")
        self.viewer = User.objects.create_user(username="viewer", password="pw")
        self.staff = User.objects.create_user(
            username="staff-governance", password="pw", is_staff=True
        )
        for user in (self.author, self.viewer, self.staff):
            UserInfo.objects.create(user=user, nickname=user.username)

    def test_deleting_user_anonymizes_but_preserves_core_public_content(self):
        announcement = Announcement.objects.create(
            author=self.author,
            title="版本更新",
            content="demo 已更新",
            visibility=True,
        )
        can = Can.objects.create(
            recorder=self.author,
            submitted_dialect=self.dialect,
            audio_url="https://example.com/preserved.mp3",
            concept_text="保留乡音",
            visibility=True,
        )
        nameplate = Nameplate.objects.create(
            can=can,
            creator=self.author,
            text_content="乡音",
            source={"type": "creator"},
        )
        notification = Notification.objects.create(
            actor=self.author,
            recipient=self.viewer,
            description="旧互动仍可追溯",
        )

        self.author.delete()
        announcement.refresh_from_db()
        can.refresh_from_db()
        nameplate.refresh_from_db()
        notification.refresh_from_db()

        self.assertIsNone(announcement.author_id)
        self.assertIsNone(can.recorder_id)
        self.assertIsNone(nameplate.creator_id)
        self.assertIsNone(notification.actor_id)
        self.assertEqual(announcement_all(announcement)["author"]["id"], None)
        self.assertEqual(
            notification_normal(notification)["from"]["nickname"], "已注销用户"
        )

        self.client.force_authenticate(None)
        public = self.client.get(f"/cans/{can.id}/")
        self.assertEqual(public.status_code, 200)
        self.assertIsNone(public.data["recorder"])

        self.client.force_authenticate(self.viewer)
        self.assertEqual(
            self.client.patch(f"/cans/{can.id}/", {"source_note": "越权"}).status_code,
            403,
        )
        self.client.force_authenticate(self.staff)
        self.assertEqual(
            self.client.patch(
                f"/cans/{can.id}/", {"source_note": "管理员维护"}
            ).status_code,
            200,
        )
