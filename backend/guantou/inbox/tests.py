from django.contrib.auth.models import User
from django.test import Client, TestCase

from user.models import UserInfo
from user.tokens import generate_token

from .models import Notification
from .services import send_event_notification


def bearer(user):
    return f"Bearer {generate_token(user)}"


class InboxApiTests(TestCase):
    def setUp(self):
        self.sender = User.objects.create_user(username="sender", password="pw")
        self.recipient = User.objects.create_user(username="recipient", password="pw")
        UserInfo.objects.create(user=self.sender, nickname="发送者")
        UserInfo.objects.create(user=self.recipient, nickname="接收者")
        self.client = Client()

    def test_send_list_detail_and_mark_read(self):
        response = self.client.post(
            "/notifications",
            data='{"recipients": [%d], "title": "通知", "content": "内容"}'
            % self.recipient.id,
            content_type="application/json",
            HTTP_AUTHORIZATION=bearer(self.sender),
        )
        self.assertEqual(response.status_code, 200)
        notification_id = response.json()["notifications"][0]

        response = self.client.get(
            "/notifications",
            HTTP_AUTHORIZATION=bearer(self.recipient),
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["total"], 1)
        self.assertEqual(response.json()["notifications"][0]["title"], "通知")
        self.assertEqual(
            response.json()["notifications"][0]["verb"],
            Notification.Verb.SYSTEM,
        )

        response = self.client.get(
            f"/notifications/{notification_id}",
            HTTP_AUTHORIZATION=bearer(self.recipient),
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()["unread"])

    def test_event_notification_exposes_stable_verb_and_target(self):
        notification = send_event_notification(
            actor=self.sender,
            recipient=self.recipient,
            verb=Notification.Verb.CAN_LIKE,
            description="收藏了你的罐头",
            metadata={
                "target_type": "can",
                "target_id": 42,
                "target_url": "/pages/cans/details?id=42",
            },
        )

        response = self.client.get(
            "/notifications",
            HTTP_AUTHORIZATION=bearer(self.recipient),
        )

        self.assertEqual(response.status_code, 200)
        item = response.json()["notifications"][0]
        self.assertEqual(item["id"], notification.id)
        self.assertEqual(item["verb"], Notification.Verb.CAN_LIKE)
        self.assertEqual(
            item["target"],
            {"type": "can", "id": 42, "url": "/pages/cans/details?id=42"},
        )

    def test_event_notification_suppresses_self_notifications(self):
        result = send_event_notification(
            actor=self.sender,
            recipient=self.sender,
            verb=Notification.Verb.CAN_LIKE,
        )

        self.assertIsNone(result)
        self.assertFalse(Notification.objects.exists())
