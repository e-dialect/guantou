from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase


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
