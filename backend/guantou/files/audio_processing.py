"""Audio normalization with explicit, lazy runtime capability checks."""

import shutil

REQUIRED_AUDIO_BINARIES = ("ffmpeg", "ffprobe")


class AudioCapabilityUnavailable(RuntimeError):
    def __init__(self, missing):
        self.missing = tuple(missing)
        names = "、".join(self.missing)
        super().__init__(f"音频处理服务暂不可用（缺少 {names}）")


class AudioDecodeError(ValueError):
    pass


class AudioProcessingError(RuntimeError):
    pass


def probe_audio_capability():
    return {name: shutil.which(name) for name in REQUIRED_AUDIO_BINARIES}


def missing_audio_binaries(capability=None):
    current = capability if capability is not None else probe_audio_capability()
    return tuple(name for name in REQUIRED_AUDIO_BINARIES if not current.get(name))


def require_audio_capability():
    capability = probe_audio_capability()
    missing = missing_audio_binaries(capability)
    if missing:
        raise AudioCapabilityUnavailable(missing)
    return capability


def _pydub_api():
    # Importing pydub probes ffmpeg at module import time. Keep it behind the
    # explicit capability guard so Django startup and non-audio commands stay quiet.
    from pydub import AudioSegment
    from pydub.exceptions import CouldntDecodeError, CouldntEncodeError

    return AudioSegment, CouldntDecodeError, CouldntEncodeError


def normalize_audio_to_mp3(uploaded_file, output_path):
    require_audio_capability()
    audio_segment, decode_error, encode_error = _pydub_api()
    try:
        music = audio_segment.from_file(uploaded_file)
        duration_ms = int(music.duration_seconds * 1000)
        music = music.set_frame_rate(44100)
        music.export(output_path, format="mp3")
    except decode_error as exc:
        raise AudioDecodeError("无法解析音频文件") from exc
    except (encode_error, FileNotFoundError, OSError) as exc:
        raise AudioProcessingError("音频转码失败") from exc
    return duration_ms
