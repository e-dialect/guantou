from django.contrib.auth.models import User
from django.test import Client, TestCase
from unittest.mock import patch
from rest_framework.test import APIClient

from guantou.models import Can, Dialect
from user.tokens import generate_token

from .models import AnonymousVisitor, ObjectChangeLog, VisitorEvent


def bearer(user):
    return f"Bearer {generate_token(user)}"


class VisitorTrackingTests(TestCase):
    def setUp(self):
        self.client = Client()

    def test_anonymous_request_gets_and_reuses_visitor_id(self):
        response = self.client.get("/search/", {"q": " "}, HTTP_USER_AGENT="test-agent")

        self.assertEqual(response.status_code, 200)
        visitor_id = response["X-Visitor-ID"]
        self.assertTrue(AnonymousVisitor.objects.filter(id=visitor_id).exists())
        self.assertTrue(
            VisitorEvent.objects.filter(path="/search/", visitor_id=visitor_id).exists()
        )

        response = self.client.get("/search/", {"q": " "}, HTTP_X_VISITOR_ID=visitor_id)
        self.assertEqual(response["X-Visitor-ID"], visitor_id)
        self.assertEqual(AnonymousVisitor.objects.count(), 1)

    def test_static_admin_and_media_requests_are_not_recorded_as_events(self):
        self.client.get("/static/missing.js")
        self.client.get("/media/missing.png")
        self.client.get("/admin/login/")
        self.client.options("/search/")

        self.assertEqual(VisitorEvent.objects.count(), 0)
        self.assertEqual(AnonymousVisitor.objects.count(), 0)

    def test_visitor_write_failure_never_changes_the_business_response(self):
        with patch(
            "audit.middleware.AnonymousVisitor.objects.update_or_create",
            side_effect=RuntimeError("database is locked"),
        ):
            response = self.client.get("/search/", {"q": " "})

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response["X-Visitor-ID"])

    def test_event_write_failure_never_changes_the_business_response(self):
        with patch(
            "audit.middleware.VisitorEvent.objects.create",
            side_effect=RuntimeError("database is locked"),
        ):
            response = self.client.get("/search/", {"q": " "})

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response["X-Visitor-ID"])


class ObjectChangeLogTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="collector", password="pw")
        self.dialect = Dialect.objects.create(name="Puxian", code="puxian")
        self.client = APIClient()
        ObjectChangeLog.objects.all().delete()

    def test_create_update_delete_can_writes_change_logs_with_actor_context(self):
        response = self.client.post(
            "/cans/",
            data={
                "audio_url": "https://example.com/audio.mp3",
                "submitted_dialect_id": self.dialect.id,
                "concept_text": "moon",
            },
            format="json",
            HTTP_AUTHORIZATION=bearer(self.user),
            HTTP_X_REQUEST_ID="audit-create",
        )

        self.assertEqual(response.status_code, 201)
        can_id = response.data["id"]
        create_log = ObjectChangeLog.objects.get(action="create", object_id=str(can_id))
        self.assertEqual(create_log.actor_user, self.user)
        self.assertIsNotNone(create_log.actor_visitor)
        self.assertEqual(create_log.request_id, "audit-create")

        response = self.client.patch(
            f"/cans/{can_id}/",
            data={"concept_text": "moon updated"},
            format="json",
            HTTP_AUTHORIZATION=bearer(self.user),
            HTTP_X_VISITOR_ID=str(create_log.actor_visitor_id),
            HTTP_X_REQUEST_ID="audit-update",
        )

        self.assertEqual(response.status_code, 200)
        update_log = ObjectChangeLog.objects.filter(
            action="update", object_id=str(can_id)
        ).latest("id")
        self.assertIn("concept_text", update_log.changed_fields)
        self.assertEqual(update_log.actor_user, self.user)
        self.assertEqual(update_log.actor_visitor_id, create_log.actor_visitor_id)
        self.assertEqual(update_log.request_id, "audit-update")

        response = self.client.delete(
            f"/cans/{can_id}/",
            HTTP_AUTHORIZATION=bearer(self.user),
            HTTP_X_VISITOR_ID=str(create_log.actor_visitor_id),
            HTTP_X_REQUEST_ID="audit-delete",
        )

        self.assertEqual(response.status_code, 204)
        delete_log = ObjectChangeLog.objects.get(action="delete", object_id=str(can_id))
        self.assertEqual(delete_log.actor_user, self.user)
        self.assertEqual(delete_log.actor_visitor_id, create_log.actor_visitor_id)
        self.assertEqual(delete_log.request_id, "audit-delete")

    def test_can_view_counter_update_is_not_object_change_log(self):
        can = Can.objects.create(
            audio_url="https://example.com/audio.mp3",
            recorder=self.user,
            submitted_dialect=self.dialect,
            concept_text="moon",
            visibility=True,
        )
        ObjectChangeLog.objects.all().delete()

        response = self.client.get(f"/cans/{can.id}/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(ObjectChangeLog.objects.count(), 0)
