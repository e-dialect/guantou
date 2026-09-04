from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase


class EntryRecordingV2SchemaMigrationTests(TransactionTestCase):
    migrate_from = ("guantou", "0019_cancomment_parent_cancomment_reply_to_and_more")
    migrate_to = ("guantou", "0020_entry_recording_v2_domain")

    def setUp(self):
        super().setUp()
        executor = MigrationExecutor(connection)
        executor.migrate([self.migrate_from])
        old_apps = executor.loader.project_state([self.migrate_from]).apps

        User = old_apps.get_model("auth", "User")
        Dialect = old_apps.get_model("guantou", "Dialect")
        Can = old_apps.get_model("guantou", "Can")
        user = User.objects.create(username="v2-migration")
        dialect = Dialect.objects.create(name="莆仙方言", code="puxian-v2")
        can = Can.objects.create(
            audio_url="https://example.test/legacy-v2.mp3",
            recorder=user,
            submitted_dialect=dialect,
            concept_text="旧库词条",
            visibility=True,
        )
        self.ids = {"user": user.id, "dialect": dialect.id, "can": can.id}

        executor = MigrationExecutor(connection)
        executor.migrate([self.migrate_to])
        self.apps = executor.loader.project_state([self.migrate_to]).apps

    def tearDown(self):
        MigrationExecutor(connection).migrate(
            MigrationExecutor(connection).loader.graph.leaf_nodes()
        )
        super().tearDown()

    def test_forward_migration_preserves_legacy_rows_without_auto_importing(self):
        Can = self.apps.get_model("guantou", "Can")
        Entry = self.apps.get_model("guantou", "Entry")
        Recording = self.apps.get_model("guantou", "Recording")

        legacy_can = Can.objects.get(pk=self.ids["can"])
        self.assertEqual(legacy_can.concept_text, "旧库词条")
        self.assertTrue(legacy_can.visibility)
        self.assertEqual(Entry.objects.count(), 0)
        self.assertEqual(Recording.objects.count(), 0)

    def test_new_schema_supports_entry_without_recording_and_many_to_many_link(self):
        Entry = self.apps.get_model("guantou", "Entry")
        EntrySense = self.apps.get_model("guantou", "EntrySense")
        Recording = self.apps.get_model("guantou", "Recording")
        RecordingEntryLink = self.apps.get_model("guantou", "RecordingEntryLink")

        entry = Entry.objects.create(
            summary="表示害怕的意思",
            usage_dialect_id=self.ids["dialect"],
            created_by_id=self.ids["user"],
        )
        EntrySense.objects.create(entry=entry, sense_number=1, gloss="害怕")
        self.assertFalse(RecordingEntryLink.objects.filter(entry=entry).exists())

        recording = Recording.objects.create(
            audio_url="https://example.test/new-v2.mp3",
            usage_dialect_id=self.ids["dialect"],
            recorder_id=self.ids["user"],
            original_gloss="害怕",
        )
        RecordingEntryLink.objects.create(
            recording=recording,
            entry=entry,
            role="primary",
            status="accepted",
        )
        self.assertEqual(recording.entry_links.get().entry_id, entry.id)


