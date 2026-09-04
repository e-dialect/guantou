from django.utils import timezone
from urllib.parse import urlparse

from utils.exceptions.types.not_found import NotFoundException
from files.storage import download_file, random_str

DEFAULT_AVATAR = "https://cos.edialect.top/website/默认头像.jpg"
TRUSTED_AVATAR_DOMAINS = {
    "api.pxm.edialect.top",
    "cos.edialect.top",
    "cos.test.edialect.top",
    "dummyimage.com",
}
LOCAL_AVATAR_HOSTS = {
    "localhost",
    "127.0.0.1",
}


def is_trusted_avatar_url(avatar):
    parsed = urlparse(avatar)
    if parsed.netloc in TRUSTED_AVATAR_DOMAINS:
        return True
    return parsed.hostname in LOCAL_AVATAR_HOSTS


def upload_avatar(user_id, avatar, suffix="png"):
    if not avatar:
        return ""
    if avatar == DEFAULT_AVATAR:
        return avatar
    if is_trusted_avatar_url(avatar):
        return avatar

    filename = f"{timezone.now().strftime('%Y_%m_%d')}_{random_str(15)}.{suffix}"
    url = download_file(avatar, "download", str(user_id), filename)
    if url is None:
        raise NotFoundException("头像上传失败")
    return url
