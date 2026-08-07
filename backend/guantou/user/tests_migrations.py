from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase


class PrimaryDialectMigrationTests(TransactionTestCase):
    migrate_from = [
        ("guantou", "0004_api_v1_domain_model"),
        ("user", "0001_initial"),
    ]
    migrate_to = ("user", "0002_primary_dialect")

    def setUp(self):
        super().setUp()
        executor = MigrationExecutor(connection)
        executor.migrate(self.migrate_from)
        old_apps = executor.loader.project_state(self.migrate_from).apps

        User = old_apps.get_model("auth", "User")
        UserInfo = old_apps.get_model("user", "UserInfo")
        Dialect = old_apps.get_model("guantou", "Dialect")

        user = User.objects.create(username="legacy-profile")
        dialect = Dialect.objects.create(
            name="游洋",
            code="游洋",
            kind="local_variety",
        )
        UserInfo.objects.create(
            user=user,
            nickname="旧用户",
            county="仙游县",
            town="游洋镇",
        )
        self.user_id = user.id
        self.dialect_id = dialect.id

        executor = MigrationExecutor(connection)
        executor.migrate([self.migrate_to])
        self.apps = executor.loader.project_state([self.migrate_to]).apps

    def tearDown(self):
        MigrationExecutor(connection).migrate(
            MigrationExecutor(connection).loader.graph.leaf_nodes()
        )
        super().tearDown()

    def test_location_is_preserved_and_unambiguous_dialect_is_linked(self):
        UserInfo = self.apps.get_model("user", "UserInfo")

        info = UserInfo.objects.get(user_id=self.user_id)
        self.assertEqual(info.primary_dialect_id, self.dialect_id)
        self.assertEqual(
            info.legacy_location,
            {"county": "仙游县", "town": "游洋镇"},
        )
