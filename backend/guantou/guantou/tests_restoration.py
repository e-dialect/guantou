import uuid
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient
from inbox.models import Notification
from user.models import UserFollow
from .models import (
    Dialect,
    Entry,
    Recording,
    RecordingEntryLink,
    CollectionRecording,
    CollectionEntry,
    RecordingComment,
    DailyRecordingSelection,
)


class RestorationTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("collector")
        self.other = User.objects.create_user("speaker")
        self.dialect = Dialect.objects.create(name="测试乡音", code="restore")
        self.entry = Entry.objects.create(
            summary="月亮", created_by=self.other, visibility=True
        )
        self.second = Entry.objects.create(
            summary="月亮", created_by=self.other, visibility=True
        )
        self.recording = Recording.objects.create(
            original_gloss="月娘",
            usage_dialect=self.dialect,
            recorder=self.other,
            audio_url="https://example.test/a.mp3",
            visibility=True,
        )
        self.link = RecordingEntryLink.objects.create(
            recording=self.recording, entry=self.entry, role="primary"
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        response = self.client.post(
            "/collections/", {"title": "月下乡音"}, format="json"
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.box = response.data["id"]
        self.url = f"/collections/{self.box}/"

    def test_directory_dedup_sort_and_no_domain_mutations(self):
        RecordingEntryLink.objects.create(
            recording=self.recording, entry=self.second, role="mention"
        )
        for entry in (self.entry, self.second):
            for _ in range(2):
                response = self.client.post(
                    self.url + "recordings/",
                    {"recording_id": self.recording.id, "entry_id": entry.id},
                )
                self.assertEqual(response.status_code, 200, response.data)
        detail = self.client.get(self.url).data
        self.assertEqual((detail["entry_count"], detail["recording_count"]), (2, 1))
        self.assertEqual(CollectionRecording.objects.count(), 2)
        ids = [section["id"] for section in detail["sections"]]
        self.assertEqual(
            self.client.post(
                self.url + "order/", {"ids": ids[::-1]}, format="json"
            ).status_code,
            200,
        )
        self.assertEqual(self.client.get(self.url).data["sections"][0]["id"], ids[-1])
        self.assertEqual(
            self.client.post(
                self.url + "order/", {"ids": [ids[0]]}, format="json"
            ).status_code,
            400,
        )
        self.assertEqual(RecordingEntryLink.objects.count(), 2)

    def test_private_and_hidden_resources_are_not_leaked(self):
        self.client.post(
            self.url + "recordings/",
            {"recording_id": self.recording.id, "entry_id": self.entry.id},
        )
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(self.url).status_code, 404)
        self.client.force_authenticate(self.user)
        self.client.patch(self.url, {"is_public": True}, format="json")
        self.recording.visibility = False
        self.recording.save()
        self.client.force_authenticate(None)
        data = self.client.get(self.url).data
        self.assertEqual(data["recording_count"], 0)
        self.assertEqual(data["sections"][0]["recordings"], [])
        self.assertEqual(
            self.client.get(f"/recordings/{self.recording.id}/").status_code, 404
        )
        self.assertEqual(
            self.client.get(
                "/recording-comments/", {"recording_id": self.recording.id}
            ).status_code,
            404,
        )
        self.assertEqual(self.client.get("/recordings/daily/").status_code, 204)
        self.assertEqual(self.client.get("/recordings/random/").status_code, 204)
        self.client.force_authenticate(self.other)
        self.assertEqual(
            self.client.patch(self.url, {"title": "hijack"}).status_code, 403
        )

    def test_pending_confirmation_and_invalid_relation(self):
        self.link.delete()
        self.client.post(self.url + "recordings/", {"recording_id": self.recording.id})
        self.assertEqual(len(self.client.get(self.url).data["pending"]), 1)
        link = RecordingEntryLink.objects.create(
            recording=self.recording, entry=self.entry
        )
        self.assertEqual(len(self.client.get(self.url).data["pending"]), 1)
        self.client.post(
            self.url + "recordings/",
            {"recording_id": self.recording.id, "entry_id": self.entry.id},
        )
        self.assertEqual(self.client.get(self.url).data["pending"], [])
        link.status = "rejected"
        link.save()
        self.assertTrue(
            self.client.get(self.url).data["sections"][0]["recordings"][0][
                "needs_review"
            ]
        )
        self.client.patch(self.url, {"is_public": True})
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(self.url).data["recording_count"], 0)

    def test_like_comment_retry_reply_and_notification(self):
        url = f"/recordings/{self.recording.id}/like/"
        for _ in range(2):
            self.assertEqual(self.client.put(url).status_code, 200)
        self.client.delete(url)
        self.client.put(url)
        self.assertEqual(Notification.objects.filter(verb="recording.like").count(), 1)
        data = {
            "recording_id": self.recording.id,
            "body": "我这里也听过",
            "client_id": str(uuid.uuid4()),
        }
        first = self.client.post("/recording-comments/", data, format="json")
        self.assertEqual(first.status_code, 201, first.data)
        self.assertEqual(
            self.client.post("/recording-comments/", data, format="json").status_code,
            200,
        )
        self.assertEqual(RecordingComment.objects.count(), 1)
        data["body"] = "不能复用请求编号改变内容"
        self.assertEqual(
            self.client.post("/recording-comments/", data, format="json").status_code,
            400,
        )
        reply = self.client.post(
            "/recording-comments/",
            {**data, "client_id": str(uuid.uuid4()), "parent_id": first.data["id"]},
            format="json",
        )
        self.assertEqual(reply.status_code, 201)
        bad = self.client.post(
            "/recording-comments/",
            {**data, "client_id": str(uuid.uuid4()), "parent_id": reply.data["id"]},
            format="json",
        )
        self.assertEqual(bad.status_code, 404)
        self.client.delete(f'/recording-comments/{first.data["id"]}/')
        self.assertEqual(
            self.client.get(
                "/recording-comments/", {"recording_id": self.recording.id}
            ).data["count"],
            0,
        )

    def test_search_daily_following_and_hidden_entry_link(self):
        self.assertEqual(
            self.client.get("/entries/suggestions/", {"q": "月亮"}).status_code, 200
        )
        self.assertEqual(
            len(self.client.get("/entries/suggestions/", {"q": "月亮"}).data), 2
        )
        self.assertEqual(self.client.get("/entries/popular/").status_code, 200)
        first = self.client.get("/recordings/daily/").data["id"]
        self.assertEqual(self.client.get("/recordings/daily/").data["id"], first)
        self.assertEqual(DailyRecordingSelection.objects.count(), 1)
        self.assertEqual(
            self.client.get("/recordings/", {"following": "true"}).data["count"], 0
        )
        UserFollow.objects.create(follower=self.user, followed=self.other)
        self.assertEqual(
            self.client.get("/recordings/", {"following": "true"}).data["count"], 1
        )
        self.entry.visibility = False
        self.entry.save()
        self.client.force_authenticate(None)
        self.assertEqual(
            self.client.get(f"/recordings/{self.recording.id}/").data["entry_links"], []
        )
        self.assertEqual(
            len(self.client.get("/entries/suggestions/", {"q": "月亮"}).data), 1
        )

    def test_hidden_sections_remain_archived_without_blocking_visible_order(self):
        third = Entry.objects.create(
            summary="雨", created_by=self.other, visibility=True
        )
        for entry in (self.entry, self.second, third):
            self.client.post(self.url + "entries/", {"entry_id": entry.id})
        hidden_section = CollectionEntry.objects.get(entry=self.second)
        self.second.visibility = False
        self.second.save()
        data = self.client.get(self.url).data
        self.assertEqual(data["unavailable_count"], 1)
        ids = [section["id"] for section in data["sections"]]
        response = self.client.post(
            self.url + "order/", {"ids": ids[::-1]}, format="json"
        )
        self.assertEqual(response.status_code, 200)
        hidden_section.refresh_from_db()
        self.assertEqual(hidden_section.sort_order, 1)
        self.assertEqual(CollectionEntry.objects.count(), 3)

    def test_collection_serialization_batches_repeated_recordings(self):
        from django.db import connection
        from django.test.utils import CaptureQueriesContext

        self.client.post(
            self.url + "recordings/",
            {"recording_id": self.recording.id, "entry_id": self.entry.id},
        )
        self.client.patch(self.url, {"is_public": True})
        self.client.force_authenticate(None)
        with CaptureQueriesContext(connection) as baseline:
            self.client.get(self.url)
        for index in range(8):
            entry = Entry.objects.create(summary=f"编号{index}", visibility=True)
            RecordingEntryLink.objects.create(
                recording=self.recording, entry=entry, role="mention"
            )
            section = CollectionEntry.objects.create(
                collection_id=self.box, entry=entry
            )
            CollectionRecording.objects.create(
                collection_id=self.box, section=section, recording=self.recording
            )
        with CaptureQueriesContext(connection) as expanded:
            response = self.client.get(self.url)
        self.assertEqual(response.data["recording_count"], 1)
        self.assertLessEqual(len(expanded), len(baseline) + 2)
