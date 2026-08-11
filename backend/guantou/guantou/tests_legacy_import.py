import sqlite3
import tempfile
from importlib import import_module

from django.contrib.auth.models import Group, User
from django.apps import apps
from django.contrib.sessions.models import Session
from django.test import TestCase

from user.models import UserInfo

from .legacy_import import (
    HinghwaImporter,
    account_priority,
    import_demo_fixture,
    normalize_legacy_location,
    open_legacy_database,
    parse_legacy_datetime,
    resolve_dialect,
)
from .models import Can, Dialect, DialectCircle, Flavor, LegacyImportRecord, Package

SOURCE_SCHEMA = """
CREATE TABLE auth_user (
    id INTEGER PRIMARY KEY, password TEXT, last_login TEXT, is_superuser INTEGER,
    username TEXT, first_name TEXT, last_name TEXT, email TEXT, is_staff INTEGER,
    is_active INTEGER, date_joined TEXT
);
CREATE TABLE user_userinfo (
    user_id INTEGER PRIMARY KEY, wechat TEXT, qq TEXT, nickname TEXT, birthday TEXT,
    telephone TEXT, avatar TEXT, county TEXT, town TEXT,
    points_now INTEGER, points_sum INTEGER
);
CREATE TABLE word_word (
    id INTEGER PRIMARY KEY, word TEXT, definition TEXT, annotation TEXT,
    mandarin TEXT, standard_ipa TEXT, standard_pinyin TEXT, visibility INTEGER,
    contributor_id INTEGER, tags TEXT
);
CREATE TABLE word_pronunciation (
    id INTEGER PRIMARY KEY, source TEXT, ipa TEXT, pinyin TEXT, county TEXT,
    town TEXT, visibility INTEGER, views INTEGER, contributor_id INTEGER,
    word_id INTEGER, verifier_id INTEGER, upload_time TEXT
);
"""


class LegacyLocationTests(TestCase):
    def test_normalizes_required_branches_and_unknown_user_location(self):
        self.assertEqual(
            normalize_legacy_location("仙游县", "鲤城街道", for_user=True)[
                "qualified_code"
            ],
            "闽.莆仙.仙游.城关",
        )
        self.assertEqual(
            normalize_legacy_location("仙游县", "枫亭镇")["qualified_code"],
            "闽.莆仙.仙游.枫亭",
        )
        self.assertEqual(
            normalize_legacy_location("涵江", "国欢镇")["qualified_code"],
            "闽.莆仙.莆田.国欢",
        )
        self.assertIsNone(
            normalize_legacy_location("福州市", "鼓楼区", for_user=True)[
                "qualified_code"
            ]
        )


class AccountPriorityTests(TestCase):
    def test_admin_status_precedes_last_login_then_newer_login_wins(self):
        admin_old = account_priority(
            is_staff=True,
            is_superuser=False,
            last_login="2020-01-01 00:00:00",
        )
        ordinary_new = account_priority(
            is_staff=False,
            is_superuser=False,
            last_login="2025-01-01 00:00:00",
        )
        admin_new = account_priority(
            is_staff=True,
            is_superuser=False,
            last_login="2024-01-01 00:00:00",
        )
        admin_never = account_priority(
            is_staff=True,
            is_superuser=False,
            last_login=None,
        )

        self.assertGreater(admin_old, ordinary_new)
        self.assertGreater(admin_new, admin_old)
        self.assertGreater(admin_old, admin_never)


class DialectSeedTests(TestCase):
    def test_seed_is_complete_and_idempotent(self):
        migration = import_module("guantou.migrations.0012_seed_puxian_dialects")
        migration.seed_puxian_dialects(apps, None)
        city = resolve_dialect("闽.莆仙.莆田.城里")
        city.name = "人工维护的城里话"
        city.sort_order = 999
        city.save(update_fields=["name", "sort_order", "updated_at"])
        migration.seed_puxian_dialects(apps, None)
        self.assertEqual(Dialect.objects.count(), 56)
        self.assertEqual(DialectCircle.objects.count(), 56)
        required = (
            "闽.莆仙",
            "闽.莆仙.莆田",
            "闽.莆仙.莆田.城里",
            "闽.莆仙.莆田.江口",
            "闽.莆仙.莆田.湄洲",
            "闽.莆仙.仙游",
            "闽.莆仙.仙游.城关",
            "闽.莆仙.仙游.游洋",
            "闽.莆仙.仙游.枫亭",
        )
        self.assertTrue(all(resolve_dialect(code) is not None for code in required))
        city.refresh_from_db()
        self.assertEqual(city.name, "人工维护的城里话")
        self.assertEqual(city.sort_order, 999)


