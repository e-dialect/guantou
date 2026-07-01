import os

import demjson3
from django.conf import settings
from django.http import HttpResponse, JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from pydub import AudioSegment as audio

from user.tokens import token_check

from .storage import delete_file, random_str, upload_file


def file_extension(uploaded_file, file_type):
    name = getattr(uploaded_file, "name", "")
    if "." in name:
        return name.rsplit(".", 1)[-1]
    if file_type == "image":
        return "png"
    if file_type == "video":
        return "mp4"
    return "mp3"


@csrf_exempt
def files(request):
    user = token_check(request.headers.get("token"))
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
        filename = f"{timezone.now().strftime('%Y_%m_%d')}_{random_str(15)}.{suffix}"
        folder = os.path.join(settings.MEDIA_ROOT, file_type, str(user.id))
        os.makedirs(folder, exist_ok=True)
        path = os.path.join(folder, filename)
        if file_type != "audio":
            with open(path, "wb") as f:
                for chunk in uploaded_file.chunks():
                    f.write(chunk)
        else:
            music = audio.from_file(uploaded_file)
            music.set_frame_rate(44100)
            music.export(path, format="mp3")
        key = (
            f"files/{file_type}/{user.id}/"
            + timezone.now().strftime("%Y/%m/%d/")
            + filename.split("_")[-1]
        )
        return JsonResponse({"url": upload_file(path, key)}, status=200)
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
