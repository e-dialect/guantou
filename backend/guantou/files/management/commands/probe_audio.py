from django.core.management.base import BaseCommand, CommandError

from files.audio_processing import missing_audio_binaries, probe_audio_capability


class Command(BaseCommand):
    help = "Verify that ffmpeg and ffprobe are available for audio uploads."

    def handle(self, *args, **options):
        capability = probe_audio_capability()
        missing = missing_audio_binaries(capability)
        if missing:
            names = "、".join(missing)
            raise CommandError(f"音频处理能力不可用（缺少 {names}）")
        summary = " ".join(
            f"{name}={capability[name]}" for name in ("ffmpeg", "ffprobe")
        )
        self.stdout.write(self.style.SUCCESS(f"音频处理能力可用：{summary}"))
