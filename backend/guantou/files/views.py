import os

import demjson3
from django.conf import settings
from django.http import HttpResponse, JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from pydub import AudioSegment as audio

from user.tokens import get_authorization_token, token_check
from utils.exceptions.types.bad_request import BadRequestException

from .storage import delete_file, random_str, upload_file

ALLOWED_AUDIO_CONTENT_TYPES = frozenset(
    {
        "audio/mpeg",
        "audio/mp3",
        "audio/wav",
        "audio/wave",
        "audio/x-wav",
        "audio/mp4",
        "audio/x-m4a",
        "audio/m4a",
    }
)

ALLOWED_AUDIO_EXTENSIONS = frozenset({"mp3", "wav", "m4a"})

MAX_AUDIO_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB


def file_extension(uploaded_file, file_type):
    name = getattr(uploaded_file, "name", "")
    if "." in name:
        return name.rsplit(".", 1)[-1]
    if file_type == "image":
        return "png"
    if file_type == "video":
        return "mp4"
    return "mp3"


def validate_audio_format(uploaded_file):
    content_type = str(uploaded_file.content_type or "").lower()
    ext = file_extension(uploaded_file, "audio").lower()
    if content_type and content_type not in ALLOWED_AUDIO_CONTENT_TYPES:
        raise BadRequestException("不支持的音频格式")
    if ext not in ALLOWED_AUDIO_EXTENSIONS:
        raise BadRequestException("不支持的音频格式")
    if uploaded_file.size > MAX_AUDIO_SIZE_BYTES:
        raise BadRequestException("音频文件大小不能超过 5 MB")


def extract_duration_ms(audio_segment):
    return int(audio_segment.duration_seconds * 1000)


@csrf_exempt
def files(request):
    user = token_check(get_authorization_token(request))
    if not user:
        return JsonResponse({}, status=401)
    if request.method == "POST":
        uploaded_file = request.FILES.get("file")
        if not uploaded_file:
            return JsonResponse({"msg": "缺少文件"}, status=400)
        file_type = str(uploaded_file.content_type or "application/octet-stream").split(
            "/"
        )[0]
        suffix = file_extension(uploaded_file, file_type)
        if file_type == "audio":
            validate_audio_format(uploaded_file)
        filename = f"{timezone.now().strftime('%Y_%m_%d')}_{random_str(15)}.{suffix}"
        folder = os.path.join(settings.MEDIA_ROOT, file_type, str(user.id))
        os.makedirs(folder, exist_ok=True)
        path = os.path.join(folder, filename)
        duration_ms = 0
        if file_type != "audio":
            with open(path, "wb") as f:
                for chunk in uploaded_file.chunks():
                    f.write(chunk)
        else:
            music = audio.from_file(uploaded_file)
            duration_ms = extract_duration_ms(music)
            music.set_frame_rate(44100)
            music.export(path, format="mp3")
        key = (
            f"files/{file_type}/{user.id}/"
            + timezone.now().strftime("%Y/%m/%d/")
            + filename.split("_")[-1]
        )
        response_data = {"url": upload_file(path, key)}
        if file_type == "audio":
            response_data["duration_ms"] = duration_ms
        return JsonResponse(response_data, status=200)
    if request.method == "DELETE":
        body = demjson3.decode(request.body)
        suffix = body["url"].split("/", 4)[-1]
        file_type = suffix.split("/", 2)[0]
        user_id = suffix.split("/", 2)[1]
        if user.id != int(user_id) and not user.is_superuser:
            return JsonResponse({}, status=401)
        filename = "_".join(suffix.split("/", 2)[2].split("/"))
        path = os.path.join(settings.MEDIA_ROOT, file_type, user_id, filename)
        if not os.path.exists(path):
            return JsonResponse({}, status=404)
        os.remove(path)
        delete_file(body["url"].split("/", 3)[-1])
        return JsonResponse({}, status=200)
    return JsonResponse({}, status=405)


@csrf_exempt
def open_file_url(request, type, id, Y, M, D, X):
    filename = f"{Y}_{M}_{D}_{X}"
    path = os.path.join(settings.MEDIA_ROOT, type, id, filename)
    if not os.path.exists(path):
        return JsonResponse({}, status=404)
    with open(path.encode("utf-8"), "rb") as f:
        response = HttpResponse(f.read(), content_type="application/octet-stream")
        response["Content-Disposition"] = f"attachment; filename={X}"
        return response
