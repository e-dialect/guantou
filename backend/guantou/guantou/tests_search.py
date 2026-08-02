from django.contrib.auth.models import AnonymousUser, User
from django.test import TestCase
from rest_framework.test import APIClient

from .models import Can, Dialect, Flavor, Nameplate, Package
from .services import aggregate_search


class SearchApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="collector", password="pw")
        self.other_user = User.objects.create_user(username="other", password="pw")
        self.client = APIClient()
        self.dialect = Dialect.objects.create(name="Puxian", code="puxian")
        self.package = Package.objects.create(
            text="moon", package_type=Package.PackageType.ORTHODOX
        )
        self.flavor = Flavor.objects.create(
            name="Moon",
            definition="Earth satellite",
            mandarin=["moon"],
            created_by=self.user,
        )
        self.flavor.packages.add(self.package)
        self.public_can = Can.objects.create(
            audio_url="https://example.com/moon.mp3",
            recorder=self.user,
            dialect=self.dialect,
            concept_text="moon",
            visibility=True,
        )
        Nameplate.objects.create(
            can=self.public_can,
            creator=self.user,
            flavor=self.flavor,
            package=self.package,
            text_content="moon",
            definition="Earth satellite",
            is_primary=True,
        )
        self.private_can = Can.objects.create(
            audio_url="https://example.com/private.mp3",
            recorder=self.other_user,
            dialect=self.dialect,
            concept_text="moon private",
            visibility=False,
        )

    def test_aggregate_search_returns_grouped_results(self):
        response = self.client.get("/search/", {"q": "moon"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["keyword"], "moon")
        self.assertEqual(response.data["flavors"][0]["id"], self.flavor.id)
        self.assertEqual(response.data["packages"][0]["id"], self.package.id)
        can_ids = [item["id"] for item in response.data["cans"]]
        self.assertIn(self.public_can.id, can_ids)
        self.assertNotIn(self.private_can.id, can_ids)

    def test_aggregate_search_service_allows_owner_private_cans(self):
        results = aggregate_search("moon", self.other_user)

        self.assertIn(self.private_can, list(results["cans"]))

    def test_aggregate_search_empty_keyword_returns_empty_groups(self):
        results = aggregate_search(" ", AnonymousUser())

        self.assertEqual(results["flavors"], [])
        self.assertEqual(results["packages"], [])
        self.assertEqual(results["cans"], [])
