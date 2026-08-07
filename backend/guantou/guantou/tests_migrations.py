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