class LegacyImportTests(TestCase):
    def setUp(self):
        super().setUp()
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.source_path = f"{self.directory.name}/legacy.sqlite3"
        connection = sqlite3.connect(self.source_path)
        connection.executescript(SOURCE_SCHEMA)
        users = [
            (
                1,
                "hash-1",
                "2020-01-01 00:00:00",
                1,
                "source_target_merge",
                "",
                "",
                "one@test.invalid",
                1,
                1,
                "2020-01-01 00:00:00",
            ),
            (
                2,
                "hash-2",
                "2024-01-02 00:00:00",
                1,
                "retired_login",
                "",
                "",
                "duplicate@test.invalid",
                1,
                1,
                "2020-01-02 00:00:00",
            ),
            (
                3,
                "hash-3",
                "2024-01-01 00:00:00",
                1,
                "wechat_survivor",
                "",
                "",
                "DUPLICATE@test.invalid",
                1,
                1,
                "2020-01-03 00:00:00",
            ),
        ]
        infos = [
            (
                1,
                "",
                "",
                "合并到目标",
                "1970-01-01",
                "13900000000",
                "默认头像",
                "外地",
                "未知",
                5,
                10,
            ),
            (
                2,
                "",
                "",
                "退役账号",
                "1990-01-01",
                "13800000000",
                "",
                "仙游县",
                "枫亭镇",
                7,
                12,
            ),
            (
                3,
                "wx-openid",
                "",
                "微信主体",
                "1991-01-01",
                "13800000000",
                "",
                "仙游县",
                "枫亭镇",
                11,
                21,
            ),
        ]
        connection.executemany(
            "INSERT INTO auth_user VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", users
        )
        connection.executemany(
            "INSERT INTO user_userinfo VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            infos,
        )
        words = [
            (10, "食", "吃", "旧注", "['吃']", "sieh4", "sih4", 1, 1, "['动作']"),
            (11, "行", "走", "", "['走路']", "kiaŋ2", "kiang2", 0, 2, "[]"),
        ]
        connection.executemany(
            "INSERT INTO word_word VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", words
        )
        connection.execute(
            "INSERT INTO word_pronunciation VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                20,
                "https://example.test/demo.mp3",
                "kiaŋ2",
                "kiang2",
                "仙游县",
                "枫亭镇",
                1,
                4,
                2,
                11,
                3,
                "2021-01-01 00:00:00",
            ),
        )
        connection.commit()
        connection.close()

        self.target = User.objects.create_user(
            username="target", password="keep-me", email="target@test.invalid"
        )
        UserInfo.objects.create(
            user=self.target,
            telephone="13900000000",
            points_now=2,
            points_sum=3,
        )

    def test_dry_run_is_read_only_and_apply_is_idempotent(self):
        with open_legacy_database(self.source_path) as connection:
            dry_report = HinghwaImporter(connection, apply=False).run()
        self.assertEqual(dry_report["source_counts"]["auth_user"], 3)
        self.assertEqual(dry_report["normalized"]["duplicate_email_accounts"], 2)
        self.assertEqual(dry_report["normalized"]["source_identity_wins"], 1)
        self.assertEqual(LegacyImportRecord.objects.count(), 0)
        self.assertEqual(User.objects.count(), 1)

        self.target.groups.add(Group.objects.create(name="retired-target-role"))
        self.client.force_login(self.target)
        retired_session_key = self.client.session.session_key
        with open_legacy_database(self.source_path) as connection:
            report = HinghwaImporter(connection, apply=True).run()
        self.assertFalse(report["failed"])
        self.assertEqual(report["created"]["users"], 1)
        self.assertEqual(User.objects.count(), 2)

        self.target.refresh_from_db()
        target_info = self.target.user_info
        target_info.refresh_from_db()
        self.assertEqual(self.target.username, "source_target_merge")
        self.assertEqual(self.target.password, "hash-1")
        self.assertTrue(self.target.is_staff)
        self.assertTrue(self.target.is_superuser)
        self.assertFalse(self.target.groups.exists())
        self.assertFalse(
            Session.objects.filter(session_key=retired_session_key).exists()
        )
        self.assertEqual((target_info.points_now, target_info.points_sum), (7, 13))

        survivor = User.objects.get(username="retired_login")
        self.assertEqual(survivor.password, "hash-2")
        self.assertEqual(survivor.email, "")
        self.assertTrue(survivor.is_superuser)
        self.assertEqual(survivor.user_info.wechat, "")
        self.assertEqual(
            (survivor.user_info.points_now, survivor.user_info.points_sum), (18, 33)
        )
        self.assertFalse(User.objects.filter(username="wechat_survivor").exists())
        self.assertEqual(Flavor.objects.get(name="食").created_by, self.target)
        self.assertEqual(Flavor.objects.get(name="行").created_by, survivor)
        self.assertEqual(Can.objects.get().recorder, survivor)
        self.assertEqual(Package.objects.count(), 2)

        counts = {
            "users": User.objects.count(),
            "flavors": Flavor.objects.count(),
            "cans": Can.objects.count(),
            "ledger": LegacyImportRecord.objects.count(),
        }

        # Simulate a database imported by the previous fixed-target-wins rule.
        self.target.username = "target"
        self.target.set_password("keep-me")
        self.target.is_staff = False
        self.target.is_superuser = False
        self.target.save(
            update_fields=["username", "password", "is_staff", "is_superuser"]
        )
        old_ledger = LegacyImportRecord.objects.get(
            source_system="hinghwa-dict-backend",
            source_table="auth_user",
            source_id="1",
        )
        old_ledger.metadata = {
            "privileges_inherited": False,
            "email_cleared": False,
        }
        old_ledger.save(update_fields=["metadata", "updated_at"])

        with open_legacy_database(self.source_path) as connection:
            rerun = HinghwaImporter(connection, apply=True).run()
        self.assertEqual(rerun["skipped"]["users"], 3)
        self.assertEqual(rerun["normalized"]["account_identity_repairs"], 1)
        self.assertEqual(
            counts,
            {
                "users": User.objects.count(),
                "flavors": Flavor.objects.count(),
                "cans": Can.objects.count(),
                "ledger": LegacyImportRecord.objects.count(),
            },
        )
        self.target.refresh_from_db()
        self.assertEqual(self.target.username, "source_target_merge")
        self.assertEqual(self.target.password, "hash-1")
        self.assertTrue(self.target.is_staff)
        self.assertTrue(self.target.is_superuser)
        target_info.refresh_from_db()
        self.assertEqual((target_info.points_now, target_info.points_sum), (7, 13))

    def test_more_recent_target_login_wins_when_admin_status_is_equal(self):
        connection = sqlite3.connect(self.source_path)
        connection.execute(
            "UPDATE auth_user SET is_staff = 0, is_superuser = 0, "
            "last_login = '2020-01-01 00:00:00' WHERE id = 1"
        )
        connection.commit()
        connection.close()
        self.target.last_login = parse_legacy_datetime("2025-01-01 00:00:00")
        self.target.save(update_fields=["last_login"])

        with open_legacy_database(self.source_path) as connection:
            HinghwaImporter(connection, apply=True).run()

        self.target.refresh_from_db()
        self.assertEqual(self.target.username, "target")
        self.assertTrue(self.target.check_password("keep-me"))
        ledger = LegacyImportRecord.objects.get(
            source_system="hinghwa-dict-backend",
            source_table="auth_user",
            source_id="1",
        )
        self.assertEqual(ledger.metadata["identity_winner"], "target")

    def test_dry_run_reports_third_party_identity_conflict(self):
        User.objects.create_user(username="source_target_merge")

        with open_legacy_database(self.source_path) as connection:
            report = HinghwaImporter(connection, apply=False).run()

        self.assertIn({"source_ids": [1], "reason": "username"}, report["conflicts"])
        self.assertEqual(LegacyImportRecord.objects.count(), 0)

    def test_sanitized_fixture_dry_run_and_idempotent_load(self):
        payload = {
            "schema_version": 1,
            "format": "guantou-logical-key-demo",
            "actors": [
                {"key": "actor_1", "display_name": "示例贡献者1", "role": "contributor"}
            ],
            "entries": [
                {
                    "key": "entry_1",
                    "dialect": "闽.莆仙.仙游.枫亭",
                    "package": {"text": "食", "package_type": "uncertain"},
                    "flavor": {
                        "name": "食",
                        "definition": "吃",
                        "mandarin": ["吃"],
                        "tags": [],
                        "visibility": True,
                    },
                    "pronunciation": {
                        "ipa": "sieh4",
                        "surface_romanization": "sih4",
                        "reading_type": "general",
                        "status": "verified",
                    },
                    "can": {
                        "audio_url": "https://example.test/fixture.mp3",
                        "concept_text": "吃",
                        "status": "verified",
                        "visibility": True,
                        "recorder": "actor_1",
                        "verifier": None,
                    },
                    "nameplate": {
                        "creator": "actor_1",
                        "text_content": "食",
                        "definition": "吃",
                        "pronunciation_text": "sih4",
                        "evidence_level": 2,
                        "weight": 10,
                    },
                }
            ],
        }
        dry = import_demo_fixture(payload, apply=False)
        self.assertEqual(dry["source_counts"]["entries"], 1)
        self.assertFalse(User.objects.filter(username="hinghwa_demo_actor_1").exists())
        first = import_demo_fixture(payload, apply=True)
        second = import_demo_fixture(payload, apply=True)
        self.assertEqual(first["created"]["entries"], 1)
        self.assertEqual(second["skipped"]["entries"], 1)
        demo_user = User.objects.get(username="hinghwa_demo_actor_1")
        self.assertFalse(demo_user.has_usable_password())
        self.assertEqual(demo_user.email, "")
        self.assertFalse(demo_user.is_staff)
        self.assertFalse(demo_user.is_superuser)