class ApiV1DomainMigrationTests(TransactionTestCase):
    migrate_from = ("guantou", "0003_can_transition_log")
    migrate_to = ("guantou", "0004_api_v1_domain_model")

    def setUp(self):
        super().setUp()
        executor = MigrationExecutor(connection)
        executor.migrate([self.migrate_from])
        old_apps = executor.loader.project_state([self.migrate_from]).apps

        User = old_apps.get_model("auth", "User")
        Dialect = old_apps.get_model("guantou", "Dialect")
        Package = old_apps.get_model("guantou", "Package")
        Flavor = old_apps.get_model("guantou", "Flavor")
        FlavorPackage = old_apps.get_model("guantou", "FlavorPackage")
        FlavorVariant = old_apps.get_model("guantou", "FlavorVariant")
        Can = old_apps.get_model("guantou", "Can")
        Nameplate = old_apps.get_model("guantou", "Nameplate")

        user = User.objects.create(username="legacy")
        dialect = Dialect.objects.create(
            name="游洋",
            code="youyang",
            region_level="town",
            province="福建",
            city="莆田",
            county="仙游",
            town="游洋",
        )
        package = Package.objects.create(text="行", package_type="orthodox")
        flavor = Flavor.objects.create(name="行走", definition="走路", created_by=user)
        FlavorPackage.objects.create(
            flavor=flavor, package=package, mapping_type="primary"
        )
        variant = FlavorVariant.objects.create(
            flavor=flavor,
            dialect=dialect,
            ipa="hiŋ²³",
            romanization="hing2",
            reading_type="changed_tone",
            audio_url="https://example.test/legacy.mp3",
            audio_source="user",
            created_by=user,
        )
        can = Can.objects.create(
            audio_url="https://example.test/legacy.mp3",
            recorder=user,
            dialect=dialect,
            flavor_variant=variant,
            concept_text="走路",
            county="仙游",
            town="游洋",
        )
        Nameplate.objects.create(
            can=can,
            flavor=flavor,
            package=package,
            creator=user,
            text_content="行",
            definition="走路",
            source_citation="方言志第 42 页",
            is_primary=True,
        )
        self.ids = {
            "dialect": dialect.id,
            "package": package.id,
            "flavor": flavor.id,
            "pronunciation": variant.id,
            "can": can.id,
        }

        executor = MigrationExecutor(connection)
        executor.migrate([self.migrate_to])
        self.apps = executor.loader.project_state([self.migrate_to]).apps

    def tearDown(self):
        MigrationExecutor(connection).migrate(
            MigrationExecutor(connection).loader.graph.leaf_nodes()
        )
        super().tearDown()

    def test_legacy_variant_and_can_relation_become_nameplate_attestation(self):
        Pronunciation = self.apps.get_model("guantou", "Pronunciation")
        Can = self.apps.get_model("guantou", "Can")
        Nameplate = self.apps.get_model("guantou", "Nameplate")
        Dialect = self.apps.get_model("guantou", "Dialect")

        pronunciation = Pronunciation.objects.get(pk=self.ids["pronunciation"])
        self.assertEqual(pronunciation.package_id, self.ids["package"])
        self.assertEqual(pronunciation.flavor_id, self.ids["flavor"])
        self.assertEqual(pronunciation.dialect_id, self.ids["dialect"])
        self.assertIn("legacy.mp3", pronunciation.source_citation)
        self.assertEqual(pronunciation.surface_romanization, "hing2")
        self.assertEqual(pronunciation.base_romanization, "")
        self.assertFalse(hasattr(pronunciation, "tone_value"))
        self.assertEqual(pronunciation.reading_type, "other")
        self.assertIn("changed_tone", pronunciation.usage_note)

        can = Can.objects.get(pk=self.ids["can"])
        self.assertEqual(can.submitted_dialect_id, self.ids["dialect"])
        self.assertEqual(
            can.metadata["legacy_location"], {"county": "仙游", "town": "游洋"}
        )

        plate = Nameplate.objects.get(can_id=can.id)
        self.assertEqual(plate.pronunciation_id, pronunciation.id)
        self.assertEqual(plate.dialect_id, self.ids["dialect"])
        self.assertEqual(plate.source["type"], "other")
        self.assertIn("42", plate.source["note"])
        self.assertTrue(plate.is_primary)

        dialect = Dialect.objects.get(pk=self.ids["dialect"])
        self.assertEqual(dialect.external_refs["legacy_region_level"], "town")
        self.assertEqual(dialect.external_refs["legacy_location"]["town"], "游洋")

        executor = MigrationExecutor(connection)
        executor.migrate([self.migrate_from])
        old_apps = executor.loader.project_state([self.migrate_from]).apps
        legacy_variant = old_apps.get_model("guantou", "FlavorVariant").objects.get(
            pk=self.ids["pronunciation"]
        )
        legacy_dialect = old_apps.get_model("guantou", "Dialect").objects.get(
            pk=self.ids["dialect"]
        )
        self.assertEqual(legacy_variant.romanization, "hing2")
        self.assertEqual(legacy_variant.reading_type, "changed_tone")
        self.assertEqual(legacy_dialect.region_level, "town")


class ShelfThroughMigrationTests(TransactionTestCase):
    migrate_from = ("guantou", "0010_canpost")
    migrate_to = ("guantou", "0011_content_governance")

    def setUp(self):
        super().setUp()
        executor = MigrationExecutor(connection)
        executor.migrate([self.migrate_from])
        old_apps = executor.loader.project_state([self.migrate_from]).apps
        User = old_apps.get_model("auth", "User")
        Dialect = old_apps.get_model("guantou", "Dialect")
        Flavor = old_apps.get_model("guantou", "Flavor")
        Can = old_apps.get_model("guantou", "Can")
        Shelf = old_apps.get_model("guantou", "Shelf")
        user = User.objects.create(username="shelf-migration")
        dialect = Dialect.objects.create(name="迁移方言", code="migration")
        first_flavor = Flavor.objects.create(name="第一", definition="一")
        second_flavor = Flavor.objects.create(name="第二", definition="二")
        first_can = Can.objects.create(
            recorder=user,
            submitted_dialect=dialect,
            audio_url="https://example.test/first.mp3",
            concept_text="第一",
        )
        second_can = Can.objects.create(
            recorder=user,
            submitted_dialect=dialect,
            audio_url="https://example.test/second.mp3",
            concept_text="第二",
        )
        shelf = Shelf.objects.create(title="迁移集盒", slug="migration")
        shelf.flavors.add(second_flavor, first_flavor)
        shelf.cans.add(second_can, first_can)
        old_flavor_links = Shelf._meta.get_field("flavors").remote_field.through
        old_can_links = Shelf._meta.get_field("cans").remote_field.through
        self.ids = {
            "shelf": shelf.id,
            "flavors": list(
                old_flavor_links.objects.filter(shelf_id=shelf.id)
                .order_by("id")
                .values_list("flavor_id", flat=True)
            ),
            "cans": list(
                old_can_links.objects.filter(shelf_id=shelf.id)
                .order_by("id")
                .values_list("can_id", flat=True)
            ),
        }

        executor = MigrationExecutor(connection)
        executor.migrate([self.migrate_to])
        self.apps = executor.loader.project_state([self.migrate_to]).apps

    def tearDown(self):
        MigrationExecutor(connection).migrate(
            MigrationExecutor(connection).loader.graph.leaf_nodes()
        )
        super().tearDown()

    def test_existing_links_survive_forward_and_reverse_migration(self):
        ShelfFlavor = self.apps.get_model("guantou", "ShelfFlavor")
        ShelfCan = self.apps.get_model("guantou", "ShelfCan")
        self.assertEqual(
            list(
                ShelfFlavor.objects.filter(shelf_id=self.ids["shelf"])
                .order_by("sort_order")
                .values_list("flavor_id", flat=True)
            ),
            self.ids["flavors"],
        )
        self.assertEqual(
            list(
                ShelfCan.objects.filter(shelf_id=self.ids["shelf"])
                .order_by("sort_order")
                .values_list("can_id", flat=True)
            ),
            self.ids["cans"],
        )

        executor = MigrationExecutor(connection)
        executor.migrate([self.migrate_from])
        old_apps = executor.loader.project_state([self.migrate_from]).apps
        Shelf = old_apps.get_model("guantou", "Shelf")
        shelf = Shelf.objects.get(id=self.ids["shelf"])
        self.assertEqual(
            set(shelf.flavors.values_list("id", flat=True)), set(self.ids["flavors"])
        )
        self.assertEqual(
            set(shelf.cans.values_list("id", flat=True)), set(self.ids["cans"])
        )


