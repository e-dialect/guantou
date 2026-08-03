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
            "/cans/",
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
            f"/cans/{can_id}/nameplates/",
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

    def test_authenticated_user_can_add_nameplate_to_public_can(self):
        other_user = User.objects.create_user(username="labeler", password="pw")
        can = Can.objects.create(
            audio_url="https://example.com/audio.mp3",
            recorder=self.user,
            dialect=self.child,
            concept_text="走路",
            visibility=True,
        )
        client = APIClient()
        client.force_authenticate(user=other_user)

        response = client.post(
            f"/cans/{can.id}/nameplates/",
            {
                "flavor": self.flavor.id,
                "package": self.package.id,
                "text_content": "趁行",
                "definition": "走路",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        plate = Nameplate.objects.get(id=response.data["id"])
        self.assertEqual(plate.creator, other_user)
        self.assertEqual(plate.can, can)

    def test_create_can_without_candidate_nameplate(self):
        response = self.client.post(
            "/cans/",
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
            "/cans/",
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
            "/cans/",
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
            "/cans/",
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
        self.assertEqual(response["X-Request-ID"], "test-request-id")

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
            f"/nameplates/{strong.id}/vote/", {"delta": 1}, format="json"
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
            f"/nameplates/{plate.id}/vote/", {"delta": 1}, format="json"
        )
        second_res = self.client.post(
            f"/nameplates/{plate.id}/vote/", {"delta": 1}, format="json"
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

        self.client.post(f"/nameplates/{plate.id}/vote/", {"delta": 1}, format="json")
        other_client = APIClient()
        other_client.force_authenticate(user=other_user)
        other_client.post(f"/nameplates/{plate.id}/vote/", {"delta": 1}, format="json")

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
        response = self.client.get("/cans/", {"dialect": self.root.id})
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
        response = self.client.get("/cans/", {"flavor": moon.id})
        self.assertEqual(response.status_code, 200)
        ids = [item["id"] for item in response.data["results"]]
        self.assertIn(can.id, ids)

    def test_package_detail_includes_related_flavors(self):
        response = self.client.get(f"/packages/{self.package.id}/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["text"], "行")
        self.assertEqual(len(response.data["flavors"]), 1)
        self.assertEqual(response.data["flavors"][0]["name"], "行走")


class CanTransitionTests(TestCase):
    """罐头状态转换端点测试"""

    def setUp(self):
        self.owner = User.objects.create_user(username="owner", password="pw")
        self.other_user = User.objects.create_user(username="other", password="pw")
        self.staff_user = User.objects.create_user(
            username="staff", password="pw", is_staff=True
        )
        self.dialect = Dialect.objects.create(name="莆仙方言", code="puxian")
        self.can = Can.objects.create(
            audio_url="https://example.com/audio.mp3",
            recorder=self.owner,
            dialect=self.dialect,
            status=Can.Status.PENDING,
            visibility=True,
        )

    def _client_for(self, user):
        client = APIClient()
        client.force_authenticate(user=user)
        return client

    def test_staff_verify_legal_transition(self):
        """合法转换：staff 用户执行 submit，pending→tentative，返回 200 + 完整 Can JSON"""
        client = self._client_for(self.staff_user)
        res = client.post(
            f"/cans/{self.can.id}/transition/",
            {"action": "submit", "reason": "社区确认"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["status"], "tentative")
        self.assertEqual(res.data["id"], self.can.id)
        # 验证 transition_log 记录
        self.can.refresh_from_db()
        self.assertEqual(len(self.can.transition_log), 1)
        log = self.can.transition_log[0]
        self.assertEqual(log["from"], "pending")
        self.assertEqual(log["to"], "tentative")
        self.assertEqual(log["by"], self.staff_user.id)
        self.assertEqual(log["reason"], "社区确认")
        self.assertIn("at", log)

    def test_staff_verify_after_submit(self):
        """合法转换：staff 用户执行 verify，tentative→verified"""
        self.can.status = Can.Status.TENTATIVE
        self.can.save(update_fields=["status"])
        client = self._client_for(self.staff_user)
        res = client.post(
            f"/cans/{self.can.id}/transition/",
            {"action": "verify", "reason": ""},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["status"], "verified")
        self.can.refresh_from_db()
        self.assertEqual(self.can.verifier, self.staff_user)

    def test_non_staff_verify_returns_403(self):
        """权限拒绝：非 staff 用户调 verify 返回 403"""
        self.can.status = Can.Status.TENTATIVE
        self.can.save(update_fields=["status"])
        client = self._client_for(self.other_user)
        res = client.post(
            f"/cans/{self.can.id}/transition/",
            {"action": "verify"},
            format="json",
        )
        self.assertEqual(res.status_code, 403)

    def test_assigned_verifier_can_verify(self):
        """被分配为 verifier 的非 staff 用户可以执行 verify"""
        self.can.status = Can.Status.TENTATIVE
        self.can.visibility = False
        self.can.verifier = self.other_user
        self.can.save(update_fields=["status", "visibility", "verifier"])
        client = self._client_for(self.other_user)
        res = client.post(
            f"/cans/{self.can.id}/transition/",
            {"action": "verify", "reason": "assigned review"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["status"], "verified")
        self.can.refresh_from_db()
        self.assertEqual(self.can.verifier, self.other_user)

    def test_illegal_transition_from_unlabeled(self):
        """非法转换：从 unlabeled 直接调 verify 返回 400"""
        self.can.status = Can.Status.UNLABELED
        self.can.save(update_fields=["status"])
        client = self._client_for(self.staff_user)
        res = client.post(
            f"/cans/{self.can.id}/transition/",
            {"action": "verify"},
            format="json",
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("不允许从", res.data["detail"])

    def test_illegal_transition_submit_from_unlabeled(self):
        """非法转换：从 unlabeled 调 submit 返回 400（必须先经过 pending）"""
        self.can.status = Can.Status.UNLABELED
        self.can.save(update_fields=["status"])
        client = self._client_for(self.owner)
        res = client.post(
            f"/cans/{self.can.id}/transition/",
            {"action": "submit"},
            format="json",
        )
        self.assertEqual(res.status_code, 400)

    def test_transition_log_accumulates(self):
        """transition_log 正确记录多次操作"""
        client = self._client_for(self.staff_user)
        # pending -> tentative
        client.post(
            f"/cans/{self.can.id}/transition/",
            {"action": "submit", "reason": "first"},
            format="json",
        )
        # tentative -> verified
        client.post(
            f"/cans/{self.can.id}/transition/",
            {"action": "verify", "reason": "second"},
            format="json",
        )
        self.can.refresh_from_db()
        self.assertEqual(len(self.can.transition_log), 2)
        self.assertEqual(self.can.transition_log[0]["from"], "pending")
        self.assertEqual(self.can.transition_log[0]["to"], "tentative")
        self.assertEqual(self.can.transition_log[1]["from"], "tentative")
        self.assertEqual(self.can.transition_log[1]["to"], "verified")


class IsOwnerOrAdminPermissionTests(TestCase):
    """对象级权限测试：PUT/DELETE 仅允许创建者或 staff"""

    def setUp(self):
        self.user_a = User.objects.create_user(username="userA", password="pw")
        self.user_b = User.objects.create_user(username="userB", password="pw")
        self.staff_user = User.objects.create_user(
            username="admin", password="pw", is_staff=True
        )
        self.dialect = Dialect.objects.create(name="莆仙方言", code="puxian")
        self.can = Can.objects.create(
            audio_url="https://example.com/audio.mp3",
            recorder=self.user_a,
            dialect=self.dialect,
            visibility=True,
        )

    def _client_for(self, user):
        client = APIClient()
        client.force_authenticate(user=user)
        return client

    def test_owner_can_put(self):
        """用户 A 自己调 PUT 修改返回 200"""
        client = self._client_for(self.user_a)
        res = client.patch(
            f"/cans/{self.can.id}/",
            {"concept_text": "新概念"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.can.refresh_from_db()
        self.assertEqual(self.can.concept_text, "新概念")

    def test_non_owner_put_returns_403(self):
        """用户 A 创建的 Can，用户 B（非 staff）调 PUT 修改返回 403"""
        client = self._client_for(self.user_b)
        res = client.patch(
            f"/cans/{self.can.id}/",
            {"concept_text": "恶意修改"},
            format="json",
        )
        self.assertEqual(res.status_code, 403)

    def test_staff_can_put(self):
        """staff 用户可以修改任何资源"""
        client = self._client_for(self.staff_user)
        res = client.patch(
            f"/cans/{self.can.id}/",
            {"concept_text": "管理员修改"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)

    def test_non_owner_delete_returns_403(self):
        """非创建者非 staff 删除返回 403"""
        client = self._client_for(self.user_b)
        res = client.delete(f"/cans/{self.can.id}/")
        self.assertEqual(res.status_code, 403)

    def test_owner_can_delete(self):
        """创建者可以删除自己的资源"""
        client = self._client_for(self.user_a)
        res = client.delete(f"/cans/{self.can.id}/")
        self.assertEqual(res.status_code, 204)

    def test_get_not_restricted(self):
        """任何登录用户都可以 GET"""
        client = self._client_for(self.user_b)
        res = client.get(f"/cans/{self.can.id}/")
        self.assertEqual(res.status_code, 200)
