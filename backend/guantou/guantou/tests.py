from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from .models import Can, Dialect, Flavor, Nameplate, NameplateSupport, Package


class GuantouApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="collector", password="pw")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.root = Dialect.objects.create(name="莆仙方言", code="puxian")
        self.child = Dialect.objects.create(
            name="游洋话",
            code="puxian-youyang",
            parent=self.root,
            county="莆田",
            town="游洋",
        )
        self.package = Package.objects.create(
            text="行", package_type=Package.PackageType.ORTHODOX
        )
        self.flavor = Flavor.objects.create(
            name="行走", definition="走路", created_by=self.user
        )
        self.flavor.packages.add(self.package)

    def test_create_can_and_nameplate(self):
        can_res = self.client.post(
            "/api/cans/",
            {
                "audio_url": "https://example.com/audio.mp3",
                "dialect": self.child.id,
                "concept_text": "走路",
                "county": "莆田",
                "town": "游洋",
            },
            format="json",
        )
        self.assertEqual(can_res.status_code, 201)
        can_id = can_res.data["id"]
        plate_res = self.client.post(
            f"/api/cans/{can_id}/nameplates/",
            {
                "flavor": self.flavor.id,
                "package": self.package.id,
                "text_content": "行",
                "definition": "走路",
            },
            format="json",
        )
        self.assertEqual(plate_res.status_code, 201)
        can = Can.objects.get(id=can_id)
        self.assertEqual(can.recorder, self.user)
        self.assertEqual(can.status, Can.Status.PENDING)
        self.assertTrue(can.primary_nameplate.is_primary)

    def test_create_can_without_candidate_nameplate(self):
        response = self.client.post(
            "/api/cans/",
            {
                "audio_url": "https://example.com/plain.mp3",
                "dialect": self.child.id,
                "concept_text": "knee",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        can = Can.objects.get(id=response.data["id"])
        self.assertEqual(can.recorder, self.user)
        self.assertEqual(can.status, Can.Status.UNLABELED)
        self.assertEqual(can.nameplates.count(), 0)

    def test_create_can_with_initial_nameplate_creates_related_objects(self):
        response = self.client.post(
            "/api/cans/",
            {
                "audio_url": "https://example.com/knee.mp3",
                "dialect": self.child.id,
                "concept_text": "knee",
                "initial_nameplate": {
                    "text_content": "khnee",
                    "definition": "kneecap",
                    "package_type": Package.PackageType.PHONETIC,
                    "evidence_level": Nameplate.EvidenceLevel.COMMUNITY,
                    "source_citation": "elder",
                },
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        can = Can.objects.get(id=response.data["id"])
        plate = can.primary_nameplate
        self.assertIsNotNone(plate)
        self.assertEqual(can.status, Can.Status.PENDING)
        self.assertEqual(plate.text_content, "khnee")
        self.assertEqual(plate.package.package_type, Package.PackageType.PHONETIC)
        self.assertEqual(plate.flavor.definition, "kneecap")
        self.assertEqual(plate.creator, self.user)

    def test_create_can_for_existing_flavor_creates_variant(self):
        response = self.client.post(
            "/api/cans/",
            {
                "audio_url": "https://example.com/flavor.mp3",
                "dialect": self.child.id,
                "flavor": self.flavor.id,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        can = Can.objects.get(id=response.data["id"])
        self.assertEqual(can.flavor_variant.flavor, self.flavor)
        self.assertEqual(can.flavor_variant.audio_url, can.audio_url)
        self.assertEqual(can.concept_text, self.flavor.name)

    def test_validation_errors_use_unified_shape(self):
        response = self.client.post(
            "/api/cans/",
            {
                "dialect": self.child.id,
                "concept_text": "knee",
            },
            format="json",
            HTTP_X_REQUEST_ID="test-request-id",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["code"], "validation_error")
        self.assertIn("msg", response.data)
        self.assertIn("message", response.data)
        self.assertIn("details", response.data)
        self.assertEqual(response.data["request_id"], "test-request-id")

    def test_vote_promotes_strongest_nameplate(self):
        can = Can.objects.create(
            audio_url="https://example.com/audio.mp3",
            recorder=self.user,
            dialect=self.child,
            concept_text="走路",
        )
        weak = Nameplate.objects.create(
            can=can,
            creator=self.user,
            text_content="行",
            flavor=self.flavor,
            package=self.package,
            is_primary=True,
        )
        strong = Nameplate.objects.create(
            can=can,
            creator=self.user,
            text_content="趁行",
            flavor=self.flavor,
            package=self.package,
            weight=2,
        )
        vote_res = self.client.post(
            f"/api/nameplates/{strong.id}/vote/", {"delta": 1}, format="json"
        )
        self.assertEqual(vote_res.status_code, 200)
        weak.refresh_from_db()
        strong.refresh_from_db()
        self.assertFalse(weak.is_primary)
        self.assertTrue(strong.is_primary)
        self.assertEqual(strong.weight, 3)
        self.assertTrue(
            NameplateSupport.objects.filter(nameplate=strong, user=self.user).exists()
        )
        self.assertTrue(vote_res.data["supported_by_current_user"])

    def test_repeated_vote_by_same_user_does_not_increment_weight(self):
        can = Can.objects.create(
            audio_url="https://example.com/audio.mp3",
            recorder=self.user,
            dialect=self.child,
            concept_text="走路",
        )
        plate = Nameplate.objects.create(
            can=can,
            creator=self.user,
            text_content="行",
            flavor=self.flavor,
            package=self.package,
        )

        first_res = self.client.post(
            f"/api/nameplates/{plate.id}/vote/", {"delta": 1}, format="json"
        )
        second_res = self.client.post(
            f"/api/nameplates/{plate.id}/vote/", {"delta": 1}, format="json"
        )

        self.assertEqual(first_res.status_code, 200)
        self.assertEqual(second_res.status_code, 200)
        plate.refresh_from_db()
        self.assertEqual(plate.weight, 1)
        self.assertEqual(NameplateSupport.objects.filter(nameplate=plate).count(), 1)

    def test_different_users_can_support_same_nameplate_once_each(self):
        other_user = User.objects.create_user(username="supporter", password="pw")
        can = Can.objects.create(
            audio_url="https://example.com/audio.mp3",
            recorder=self.user,
            dialect=self.child,
            concept_text="走路",
        )
        plate = Nameplate.objects.create(
            can=can,
            creator=self.user,
            text_content="行",
            flavor=self.flavor,
            package=self.package,
        )

        self.client.post(
            f"/api/nameplates/{plate.id}/vote/", {"delta": 1}, format="json"
        )
        other_client = APIClient()
        other_client.force_authenticate(user=other_user)
        other_client.post(
            f"/api/nameplates/{plate.id}/vote/", {"delta": 1}, format="json"
        )

        plate.refresh_from_db()
        self.assertEqual(plate.weight, 2)
        self.assertEqual(NameplateSupport.objects.filter(nameplate=plate).count(), 2)

    def test_parent_dialect_filter_includes_children(self):
        can = Can.objects.create(
            audio_url="https://example.com/audio.mp3",
            recorder=self.user,
            dialect=self.child,
            visibility=True,
        )
        response = self.client.get("/api/cans/", {"dialect": self.root.id})
        self.assertEqual(response.status_code, 200)
        ids = [item["id"] for item in response.data["results"]]
        self.assertIn(can.id, ids)

    def test_flavor_package_and_nameplate_model_national_lookup(self):
        moon = Flavor.objects.create(
            name="月亮",
            definition="地球的天然卫星；夜晚可见的天体",
            mandarin=["月亮"],
            created_by=self.user,
        )
        yueliang = Package.objects.create(
            text="月亮", package_type=Package.PackageType.ORTHODOX
        )
        yueguang = Package.objects.create(
            text="月光", package_type=Package.PackageType.POPULAR
        )
        moon.packages.add(yueliang, yueguang)
        can = Can.objects.create(
            audio_url="https://example.com/moon.mp3",
            recorder=self.user,
            dialect=self.child,
            concept_text="月亮",
            visibility=True,
        )
        plate = Nameplate.objects.create(
            can=can,
            creator=self.user,
            flavor=moon,
            package=yueguang,
            text_content="月光",
            definition="月亮",
            is_primary=True,
        )

        self.assertEqual(plate.flavor, moon)
        self.assertEqual(plate.package, yueguang)
        self.assertCountEqual(
            list(moon.packages.values_list("text", flat=True)), ["月亮", "月光"]
        )
        response = self.client.get("/api/cans/", {"flavor": moon.id})
        self.assertEqual(response.status_code, 200)
        ids = [item["id"] for item in response.data["results"]]
        self.assertIn(can.id, ids)

    def test_package_detail_includes_related_flavors(self):
        response = self.client.get(f"/api/packages/{self.package.id}/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["text"], "行")
        self.assertEqual(len(response.data["flavors"]), 1)
        self.assertEqual(response.data["flavors"][0]["name"], "行走")
