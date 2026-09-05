from django.contrib.auth.models import User
from django.test import Client, TestCase
from unittest.mock import patch
from rest_framework.test import APIClient

from guantou.models import Dialect, Recording
from user.tokens import generate_token

from .models import AnonymousVisitor, ObjectChangeLog, VisitorEvent


def bearer(user):
    return f"Bearer {generate_token(user)}"


class VisitorTrackingTests(TestCase):
    def setUp(self):
        self.client = Client()

    def test_anonymous_request_gets_and_reuses_visitor_id(self):
        response = self.client.get("/entries/", HTTP_USER_AGENT="test-agent")

        self.assertEqual(response.status_code, 200)
        visitor_id = response["X-Visitor-ID"]
        self.assertTrue(AnonymousVisitor.objects.filter(id=visitor_id).exists())
        self.assertTrue(
            VisitorEvent.objects.filter(
                path="/entries/", visitor_id=visitor_id
            ).exists()
        )

        response = self.client.get("/entries/", HTTP_X_VISITOR_ID=visitor_id)
        self.assertEqual(response["X-Visitor-ID"], visitor_id)
        self.assertEqual(AnonymousVisitor.objects.count(), 1)

    def test_infrastructure_and_privacy_minimized_requests_are_not_visitor_tracked(
        self,
    ):
        self.client.get("/static/missing.js")
        self.client.get("/media/missing.png")
        self.client.get("/admin/login/")
        self.client.get("/site-settings/capabilities")
        self.client.post(
            "/product-events/",
            {
                "session_id": "session-test-12345678",
                "event_name": "listen_feed_view",
                "platform": "h5",
                "surface": "listen",
                "result": "view",
                "metadata": {"tab": "today"},
            },
            content_type="application/json",
        )
        self.client.options("/entries/")

        self.assertEqual(VisitorEvent.objects.count(), 0)
        self.assertEqual(AnonymousVisitor.objects.count(), 0)

    def test_visitor_write_failure_never_changes_the_business_response(self):
        with patch(
            "audit.middleware.AnonymousVisitor.objects.update_or_create",
            side_effect=RuntimeError("database is locked"),
        ):
            response = self.client.get("/entries/")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response["X-Visitor-ID"])

    def test_event_write_failure_never_changes_the_business_response(self):
        with patch(
            "audit.middleware.VisitorEvent.objects.create",
            side_effect=RuntimeError("database is locked"),
        ):
            response = self.client.get("/entries/")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response["X-Visitor-ID"])


class ObjectChangeLogTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="collector", password="pw")
        self.dialect = Dialect.objects.create(name="Puxian", code="puxian")
        self.client = APIClient()
        ObjectChangeLog.objects.all().delete()

    def test_create_update_recording_writes_change_logs_with_actor_context(self):
        response = self.client.post(
            "/recordings/",
            data={
                "audio_url": "https://example.com/audio.mp3",
                "usage_dialect_id": self.dialect.id,
                "original_gloss": "moon",
            },
            format="json",
            HTTP_AUTHORIZATION=bearer(self.user),
            HTTP_X_REQUEST_ID="audit-create",
        )

        self.assertEqual(response.status_code, 201)
        recording_id = response.data["id"]
        create_log = ObjectChangeLog.objects.get(
            action="create",
            object_id=str(recording_id),
            content_type__model="recording",
        )
        self.assertEqual(create_log.actor_user, self.user)
        self.assertIsNotNone(create_log.actor_visitor)
        self.assertEqual(create_log.request_id, "audit-create")

        response = self.client.patch(
            f"/recordings/{recording_id}/",
            data={"rights_statement": "speaker consent recorded"},
            format="json",
            HTTP_AUTHORIZATION=bearer(self.user),
            HTTP_X_VISITOR_ID=str(create_log.actor_visitor_id),
            HTTP_X_REQUEST_ID="audit-update",
        )

        self.assertEqual(response.status_code, 200)
        update_log = ObjectChangeLog.objects.filter(
            action="update",
            object_id=str(recording_id),
            content_type__model="recording",
        ).latest("id")
        self.assertIn("rights_statement", update_log.changed_fields)
        self.assertEqual(update_log.actor_user, self.user)
        self.assertEqual(update_log.actor_visitor_id, create_log.actor_visitor_id)
        self.assertEqual(update_log.request_id, "audit-update")

        response = self.client.delete(
            f"/recordings/{recording_id}/",
            HTTP_AUTHORIZATION=bearer(self.user),
            HTTP_X_VISITOR_ID=str(create_log.actor_visitor_id),
            HTTP_X_REQUEST_ID="audit-delete",
        )

        self.assertEqual(response.status_code, 405)
        self.assertTrue(Recording.objects.filter(pk=recording_id).exists())
        self.assertFalse(
            ObjectChangeLog.objects.filter(
                action="delete",
                object_id=str(recording_id),
                content_type__model="recording",
            ).exists()
        )

    def test_recording_read_is_not_an_object_change(self):
        recording = Recording.objects.create(
            audio_url="https://example.com/audio.mp3",
            recorder=self.user,
            usage_dialect=self.dialect,
            original_gloss="moon",
            visibility=True,
        )
        ObjectChangeLog.objects.all().delete()

        response = self.client.get(f"/recordings/{recording.id}/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(ObjectChangeLog.objects.count(), 0)
