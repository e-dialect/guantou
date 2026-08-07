from django.contrib.auth.models import AnonymousUser, User
from django.test import TestCase
from rest_framework.test import APIClient

from .models import Can, Dialect, Flavor, Nameplate, Package
from .services import aggregate_search, suggest_search


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
            submitted_dialect=self.dialect,
            concept_text="moon",
            visibility=True,
        )
        Nameplate.objects.create(
            can=self.public_can,
            creator=self.user,
            flavor=self.flavor,
            package=self.package,
            dialect=self.dialect,
            text_content="moon",
            definition="Earth satellite",
            source={"type": "creator"},
            is_primary=True,
        )
        self.private_can = Can.objects.create(
            audio_url="https://example.com/private.mp3",
            recorder=self.other_user,
            submitted_dialect=self.dialect,
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


class SuggestSearchApiTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username="owner", password="pw")
        self.visitor = User.objects.create_user(username="visitor", password="pw")
        self.staff = User.objects.create_user(
            username="staff", password="pw", is_staff=True
        )
        self.client = APIClient()
        self.flavor = Flavor.objects.create(
            name="吃早饭", definition="早上进食", mandarin=["吃早饭"]
        )
        self.package = Package.objects.create(
            text="吃食", package_type=Package.PackageType.ORTHODOX
        )
        self.public_can = Can.objects.create(
            audio_url="https://example.com/eat.mp3",
            recorder=self.owner,
            concept_text="吃",
            visibility=True,
        )
        self.private_can = Can.objects.create(
            audio_url="https://example.com/hidden.mp3",
            recorder=self.owner,
            concept_text="吃",
            visibility=False,
        )
        self.public_nameplate = Nameplate.objects.create(
            can=self.public_can,
            creator=self.owner,
            text_content="吃早",
            definition="吃早饭",
            source={"type": "creator"},
        )
        self.private_nameplate = Nameplate.objects.create(
            can=self.private_can,
            creator=self.owner,
            text_content="吃独",
            definition="独自吃",
            source={"type": "creator"},
        )

    def suggest(self, **params):
        return self.client.get("/search/suggest/", params)

    def nameplate_texts(self, response):
        return [
            item["text"]
            for item in response.data["suggestions"]
            if item["type"] == "nameplate"
        ]

    def test_suggest_empty_keyword_returns_empty_suggestions(self):
        for params in ({}, {"q": "   "}):
            response = self.suggest(**params)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data, {"keyword": "", "suggestions": []})

        self.assertEqual(
            suggest_search("  ", AnonymousUser()),
            {"keyword": "", "suggestions": []},
        )

    def test_suggest_truncates_overlong_keyword(self):
        response = self.suggest(q="吃" * 60)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["keyword"]), 50)

    def test_suggest_dedup_keeps_highest_priority_type(self):
        Flavor.objects.create(name="食", definition="进食", mandarin=["吃"])
        Package.objects.create(text="食", package_type=Package.PackageType.LOAN)
        Nameplate.objects.create(
            can=self.public_can,
            creator=self.owner,
            text_content="食",
            definition="吃",
            source={"type": "creator"},
        )

        response = self.suggest(q="食")

        matched = [
            item for item in response.data["suggestions"] if item["text"] == "食"
        ]
        self.assertEqual(len(matched), 1)
        self.assertEqual(matched[0]["type"], "flavor")

    def test_suggest_prefix_match_ranks_before_contains(self):
        Flavor.objects.create(name="早饭吃", definition="早上进食", mandarin=["吃"])

        response = self.suggest(q="吃")

        flavor_texts = [
            item["text"]
            for item in response.data["suggestions"]
            if item["type"] == "flavor"
        ]
        self.assertIn("吃早饭", flavor_texts)
        self.assertIn("早饭吃", flavor_texts)
        self.assertLess(flavor_texts.index("吃早饭"), flavor_texts.index("早饭吃"))
        flavor_item = next(
            item
            for item in response.data["suggestions"]
            if item["type"] == "flavor" and item["text"] == "吃早饭"
        )
        self.assertEqual(flavor_item["sub"], "义项 · 普通话: 吃早饭")

    def test_suggest_nameplate_visibility(self):
        # 游客只能看到可见罐头上的铭牌
        response = self.suggest(q="吃")
        texts = self.nameplate_texts(response)
        self.assertIn("吃早", texts)
        self.assertNotIn("吃独", texts)
        nameplate_item = next(
            item
            for item in response.data["suggestions"]
            if item["type"] == "nameplate" and item["text"] == "吃早"
        )
        self.assertEqual(nameplate_item["sub"], f"铭牌 · 罐头 #{self.public_can.id}")

        # 其他登录用户同样看不到他人私有罐头的铭牌
        self.client.force_authenticate(user=self.visitor)
        texts = self.nameplate_texts(self.suggest(q="吃"))
        self.assertIn("吃早", texts)
        self.assertNotIn("吃独", texts)

        # 录制者能看到自己私有罐头的铭牌
        self.client.force_authenticate(user=self.owner)
        texts = self.nameplate_texts(self.suggest(q="吃"))
        self.assertIn("吃早", texts)
        self.assertIn("吃独", texts)

        # staff 可见全部
        self.client.force_authenticate(user=self.staff)
        texts = self.nameplate_texts(self.suggest(q="吃"))
        self.assertIn("吃独", texts)

    def test_suggest_limit_clamped_per_type(self):
        for index in range(12):
            Package.objects.create(
                text=f"粽{index:02d}", package_type=Package.PackageType.PHONETIC
            )

        def package_count(response):
            return sum(
                1 for item in response.data["suggestions"] if item["type"] == "package"
            )

        # 超出上限 clamp 到 10
        self.assertEqual(package_count(self.suggest(q="粽", limit=999)), 10)
        # 非数字回退默认 5
        self.assertEqual(package_count(self.suggest(q="粽", limit="abc")), 5)
        # 低于下限 clamp 到 1
        self.assertEqual(package_count(self.suggest(q="粽", limit=0)), 1)
