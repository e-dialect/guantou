from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from user.models import UserInfo

from .models import (
    Can,
    CircleMembership,
    Dialect,
    DialectCircle,
    Flavor,
    RecordingChallenge,
    SearchTerm,
    SearchTermHit,
)


class CircleAndDiscoveryApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        DialectCircle.objects.all().delete()
        Dialect.objects.all().delete()
        self.root = Dialect.objects.create(name="闽语", code="闽")
        self.child = Dialect.objects.create(
            name="莆仙话",
            code="莆仙",
            parent=self.root,
        )
        self.other = Dialect.objects.create(name="客家话", code="客家")
        self.circle = DialectCircle.objects.create(
            dialect=self.root,
            name="闽语圈",
            description="一起记录闽语乡音",
        )
        self.user = User.objects.create_user(username="listener", password="pw")
        UserInfo.objects.create(
            user=self.user,
            nickname="听友",
            primary_dialect=self.root,
        )
        self.author = User.objects.create_user(username="speaker", password="pw")
        UserInfo.objects.create(
            user=self.author,
            nickname="录音者",
            primary_dialect=self.child,
        )
        self.child_can = self.make_can(self.child, "月亮", views=8)
        self.other_can = self.make_can(self.other, "吃饭", views=50)
        self.private_can = self.make_can(
            self.child,
            "私密",
            visibility=False,
        )

    def make_can(self, dialect, concept, **extra):
        values = {
            "audio_url": f"https://example.com/{concept}.mp3",
            "recorder": self.author,
            "submitted_dialect": dialect,
            "concept_text": concept,
            "visibility": True,
        }
        values.update(extra)
        return Can.objects.create(**values)

    def test_circle_is_public_and_membership_is_idempotent(self):
        guest = self.client.get("/circles/")
        self.assertEqual(guest.status_code, 200)
        self.assertFalse(guest.data["results"][0]["is_member"])
        self.assertEqual(guest.data["results"][0]["can_count"], 1)

        self.client.force_authenticate(self.user)
        first = self.client.post(f"/circles/{self.circle.id}/membership/")
        repeated = self.client.post(f"/circles/{self.circle.id}/membership/")

        self.assertTrue(first.data["changed"])
        self.assertFalse(repeated.data["changed"])
        self.assertEqual(repeated.data["member_count"], 1)
        self.assertTrue(
            self.user.user_info.followed_dialects.filter(id=self.root.id).exists()
        )

        removed = self.client.delete(f"/circles/{self.circle.id}/membership/")
        self.assertTrue(removed.data["changed"])
        self.assertFalse(
            CircleMembership.objects.filter(circle=self.circle, user=self.user).exists()
        )
        # 主方言同时承担默认订阅；退出圈子不应清掉它。
        self.assertTrue(
            self.user.user_info.followed_dialects.filter(id=self.root.id).exists()
        )

    def test_circle_feed_includes_descendants_and_excludes_other_or_private_cans(self):
        response = self.client.get(f"/circles/{self.circle.id}/cans/")

        self.assertEqual(response.status_code, 200)
        ids = [item["id"] for item in response.data["results"]]
        self.assertEqual(ids, [self.child_can.id])
        self.assertNotIn(self.other_can.id, ids)
        self.assertNotIn(self.private_can.id, ids)

    def test_discovery_returns_hot_content_daily_flavor_and_recording_topics(self):
        moon = Flavor.objects.create(name="月亮", definition="夜空中的天然卫星")
        eat = Flavor.objects.create(name="吃饭", definition="进食")
        topic = RecordingChallenge.objects.create(
            title="家乡怎样说月亮",
            prompt="录下你家乡对月亮的说法",
            flavor=moon,
            dialect=self.root,
        )

        response = self.client.get("/discovery/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["hot_cans"][0]["id"], self.other_can.id)
        self.assertEqual(
            {item["id"] for item in response.data["hot_flavors"]},
            {moon.id, eat.id},
        )
        self.assertIn(response.data["daily_flavor"]["id"], {moon.id, eat.id})
        self.assertEqual(response.data["topics"][0]["id"], topic.id)
        self.assertEqual(response.data["topics"][0]["flavor"]["id"], moon.id)

    def test_recent_searches_raise_matching_cans_in_recommended_feed(self):
        self.user.user_info.primary_dialect = None
        self.user.user_info.save(update_fields=["primary_dialect"])
        term = SearchTerm.objects.create(keyword="月亮", count=1)
        SearchTermHit.objects.create(
            term=term,
            attributer=f"user:{self.user.id}",
            hit_date=timezone.localdate(),
        )
        self.client.force_authenticate(self.user)

        response = self.client.get("/cans/", {"feed": "recommended"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["results"][0]["id"], self.child_can.id)
