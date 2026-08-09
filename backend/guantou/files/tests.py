import shutil
import tempfile
from unittest.mock import MagicMock, patch

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, TestCase, override_settings

from user.tokens import generate_token


def bearer(user):
    return f"Bearer {generate_token(user)}"


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

    def _auth_headers(self):
        return {"HTTP_AUTHORIZATION": bearer(self.user)}

    @patch("files.views.upload_file")
    def test_upload_requires_auth_and_returns_url(self, upload_file):
        upload_file.return_value = "https://cos.test.edialect.top/files/image/1/x.png"
        file = SimpleUploadedFile("cover.png", b"image", content_type="image/png")
        response = self.client.post("/files", {"file": file})
        self.assertEqual(response.status_code, 401)
        response = self.client.post(
            "/files",
            {"file": file},
            **self._auth_headers(),
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["url"], upload_file.return_value)

    @patch("files.views.upload_file")
    def test_upload_rejects_legacy_token_header(self, upload_file):
        upload_file.return_value = "https://cos.test.edialect.top/files/image/1/x.png"
        file = SimpleUploadedFile("cover.png", b"image", content_type="image/png")

        response = self.client.post(
            "/files",
            {"file": file},
            HTTP_TOKEN=generate_token(self.user),
        )

        self.assertEqual(response.status_code, 401)

    # --- Audio validation tests ---

    def test_reject_non_whitelist_content_type(self):
        file = SimpleUploadedFile("song.flac", b"fake-audio", content_type="audio/flac")
        response = self.client.post("/files", {"file": file}, **self._auth_headers())
        self.assertEqual(response.status_code, 400)

    def test_reject_non_whitelist_extension(self):
        file = SimpleUploadedFile("song.ogg", b"fake-audio", content_type="audio/ogg")
        response = self.client.post("/files", {"file": file}, **self._auth_headers())
        self.assertEqual(response.status_code, 400)

    def test_reject_oversized_audio(self):
        big_data = b"x" * (5 * 1024 * 1024 + 1)  # just over 5 MB
        file = SimpleUploadedFile("big.mp3", big_data, content_type="audio/mpeg")
        response = self.client.post("/files", {"file": file}, **self._auth_headers())
        self.assertEqual(response.status_code, 400)

    def test_image_upload_not_subject_to_audio_validation(self):
        file = SimpleUploadedFile("photo.png", b"image-data", content_type="image/png")
        with patch("files.views.upload_file") as upload_file:
            upload_file.return_value = "https://cos.example.com/x.png"
            response = self.client.post(
                "/files", {"file": file}, **self._auth_headers()
            )
        self.assertEqual(response.status_code, 200)

    @patch("files.views.upload_file")
    @patch("files.views.audio")
    def test_audio_upload_returns_duration_ms(self, mock_audio, upload_file):
        upload_file.return_value = "https://cos.example.com/x.mp3"
        mock_segment = MagicMock()
        mock_segment.duration_seconds = 3.456
        mock_audio.from_file.return_value = mock_segment

        file = SimpleUploadedFile("voice.mp3", b"fake-audio", content_type="audio/mpeg")
        response = self.client.post("/files", {"file": file}, **self._auth_headers())
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["url"], upload_file.return_value)
        self.assertEqual(data["duration_ms"], 3456)

    @patch("files.views.upload_file")
    @patch("files.views.audio")
    def test_audio_upload_accepts_wav(self, mock_audio, upload_file):
        upload_file.return_value = "https://cos.example.com/x.mp3"
        mock_segment = MagicMock()
        mock_segment.duration_seconds = 1.0
        mock_audio.from_file.return_value = mock_segment

        file = SimpleUploadedFile("voice.wav", b"fake-audio", content_type="audio/wav")
        response = self.client.post("/files", {"file": file}, **self._auth_headers())
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["duration_ms"], 1000)

    @patch("files.views.upload_file")
    @patch("files.views.audio")
    def test_audio_upload_accepts_m4a(self, mock_audio, upload_file):
        upload_file.return_value = "https://cos.example.com/x.mp3"
        mock_segment = MagicMock()
        mock_segment.duration_seconds = 2.5
        mock_audio.from_file.return_value = mock_segment

        file = SimpleUploadedFile("voice.m4a", b"fake-audio", content_type="audio/mp4")
        response = self.client.post("/files", {"file": file}, **self._auth_headers())
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["duration_ms"], 2500)