class CanTransitionMigrationTests(TransactionTestCase):
    migrate_from = ("guantou", "0014_repair_legacy_schema_drift")
    migrate_to = ("guantou", "0018_can_transition_log_to_relations")

    def setUp(self):
        super().setUp()
        executor = MigrationExecutor(connection)
        executor.migrate([self.migrate_from])
        old_apps = executor.loader.project_state([self.migrate_from]).apps

        User = old_apps.get_model("auth", "User")
        Dialect = old_apps.get_model("guantou", "Dialect")
        Can = old_apps.get_model("guantou", "Can")

        user = User.objects.create(username="legacy-user")
        missing_user = User.objects.create(username="missing-user")
        missing_user_id = missing_user.id
        missing_user.delete()
        dialect = Dialect.objects.create(name="迁移方言", code="migration")
        self.original_log = [
            {
                "action": "submit",
                "from": "pending",
                "to": "tentative",
                "by": {
                    "id": user.id,
                    "username": "legacy-user",
                    "nickname": "",
                    "avatar": "",
                },
                "at": "2026-01-02T03:04:05+00:00",
                "reason": "确认",
            },
            {
                "action": "verify",
                "from": "tentative",
                "to": "verified",
                "by": user.id,
                "at": "2026-01-03T04:05:06+00:00",
                "reason": "",
            },
            {
                "action": "restore",
                "from": "rejected",
                "to": "pending",
                "by": missing_user_id,
                "at": "2026-01-04T05:06:07+00:00",
                "reason": "missing",
            },
            "not-a-dict",
        ]
        can = Can.objects.create(
            audio_url="https://example.test/legacy.mp3",
            recorder=user,
            submitted_dialect=dialect,
            concept_text="走路",
            transition_log=self.original_log,
        )
        self.can_id = can.id

        executor = MigrationExecutor(connection)
        executor.migrate([self.migrate_to])
        self.apps = executor.loader.project_state([self.migrate_to]).apps

    def tearDown(self):
        MigrationExecutor(connection).migrate(
            MigrationExecutor(connection).loader.graph.leaf_nodes()
        )
        super().tearDown()

    def test_forward_creates_rows_and_keeps_json_untouched(self):
        CanTransition = self.apps.get_model("guantou", "CanTransition")
        Can = self.apps.get_model("guantou", "Can")

        rows = list(
            CanTransition.objects.filter(can_id=self.can_id).order_by(
                "created_at", "id"
            )
        )
        self.assertEqual(len(rows), 3)
        self.assertEqual(rows[0].action, "submit")
        self.assertEqual(rows[0].from_status, "pending")
        self.assertEqual(rows[0].to_status, "tentative")
        self.assertEqual(rows[0].reason, "确认")
        self.assertEqual(rows[1].action, "verify")
        self.assertEqual(rows[1].to_status, "verified")
        self.assertIsNotNone(rows[1].actor)
        self.assertIsNone(rows[2].actor)

        can = Can.objects.get(pk=self.can_id)
        self.assertEqual(can.transition_log, self.original_log)

    def test_reverse_drops_rows_and_preserves_json(self):
        executor = MigrationExecutor(connection)
        executor.migrate([self.migrate_from])
        old_apps = executor.loader.project_state([self.migrate_from]).apps

        Can = old_apps.get_model("guantou", "Can")
        can = Can.objects.get(pk=self.can_id)
        self.assertEqual(can.transition_log, self.original_log)
        self.assertFalse("CanTransition" in old_apps.all_models.get("guantou", {}))
