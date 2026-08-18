from datetime import date
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from user.models import UserInfo

from .models import Can, Dialect, Flavor, Nameplate, Package
from .services import daily_can


class DailyCanTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.dialect = Dialect.objects.create(name="每日方言", code="daily")
        self.author = User.objects.create_user(username="daily-author", password="pw")
        UserInfo.objects.create(user=self.author, nickname="每日作者")

    def make_can(self, concept, **extra):
        values = {
            "audio_url": f"https://example.com/{concept}.mp3",
            "recorder": self.author,
            "submitted_dialect": self.dialect,
            "concept_text": concept,
            "visibility": True,
        }
        values.update(extra)
        return Can.objects.create(**values)

    def test_guest_can_access_daily_can(self):
        can = self.make_can("月亮")
        response = self.client.get("/cans/today/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["id"], can.id)
        self.assertIn("primary_nameplate", response.data)
        self.assertIn("like_count", response.data)
        self.assertIn("nameplate_count", response.data)

    def test_daily_can_is_stable_within_same_day(self):
        self.make_can("月亮")
        self.make_can("吃饭")
        first = self.client.get("/cans/today/").data["id"]
        second = self.client.get("/cans/today/").data["id"]
        self.assertEqual(first, second)

    def test_daily_can_returns_404_when_empty(self):
        response = self.client.get("/cans/today/")
        self.assertEqual(response.status_code, 404)

    def test_daily_can_rotates_across_days(self):
        first_can = self.make_can("first")
        second_can = self.make_can("second")
        with patch(
            "guantou.services.timezone.localdate", return_value=date(2026, 1, 1)
        ):
            first = daily_can()
        with patch(
            "guantou.services.timezone.localdate", return_value=date(2026, 1, 2)
        ):
            second = daily_can()
        self.assertIn(first.id, {first_can.id, second_can.id})
        self.assertIn(second.id, {first_can.id, second_can.id})
        self.assertNotEqual(first.id, second.id)

    def test_daily_can_prefers_verified_with_complete_primary_nameplate(self):
        package = Package.objects.create(
            text="月亮", package_type=Package.PackageType.ORTHODOX
        )
        flavor = Flavor.objects.create(name="月亮", definition="夜空中的天然卫星")
        verified = self.make_can("verified", status=Can.Status.VERIFIED)
        self.make_can("pending", status=Can.Status.PENDING)
        Nameplate.objects.create(
            can=verified,
            flavor=flavor,
            package=package,
            dialect=self.dialect,
            creator=self.author,
            text_content="月亮",
            source={"type": Nameplate.SourceType.CREATOR},
            status=Nameplate.Status.ACTIVE,
            is_primary=True,
        )
        result = daily_can()
        self.assertEqual(result.id, verified.id)
