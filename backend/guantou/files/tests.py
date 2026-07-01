import shutil
import tempfile
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, TestCase, override_settings

from user.tokens import generate_token


class FileApiTests(TestCase):
    def setUp(self):
        self.media_root = tempfile.mkdtemp()
        self.override = override_settings(MEDIA_ROOT=self.media_root)
        self.override.enable()
        self.user = User.objects.create_user(username="collector", password="pw")
        self.client = Client()

    def tearDown(self):
        self.override.disable()
        shutil.rmtree(self.media_root, ignore_errors=True)

    @patch("files.views.upload_file")
    def test_upload_requires_auth_and_returns_url(self, upload_file):
        upload_file.return_value = "https://cos.test.edialect.top/files/image/1/x.png"
        file = SimpleUploadedFile("cover.png", b"image", content_type="image/png")
        response = self.client.post("/files", {"file": file})
        self.assertEqual(response.status_code, 401)
        response = self.client.post(
            "/files",
            {"file": file},
            HTTP_TOKEN=generate_token(self.user),
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["url"], upload_file.return_value)
