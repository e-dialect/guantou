import os
import subprocess
import sys
import tempfile

from django.conf import settings
from django.test import SimpleTestCase, override_settings


class RuntimeConfigurationTests(SimpleTestCase):
    def _run_settings_import(self, overrides, env_file=""):
        environment = os.environ.copy()
        for key in (
            "SECRET_KEY",
            "JWT_KEY",
            "EMAIL_HOST",
            "EMAIL_HOST_USER",
            "EMAIL_HOST_PASSWORD",
            "DEFAULT_FROM_EMAIL",
            "COS_SECRET_ID",
            "COS_SECRET_KEY",
            "COS_BUCKET",
            "COS_REGION",
            "APP_ID",
            "APP_SECRET",
            "APP_SECRECT",
        ):
            environment.pop(key, None)
        environment.update(overrides)
        environment["ENV_FILE"] = env_file
        environment["PYTHONPYCACHEPREFIX"] = "/tmp/guantou-config-test-pycache"
        return subprocess.run(
            [sys.executable, "-c", "import config.settings"],
            cwd=settings.BASE_DIR,
            env=environment,
            capture_output=True,
            text=True,
            check=False,
        )

    def test_production_rejects_placeholder_or_missing_secrets(self):
        with tempfile.NamedTemporaryFile() as env_file:
            result = self._run_settings_import(
                {"ENVIRONMENT": "production"}, env_file.name
            )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Missing production settings", result.stderr)

    def test_ssl_and_tls_conflict_is_rejected_in_every_environment(self):
        with tempfile.NamedTemporaryFile() as env_file:
            result = self._run_settings_import(
                {
                    "ENVIRONMENT": "test",
                    "EMAIL_USE_SSL": "true",
                    "EMAIL_USE_TLS": "true",
                },
                env_file.name,
            )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("cannot both be true", result.stderr)

    def test_legacy_app_secrect_spelling_remains_a_fallback(self):
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8") as env_file:
            env_file.write("APP_SECRECT=legacy-compatible-value\n")
            env_file.flush()
            environment = os.environ.copy()
            environment.pop("APP_SECRET", None)
            environment.pop("APP_SECRECT", None)
            environment["ENV_FILE"] = env_file.name
            environment["PYTHONPYCACHEPREFIX"] = "/tmp/guantou-config-test-pycache"
            result = subprocess.run(
                [
                    sys.executable,
                    "-c",
                    "from config.settings import APP_SECRET; "
                    "assert APP_SECRET == 'legacy-compatible-value'",
                ],
                cwd=settings.BASE_DIR,
                env=environment,
                capture_output=True,
                text=True,
                check=False,
            )
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_static_root_is_project_local(self):
        self.assertEqual(
            settings.STATIC_ROOT,
            os.path.join(settings.BASE_DIR, "staticfiles"),
        )

    @override_settings(DEBUG=False)
    def test_non_production_serves_admin_static_assets(self):
        response = self.client.get("/static/admin/simpleui-x/js/vue.min.js")

        self.assertEqual(response.status_code, 200)
        self.assertIn(
            response["Content-Type"],
            {"application/javascript", "text/javascript"},
        )
