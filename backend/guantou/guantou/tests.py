import json
from unittest.mock import patch

from django.contrib.auth.models import User
from django.db import IntegrityError, transaction
from django.http import JsonResponse
from django.test import Client, RequestFactory, TestCase
from rest_framework.exceptions import APIException
from rest_framework.test import APIClient

from utils.exceptions.handler import drf_exception_handler
from utils.exceptions.middleware import ExceptionMiddleware
from utils.exceptions.types.common import CommonException

from .models import (
    Can,
    Dialect,
    Flavor,
    FlavorPackage,
    Nameplate,
    NameplateSupport,
    Package,
    Pronunciation,
    Shelf,
)

SOURCE = {"type": "creator"}


class DomainFixture(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="collector", password="pw")
        self.other = User.objects.create_user(username="other", password="pw")
        self.staff = User.objects.create_user(
            username="reviewer", password="pw", is_staff=True
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.root = Dialect.objects.create(name="闽语", code="闽", sort_order=10)
        self.group = Dialect.objects.create(
            name="莆仙语",
            code="莆仙",
            parent=self.root,
            sort_order=10,
        )
        self.dialect = Dialect.objects.create(
            name="游洋话",
            code="游洋",
            parent=self.group,
            sort_order=20,
        )
        self.package = Package.objects.create(
            text="行", package_type=Package.PackageType.ORTHODOX
        )
        self.flavor = Flavor.objects.create(
            name="行走动作",
            definition="步行移动",
            mandarin=["走路"],
            created_by=self.user,
        )
        FlavorPackage.objects.create(
            package=self.package,
            flavor=self.flavor,
            mapping_type=FlavorPackage.MappingType.PRIMARY,
        )

    def make_pronunciation(self, **overrides):
        values = {
            "package": self.package,
            "flavor": self.flavor,
            "dialect": self.dialect,
            "ipa": "hiŋ²³",
            "reading_type": Pronunciation.ReadingType.COLLOQUIAL,
            "created_by": self.user,
        }
        values.update(overrides)
        return Pronunciation.objects.create(**values)

    def make_can(self, **overrides):
        values = {
            "audio_url": "https://example.test/walk.mp3",
            "recorder": self.user,
            "submitted_dialect": self.dialect,
            "concept_text": "走路",
            "visibility": True,
        }
        values.update(overrides)
        return Can.objects.create(**values)

    def make_nameplate(self, can=None, **overrides):
        values = {
            "can": can or self.make_can(),
            "creator": self.user,
            "package": self.package,
            "flavor": self.flavor,
            "dialect": self.dialect,
            "text_content": "行",
            "definition": "走路",
            "source": SOURCE,
        }
        values.update(overrides)
        return Nameplate.objects.create(**values)

    def assert_error(self, response, status_code, field=None):
        self.assertEqual(response.status_code, status_code)
        self.assertEqual(response.data["code"], status_code)
        self.assertEqual(set(response.data), {"code", "message", "data", "request_id"})
        self.assertIsInstance(response.data["message"], str)
        self.assertIsInstance(response.data["data"], dict)
        if field:
            self.assertIn(field, response.data["data"])


class DialectApiTests(DomainFixture):
    def test_qualified_code_is_root_to_leaf(self):
        self.assertEqual(self.dialect.qualified_code, "闽.莆仙.游洋")

    def test_list_defaults_to_roots_and_children_use_explicit_order(self):
        earlier = Dialect.objects.create(
            name="莆田片",
            code="莆田",
            parent=self.group,
            sort_order=5,
        )
        roots = self.client.get("/dialects/")
        self.assertEqual([item["id"] for item in roots.data["results"]], [self.root.id])
        self.assertNotIn("kind", roots.data["results"][0])

        children = self.client.get("/dialects/", {"parent_id": self.group.id})
        self.assertEqual(
            [item["id"] for item in children.data["results"]],
            [earlier.id, self.dialect.id],
        )

    def test_resolve_accepts_qualified_code_and_alias(self):
        response = self.client.get(
            "/dialects/resolve/", {"qualified_code": "闽.莆仙.游洋"}
        )
        self.assertEqual(response.data["id"], self.dialect.id)

        self.dialect.aliases = ["min.puxian.youyang"]
        self.dialect.save(update_fields=["aliases"])
        alias = self.client.get(
            "/dialects/resolve/", {"qualified_code": "min.puxian.youyang"}
        )
        self.assertEqual(alias.data["id"], self.dialect.id)

    def test_reparent_preserves_old_qualified_code_as_alias(self):
        new_parent = Dialect.objects.create(
            name="仙游片",
            code="仙游",
            parent=self.group,
        )
        response = self.client.patch(
            f"/dialects/{self.dialect.id}/",
            {"parent_id": new_parent.id},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.dialect.refresh_from_db()
        self.assertIn("闽.莆仙.游洋", self.dialect.aliases)
        self.assertEqual(self.dialect.qualified_code, "闽.莆仙.仙游.游洋")

    def test_sibling_code_is_unique_but_other_branches_can_reuse_it(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            Dialect.objects.create(
                name="重复",
                code="游洋",
                parent=self.group,
            )
        other_root = Dialect.objects.create(name="粤语", code="粤")
        reused = Dialect.objects.create(
            name="另一游洋",
            code="游洋",
            parent=other_root,
        )
        self.assertIsNotNone(reused.pk)


class PronunciationApiTests(DomainFixture):
    def test_list_uses_card_and_detail_expands_attestations(self):
        pronunciation = Pronunciation.objects.create(
            package=self.package,
            flavor=self.flavor,
            dialect=self.dialect,
            ipa="hiŋ²³",
            reading_type=Pronunciation.ReadingType.COLLOQUIAL,
        )

        listing = self.client.get("/pronunciations/")
        detail = self.client.get(f"/pronunciations/{pronunciation.id}/")

        self.assertEqual(listing.status_code, 200)
        self.assertNotIn("attestations", listing.data["results"][0])
        self.assertNotIn("sandhi_info", listing.data["results"][0])
        self.assertEqual(detail.status_code, 200)
        self.assertIn("attestations", detail.data)
        self.assertIn("sandhi_info", detail.data)

    def test_base_and_surface_romanization_are_first_class_fields(self):
        response = self.client.post(
            "/pronunciations/",
            {
                "package_id": self.package.id,
                "flavor_id": self.flavor.id,
                "dialect_id": self.dialect.id,
                "ipa": "hiŋ²³",
                "base_romanization": "hing5",
                "surface_romanization": "hing2",
                "reading_type": "colloquial",
                "sandhi_info": {"position": "phrase_medial"},
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["base_romanization"], "hing5")
        self.assertEqual(response.data["surface_romanization"], "hing2")
        self.assertNotIn("romanization", response.data)
        self.assertNotIn("tone_value", response.data)

    def test_sandhi_info_requires_both_romanization_forms(self):
        response = self.client.post(
            "/pronunciations/",
            {
                "package_id": self.package.id,
                "flavor_id": self.flavor.id,
                "dialect_id": self.dialect.id,
                "ipa": "hiŋ²³",
                "surface_romanization": "hing2",
                "reading_type": "colloquial",
                "sandhi_info": {"position": "phrase_medial"},
            },
            format="json",
        )

        self.assert_error(response, 400, "sandhi_info")

    def test_create_requires_linked_package_flavor_and_three_foreign_keys(self):
        response = self.client.post(
            "/pronunciations/",
            {
                "package_id": self.package.id,
                "flavor_id": self.flavor.id,
                "dialect_id": self.dialect.id,
                "ipa": "hiŋ²³",
                "reading_type": "colloquial",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["package"]["id"], self.package.id)
        self.assertEqual(response.data["flavor"]["id"], self.flavor.id)
        self.assertEqual(response.data["dialect"]["id"], self.dialect.id)

        unrelated = Package.objects.create(
            text="走", package_type=Package.PackageType.ORTHODOX
        )
        invalid = self.client.post(
            "/pronunciations/",
            {
                "package_id": unrelated.id,
                "flavor_id": self.flavor.id,
                "dialect_id": self.dialect.id,
                "ipa": "tsau",
                "reading_type": "general",
            },
            format="json",
        )
        self.assert_error(invalid, 400, "package_id")

    def test_canonical_transition_is_evidence_gated_and_unique(self):
        first = self.make_pronunciation(source_citation="田野记录")
        second = self.make_pronunciation(ipa="hiŋ⁵¹", source_citation="方言志")
        self.client.force_authenticate(self.staff)

        self.assertEqual(
            self.client.post(
                f"/pronunciations/{first.id}/transition/",
                {"action": "verify", "is_canonical": True},
                format="json",
            ).status_code,
            200,
        )
        self.client.post(
            f"/pronunciations/{second.id}/transition/",
            {"action": "verify", "is_canonical": True},
            format="json",
        )
        first.refresh_from_db()
        second.refresh_from_db()
        self.assertFalse(first.is_canonical)
        self.assertTrue(second.is_canonical)

        no_evidence = self.make_pronunciation(ipa="hiŋ³³")
        blocked = self.client.post(
            f"/pronunciations/{no_evidence.id}/transition/",
            {"action": "verify", "is_canonical": True},
            format="json",
        )
        self.assert_error(blocked, 409)

    def test_staff_transition_matrix_covers_all_pronunciation_states(self):
        cases = [
            (Pronunciation.Status.DRAFT, "verify", Pronunciation.Status.VERIFIED),
            (Pronunciation.Status.DISPUTED, "verify", Pronunciation.Status.VERIFIED),
            (Pronunciation.Status.DRAFT, "dispute", Pronunciation.Status.DISPUTED),
            (Pronunciation.Status.VERIFIED, "dispute", Pronunciation.Status.DISPUTED),
            (Pronunciation.Status.DRAFT, "reject", Pronunciation.Status.REJECTED),
            (Pronunciation.Status.DISPUTED, "reject", Pronunciation.Status.REJECTED),
            (Pronunciation.Status.REJECTED, "restore", Pronunciation.Status.DRAFT),
        ]
        self.client.force_authenticate(self.staff)
        for index, (source, action, target) in enumerate(cases):
            pronunciation = self.make_pronunciation(
                ipa=f"hiŋ{index}", status=source, created_by=self.other
            )
            response = self.client.post(
                f"/pronunciations/{pronunciation.id}/transition/",
                {"action": action},
                format="json",
            )
            self.assertEqual(response.status_code, 200, (source, action))
            self.assertEqual(response.data["status"], target)

    def test_regular_user_cannot_run_review_transitions(self):
        cases = [
            (Pronunciation.Status.DRAFT, "verify"),
            (Pronunciation.Status.DRAFT, "reject"),
            (Pronunciation.Status.DRAFT, "dispute"),
            (Pronunciation.Status.REJECTED, "restore"),
        ]
        for status_value, action in cases:
            pronunciation = self.make_pronunciation(
                ipa=f"hiŋ-{action}", status=status_value
            )
            response = self.client.post(
                f"/pronunciations/{pronunciation.id}/transition/",
                {"action": action},
                format="json",
            )
            self.assert_error(response, 403)
            pronunciation.refresh_from_db()
            self.assertEqual(pronunciation.status, status_value)

    def test_illegal_pronunciation_transition_is_a_conflict(self):
        pronunciation = self.make_pronunciation(status=Pronunciation.Status.VERIFIED)
        self.client.force_authenticate(self.staff)

        response = self.client.post(
            f"/pronunciations/{pronunciation.id}/transition/",
            {"action": "verify"},
            format="json",
        )

        self.assert_error(response, 409)
        pronunciation.refresh_from_db()
        self.assertEqual(pronunciation.status, Pronunciation.Status.VERIFIED)

    def test_referenced_pronunciation_cannot_be_deleted(self):
        pronunciation = self.make_pronunciation()
        self.make_nameplate(pronunciation=pronunciation)
        response = self.client.delete(f"/pronunciations/{pronunciation.id}/")
        self.assert_error(response, 409)

    def test_private_attestations_do_not_leak_through_pronunciation(self):
        pronunciation = self.make_pronunciation()
        public_plate = self.make_nameplate(pronunciation=pronunciation)
        private_can = self.make_can(recorder=self.other, visibility=False)
        private_plate = self.make_nameplate(
            can=private_can, creator=self.other, pronunciation=pronunciation
        )
        self.client.force_authenticate(None)

        response = self.client.get(f"/pronunciations/{pronunciation.id}/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["evidence_count"], 1)
        ids = [item["id"] for item in response.data["attestations"]]
        self.assertIn(public_plate.id, ids)
        self.assertNotIn(private_plate.id, ids)


class CanSubmissionApiTests(DomainFixture):
    def payload(self, **overrides):
        values = {
            "audio_url": "https://example.test/new.mp3",
            "submitted_dialect_id": self.dialect.id,
            "concept_text": "走路",
            "duration_ms": 1234,
        }
        values.update(overrides)
        return values

    def test_create_can_without_nameplate_keeps_recording_unlabeled(self):
        response = self.client.post("/cans/", self.payload(), format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["status"], Can.Status.UNLABELED)
        self.assertEqual(response.data["submitted_dialect"]["id"], self.dialect.id)
        self.assertEqual(response.data["nameplates"], [])
        self.assertIsNone(response.data["primary_nameplate"])
        self.assertNotIn("flavor_variant", response.data)

    def test_submit_without_concept_text_is_rejected(self):
        # #125 偏差 1：concept_text 缺失时不得创建无标罐头，按 v1 契约返回 400
        payload = self.payload()
        payload.pop("concept_text")
        response = self.client.post("/cans/", payload, format="json")
        self.assert_error(response, 400, "concept_text")
        self.assertEqual(Can.objects.count(), 0)

    def test_repeated_nameplate_submission_reuses_package_and_flavor(self):
        # #125 偏差 2：重复提交相同初始铭牌时 Package/Flavor 均按 get_or_create 复用
        payload = self.payload(
            initial_nameplate={
                "text_content": "行",
                "definition": "走路",
                "package_type": "orthodox",
                "source": SOURCE,
            }
        )
        first = self.client.post("/cans/", payload, format="json")
        second = self.client.post("/cans/", payload, format="json")
        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 201)
        self.assertEqual(
            Package.objects.filter(
                text="行", package_type=Package.PackageType.ORTHODOX
            ).count(),
            1,
        )
        self.assertEqual(
            Flavor.objects.filter(name="走路", definition="走路").count(), 1
        )
        first_flavor = first.data["nameplates"][0]["flavor"]
        second_flavor = second.data["nameplates"][0]["flavor"]
        self.assertIsNotNone(first_flavor)
        self.assertEqual(first_flavor["id"], second_flavor["id"])

    def test_repeated_submission_tolerates_preexisting_duplicate_flavors(self):
        first_existing = Flavor.objects.create(name="走路", definition="走路")
        Flavor.objects.create(name="走路", definition="走路")
        payload = self.payload(
            initial_nameplate={
                "text_content": "行",
                "definition": "走路",
                "package_type": "orthodox",
                "source": SOURCE,
            }
        )

        response = self.client.post("/cans/", payload, format="json")

        self.assertEqual(response.status_code, 201)
        self.assertEqual(
            Flavor.objects.filter(name="走路", definition="走路").count(), 2
        )
        self.assertEqual(
            response.data["nameplates"][0]["flavor"]["id"], first_existing.id
        )

    def test_update_can_can_clear_submission_hint_but_not_replace_audio(self):
        can = self.make_can()

        cleared = self.client.patch(
            f"/cans/{can.id}/", {"submitted_dialect_id": None}, format="json"
        )
        immutable = self.client.patch(
            f"/cans/{can.id}/",
            {"audio_url": "https://example.test/replaced.mp3"},
            format="json",
        )

        self.assertEqual(cleared.status_code, 200)
        self.assertIsNone(cleared.data["submitted_dialect"])
        self.assert_error(immutable, 400, "audio_url")

    def test_initial_nameplate_is_created_atomically_with_structured_source(self):
        response = self.client.post(
            "/cans/",
            self.payload(
                initial_nameplate={
                    "text_content": "行",
                    "definition": "走路",
                    "package_type": "orthodox",
                    "source": {
                        "type": "book",
                        "title": "仙游方言志",
                        "locator": "42",
                    },
                }
            ),
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["status"], Can.Status.PENDING)
        plate = response.data["nameplates"][0]
        self.assertEqual(plate["source"]["type"], "book")
        self.assertEqual(plate["dialect"]["id"], self.dialect.id)
        self.assertTrue(plate["is_complete"])
        self.assertTrue(plate["is_primary"])

    def test_existing_flavor_supplement_creates_nameplate_not_pronunciation(self):
        response = self.client.post(
            "/cans/",
            self.payload(
                initial_nameplate={
                    "flavor_id": self.flavor.id,
                    "dialect_id": self.dialect.id,
                    "source": SOURCE,
                }
            ),
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Pronunciation.objects.count(), 0)
        plate = response.data["nameplates"][0]
        self.assertEqual(plate["flavor"]["id"], self.flavor.id)
        self.assertIsNone(plate["package"])
        self.assertFalse(plate["is_primary"])

    def test_supplement_recording_backfills_concept_text_from_flavor(self):
        # #150 补录音模式：concept_text 可省略，后端按义项名称回填
        response = self.client.post(
            "/cans/",
            {
                "audio_url": "https://example.test/supplement.mp3",
                "submitted_dialect_id": self.dialect.id,
                "initial_nameplate": {
                    "flavor_id": self.flavor.id,
                    "source": SOURCE,
                },
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["concept_text"], self.flavor.name)
        plate = response.data["nameplates"][0]
        self.assertEqual(plate["flavor"]["id"], self.flavor.id)

    def test_supplement_recording_rejects_missing_flavor(self):
        response = self.client.post(
            "/cans/",
            {
                "audio_url": "https://example.test/supplement.mp3",
                "submitted_dialect_id": self.dialect.id,
                "initial_nameplate": {"flavor_id": 999999, "source": SOURCE},
            },
            format="json",
        )
        self.assert_error(response, 400, "initial_nameplate")
        self.assertEqual(Can.objects.count(), 0)

    def test_submit_without_concept_text_and_flavor_is_rejected(self):
        # #150：concept_text 与义项均缺失时拒绝创建
        payload = self.payload(
            initial_nameplate={"text_content": "行", "source": SOURCE}
        )
        payload.pop("concept_text")
        response = self.client.post("/cans/", payload, format="json")
        self.assert_error(response, 400, "concept_text")
        self.assertEqual(Can.objects.count(), 0)

    def test_initial_pronunciation_link_uses_nameplate_as_evidence(self):
        pronunciation = self.make_pronunciation()
        response = self.client.post(
            "/cans/",
            self.payload(
                initial_nameplate={
                    "pronunciation_id": pronunciation.id,
                    "source": {"type": "fieldwork", "locator": "R-001"},
                }
            ),
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        plate = response.data["nameplates"][0]
        self.assertEqual(plate["pronunciation"]["id"], pronunciation.id)
        self.assertEqual(plate["package"]["id"], self.package.id)

    def test_initial_pronunciation_rejects_conflicting_foreign_keys_atomically(self):
        pronunciation = self.make_pronunciation()
        other_dialect = Dialect.objects.create(
            name="另一方言点",
            code="另一点",
            parent=self.group,
        )

        response = self.client.post(
            "/cans/",
            self.payload(
                initial_nameplate={
                    "pronunciation_id": pronunciation.id,
                    "dialect_id": other_dialect.id,
                    "source": SOURCE,
                }
            ),
            format="json",
        )

        self.assert_error(response, 409)
        self.assertEqual(Can.objects.count(), 0)

    def test_invalid_requests_use_numeric_error_contract(self):
        missing_audio = self.client.post(
            "/cans/",
            {
                "submitted_dialect_id": self.dialect.id,
                "concept_text": "走路",
            },
            format="json",
            HTTP_X_REQUEST_ID="contract-id",
        )
        self.assert_error(missing_audio, 400, "audio_url")
        self.assertEqual(missing_audio.data["request_id"], "contract-id")
        self.assertEqual(missing_audio.data["data"]["audio_url"]["code"], "required")
        self.assertTrue(missing_audio.data["data"]["audio_url"]["message"])
        self.assertNotIn("msg", missing_audio.data)
        self.assertNotIn("details", missing_audio.data)

        missing_source = self.client.post(
            "/cans/",
            self.payload(initial_nameplate={"text_content": "行"}),
            format="json",
        )
        self.assert_error(missing_source, 400, "initial_nameplate")

    def test_anonymous_create_returns_401_with_same_contract(self):
        self.client.force_authenticate(None)
        response = self.client.post("/cans/", self.payload(), format="json")
        self.assert_error(response, 401)


class ShelfPermissionTests(DomainFixture):
    def test_only_creator_or_staff_can_change_shelf(self):
        shelf = Shelf.objects.create(
            title="我的集盒",
            slug="mine",
            creator=self.user,
        )
        self.client.force_authenticate(self.other)

        response = self.client.patch(
            f"/shelves/{shelf.id}/", {"title": "被篡改"}, format="json"
        )

        self.assert_error(response, 403)
        shelf.refresh_from_db()
        self.assertEqual(shelf.title, "我的集盒")


class ShelfWriteApiTests(DomainFixture):
    def payload(self, **overrides):
        values = {
            "title": "乡音精选",
            "slug": "curation",
            "description": "主题策展",
        }
        values.update(overrides)
        return values

    def test_create_shelf_records_creator(self):
        # #144 后端验收：合法 POST /shelves/ 返回 201 且 creator 被正确记录
        response = self.client.post("/shelves/", self.payload(), format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["creator"]["id"], self.user.id)
        shelf = Shelf.objects.get(id=response.data["id"])
        self.assertEqual(shelf.creator, self.user)

    def test_regular_user_cannot_create_or_promote_an_official_shelf(self):
        response = self.client.post(
            "/shelves/",
            self.payload(shelf_type=Shelf.ShelfType.OFFICIAL),
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["shelf_type"], Shelf.ShelfType.USER)

        updated = self.client.patch(
            f"/shelves/{response.data['id']}/",
            {"shelf_type": Shelf.ShelfType.CAMPAIGN},
            format="json",
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.data["shelf_type"], Shelf.ShelfType.USER)

    def test_create_shelf_with_content_visible_in_detail(self):
        # #144 后端验收：创建集盒 + 添加内容路径，详情中可见新增条目
        can = self.make_can()
        response = self.client.post(
            "/shelves/",
            self.payload(flavor_ids=[self.flavor.id], can_ids=[can.id]),
            format="json",
        )
        self.assertEqual(response.status_code, 201)

        detail = self.client.get(f"/shelves/{response.data['id']}/")
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(
            [item["id"] for item in detail.data["flavors"]], [self.flavor.id]
        )
        self.assertEqual([item["id"] for item in detail.data["cans"]], [can.id])

    def test_patch_content_lists_are_full_replacement(self):
        # 固化 PATCH 语义：flavor_ids/can_ids 为全量替换而非增量添加（#144）
        shelf = Shelf.objects.create(title="集盒", slug="curation", creator=self.user)
        shelf.flavors.set([self.flavor])
        first_can = self.make_can()
        shelf.cans.set([first_can])

        second_can = self.make_can(audio_url="https://example.test/other.mp3")
        response = self.client.patch(
            f"/shelves/{shelf.id}/",
            {"flavor_ids": [], "can_ids": [second_can.id]},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        shelf.refresh_from_db()
        self.assertEqual(list(shelf.flavors.all()), [])
        self.assertEqual(list(shelf.cans.all()), [second_can])

    def test_non_creator_cannot_add_content(self):
        # #144 后端验收：非创建者写入返回 403 且内容未变更
        shelf = Shelf.objects.create(title="他人集盒", slug="others", creator=self.user)
        can = self.make_can()
        self.client.force_authenticate(self.other)

        response = self.client.patch(
            f"/shelves/{shelf.id}/", {"can_ids": [can.id]}, format="json"
        )

        self.assert_error(response, 403)
        self.assertEqual(shelf.cans.count(), 0)

    def test_anonymous_create_shelf_returns_401(self):
        self.client.force_authenticate(None)
        response = self.client.post("/shelves/", self.payload(), format="json")
        self.assert_error(response, 401)


class ErrorContractTests(TestCase):
    def test_internal_error_does_not_expose_original_exception(self):
        response = CommonException(RuntimeError("database-password-secret")).response()
        payload = json.loads(response.content)

        self.assertEqual(response.status_code, 500)
        self.assertEqual(payload["message"], "服务器内部错误")
        self.assertNotIn("database-password-secret", response.content.decode())

    def test_non_drf_404_is_normalized_to_json(self):
        response = Client().get("/route-that-does-not-exist")
        payload = response.json()

        self.assertEqual(response.status_code, 404)
        self.assertEqual(payload["code"], 404)
        self.assertEqual(set(payload), {"code", "message", "data", "request_id"})
        self.assertEqual(response["Content-Type"], "application/json")

    def test_non_drf_500_payload_does_not_leak_original_message(self):
        request = RequestFactory().get("/legacy-error")
        response = ExceptionMiddleware(lambda unused_request: None).process_response(
            request,
            JsonResponse({"msg": "database-password-secret"}, status=500),
        )
        payload = json.loads(response.content)

        self.assertEqual(payload["message"], "服务器内部错误")
        self.assertEqual(payload["data"], {})
        self.assertNotIn("database-password-secret", response.content.decode())

    def test_drf_500_payload_does_not_leak_original_message(self):
        request = RequestFactory().get("/api-error")
        response = drf_exception_handler(
            APIException("database-password-secret"), {"request": request}
        )

        self.assertEqual(response.data["message"], "服务器内部错误")
        self.assertEqual(response.data["data"], {})
        self.assertNotIn("database-password-secret", json.dumps(response.data))


class NameplateApiTests(DomainFixture):
    def test_collection_create_and_nested_get_contract(self):
        can = self.make_can()
        created = self.client.post(
            "/nameplates/",
            {
                "can_id": can.id,
                "package_id": self.package.id,
                "flavor_id": self.flavor.id,
                "dialect_id": self.dialect.id,
                "text_content": "行",
                "source": {"type": "oral", "attributed_to": "祖母"},
            },
            format="json",
        )
        self.assertEqual(created.status_code, 201)
        nested = self.client.get(f"/cans/{can.id}/nameplates/")
        self.assertEqual(nested.status_code, 200)
        self.assertEqual(nested.data["count"], 1)
        self.assertEqual(
            self.client.post(
                f"/cans/{can.id}/nameplates/", {}, format="json"
            ).status_code,
            405,
        )

    def test_raw_writing_is_idempotently_normalized_and_linked_to_flavor(self):
        can = self.make_can()
        payload = {
            "can_id": can.id,
            "flavor_id": self.flavor.id,
            "dialect_id": self.dialect.id,
            "text_content": "新写法",
            "definition": "走路",
            "source": SOURCE,
        }

        first = self.client.post("/nameplates/", payload, format="json")
        second = self.client.post("/nameplates/", payload, format="json")

        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 201)
        package = Package.objects.get(
            text="新写法", package_type=Package.PackageType.UNCERTAIN
        )
        self.assertEqual(
            FlavorPackage.objects.filter(package=package, flavor=self.flavor).count(),
            1,
        )
        self.assertEqual(first.data["package"]["id"], package.id)
        self.assertEqual(second.data["package"]["id"], package.id)

    def test_selected_package_and_flavor_create_missing_mapping(self):
        can = self.make_can()
        package = Package.objects.create(
            text="别字", package_type=Package.PackageType.POPULAR
        )

        response = self.client.post(
            "/nameplates/",
            {
                "can_id": can.id,
                "package_id": package.id,
                "flavor_id": self.flavor.id,
                "dialect_id": self.dialect.id,
                "source": SOURCE,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertTrue(
            FlavorPackage.objects.filter(package=package, flavor=self.flavor).exists()
        )

    def test_private_can_nameplates_do_not_leak(self):
        private = self.make_can(recorder=self.other, visibility=False)
        plate = self.make_nameplate(can=private, creator=self.other)
        self.client.force_authenticate(None)
        ids = [item["id"] for item in self.client.get("/nameplates/").data["results"]]
        self.assertNotIn(plate.id, ids)
        self.assertEqual(self.client.get(f"/nameplates/{plate.id}/").status_code, 404)

    def test_pronunciation_conflict_returns_409(self):
        pronunciation = self.make_pronunciation()
        other_package = Package.objects.create(
            text="走", package_type=Package.PackageType.ORTHODOX
        )
        response = self.client.post(
            "/nameplates/",
            {
                "can_id": self.make_can().id,
                "package_id": other_package.id,
                "pronunciation_id": pronunciation.id,
                "source": SOURCE,
            },
            format="json",
        )
        self.assert_error(response, 409, "package_id")

    def test_support_is_idempotent_and_can_be_removed(self):
        plate = self.make_nameplate()
        first = self.client.put(f"/nameplates/{plate.id}/support/", {}, format="json")
        second = self.client.put(f"/nameplates/{plate.id}/support/", {}, format="json")
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(NameplateSupport.objects.filter(nameplate=plate).count(), 1)
        plate.refresh_from_db()
        self.assertEqual(plate.weight, 1)

        removed = self.client.delete(f"/nameplates/{plate.id}/support/")
        self.assertEqual(removed.status_code, 204)
        plate.refresh_from_db()
        self.assertEqual(plate.weight, 0)

    def test_referenced_claim_must_be_revised_instead_of_patched(self):
        plate = self.make_nameplate()
        plate.promote_to_primary()
        blocked = self.client.patch(
            f"/nameplates/{plate.id}/", {"definition": "新的解释"}, format="json"
        )
        self.assert_error(blocked, 409, "supersedes_id")

        revision = self.client.post(
            "/nameplates/",
            {
                "can_id": plate.can_id,
                "package_id": self.package.id,
                "flavor_id": self.flavor.id,
                "dialect_id": self.dialect.id,
                "text_content": "行",
                "definition": "新的解释",
                "source": {"type": "article", "title": "校订稿"},
                "supersedes_id": plate.id,
            },
            format="json",
        )
        self.assertEqual(revision.status_code, 201)
        plate.refresh_from_db()
        self.assertEqual(plate.status, Nameplate.Status.SUPERSEDED)
        self.assertFalse(plate.is_primary)
        self.assertTrue(revision.data["is_primary"])

    def test_delete_public_nameplate_is_soft_withdrawal(self):
        plate = self.make_nameplate()
        plate.promote_to_primary()
        response = self.client.delete(f"/nameplates/{plate.id}/")
        self.assertEqual(response.status_code, 204)
        plate.refresh_from_db()
        self.assertEqual(plate.status, Nameplate.Status.WITHDRAWN)
        self.assertFalse(plate.is_primary)

    def test_collection_filters_cover_source_and_normalized_links(self):
        book = self.make_nameplate(source={"type": "book", "title": "方言志"})
        self.make_nameplate(text_content="走", source={"type": "creator"})
        response = self.client.get(
            "/nameplates/",
            {
                "source_type": "book",
                "package_id": self.package.id,
                "flavor_id": self.flavor.id,
                "dialect_id": self.dialect.id,
            },
        )
        self.assertEqual([item["id"] for item in response.data["results"]], [book.id])


class CanQueryAndStateTests(DomainFixture):
    def test_normalized_filters_use_active_nameplate_not_submission_hint(self):
        other_dialect = Dialect.objects.create(
            name="莆田话",
            code="莆田",
            parent=self.group,
        )
        can = self.make_can(submitted_dialect=other_dialect)
        self.make_nameplate(can=can, dialect=self.dialect)
        by_claim = self.client.get("/cans/", {"dialect_id": self.dialect.id})
        self.assertIn(can.id, [item["id"] for item in by_claim.data["results"]])
        by_hint = self.client.get("/cans/", {"submitted_dialect_id": other_dialect.id})
        self.assertIn(can.id, [item["id"] for item in by_hint.data["results"]])

    def test_illegal_transition_returns_409(self):
        can = self.make_can(status=Can.Status.UNLABELED)
        response = self.client.post(
            f"/cans/{can.id}/transition/", {"action": "submit"}, format="json"
        )
        self.assert_error(response, 409)

    def transition(self, can, action, user=None, reason=""):
        self.client.force_authenticate(user or self.user)
        return self.client.post(
            f"/cans/{can.id}/transition/",
            {"action": action, "reason": reason},
            format="json",
        )

    def test_owner_transition_matrix(self):
        submitted = self.make_can(status=Can.Status.PENDING)
        response = self.transition(submitted, "submit")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], Can.Status.TENTATIVE)

        disputed = self.make_can(status=Can.Status.TENTATIVE)
        response = self.transition(disputed, "dispute")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], Can.Status.DISPUTED)

        restored = self.make_can(status=Can.Status.REJECTED)
        response = self.transition(restored, "restore")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], Can.Status.PENDING)

    def test_staff_transition_matrix(self):
        for source in (Can.Status.TENTATIVE, Can.Status.DISPUTED):
            with self.subTest(action="verify", source=source):
                can = self.make_can(status=source)
                response = self.transition(can, "verify", self.staff, "证据充分")
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.data["status"], Can.Status.VERIFIED)

        for source in (
            Can.Status.PENDING,
            Can.Status.TENTATIVE,
            Can.Status.DISPUTED,
        ):
            with self.subTest(action="reject", source=source):
                can = self.make_can(status=source)
                response = self.transition(can, "reject", self.staff, "信息不足")
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.data["status"], Can.Status.REJECTED)

        restored = self.make_can(status=Can.Status.REJECTED)
        response = self.transition(restored, "restore", self.staff)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], Can.Status.PENDING)

    def test_transition_reloads_locked_state_and_writes_structured_log(self):
        can = self.make_can(status=Can.Status.PENDING)
        stale = Can.objects.get(pk=can.pk)

        with patch(
            "guantou.services.Can.objects.select_for_update",
            wraps=Can.objects.select_for_update,
        ) as select_for_update:
            response = self.transition(can, "submit", reason="本人确认")
        select_for_update.assert_called_once_with()
        self.assertEqual(stale.status, Can.Status.PENDING)
        conflict = self.transition(can, "submit")

        self.assertEqual(response.status_code, 200)
        self.assert_error(conflict, 409)
        can.refresh_from_db()
        self.assertEqual(can.status, Can.Status.TENTATIVE)
        self.assertEqual(
            set(can.transition_log[-1]),
            {"action", "from", "to", "by", "at", "reason"},
        )
        self.assertEqual(can.transition_log[-1]["by"]["id"], self.user.id)
        self.assertEqual(can.transition_log[-1]["reason"], "本人确认")

    def test_transition_permissions_and_staff_status_filter(self):
        private = self.make_can(
            recorder=self.other,
            visibility=False,
            status=Can.Status.PENDING,
        )
        forbidden = self.transition(private, "submit", self.user)
        self.assert_error(forbidden, 404)

        public = self.make_can(recorder=self.other, status=Can.Status.PENDING)
        forbidden = self.transition(public, "submit", self.user)
        self.assert_error(forbidden, 403)

        self.client.force_authenticate(self.staff)
        listing = self.client.get("/cans/", {"status": Can.Status.PENDING})
        self.assertIn(private.id, [item["id"] for item in listing.data["results"]])

    def test_non_owner_cannot_edit_can(self):
        can = self.make_can()
        self.client.force_authenticate(self.other)
        response = self.client.patch(
            f"/cans/{can.id}/", {"source_note": "tamper"}, format="json"
        )
        self.assert_error(response, 403)

    def test_retrieve_increments_views_without_touching_updated_at(self):
        can = self.make_can()
        previous_updated_at = can.updated_at
        response = self.client.get(f"/cans/{can.id}/")
        self.assertEqual(response.status_code, 200)
        can.refresh_from_db()
        self.assertEqual(can.views, 1)
        self.assertEqual(can.updated_at, previous_updated_at)
