from django.contrib.auth.models import User
from django.test import Client, TestCase

from user.models import UserInfo
from user.tokens import generate_token


class InboxApiTests(TestCase):
    def setUp(self):
        self.sender = User.objects.create_user(username="sender", password="pw")
        self.recipient = User.objects.create_user(username="recipient", password="pw")
        UserInfo.objects.create(user=self.sender, nickname="发送者")
        UserInfo.objects.create(user=self.recipient, nickname="接收者")
        self.client = Client()

    def test_send_list_detail_and_mark_read(self):
        response = self.client.post(
            "/api/notifications",
            data='{"recipients": [%d], "title": "通知", "content": "内容"}'
            % self.recipient.id,
            content_type="application/json",
            HTTP_TOKEN=generate_token(self.sender),
        )
        self.assertEqual(response.status_code, 200)
        notification_id = response.json()["notifications"][0]

        response = self.client.get(
            "/api/notifications",
            HTTP_TOKEN=generate_token(self.recipient),
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["total"], 1)

        response = self.client.get(
            f"/api/notifications/{notification_id}",
            HTTP_TOKEN=generate_token(self.recipient),
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()["unread"])
