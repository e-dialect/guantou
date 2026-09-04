import os
import random
import re

import requests
from django.conf import settings
from qcloud_cos import CosConfig, CosS3Client


def random_str(length=6, digit_only=False):
    chars = (
        "1234567890"
        if digit_only
        else "1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
    )
    return "".join(random.choice(chars) for _ in range(length))


def _is_placeholder(value):
    return not str(value or "").strip() or str(value).startswith("DEFAULT_")


def cos_is_configured():
    region = str(getattr(settings, "COS_REGION", "") or "")
    secret_id = str(getattr(settings, "COS_SECRET_ID", "") or "")
    bucket = str(getattr(settings, "COS_BUCKET", "") or "")
    if _is_placeholder(region) or not re.fullmatch(r"[0-9A-Za-z-]+", region):
        return False
    if _is_placeholder(secret_id) or _is_placeholder(bucket):
        return False
    return True


def public_file_url(key):
    base = str(getattr(settings, "PUBLIC_BACKEND_URL", "") or "http://localhost:8000")
    return f"{base.rstrip('/')}/{str(key).lstrip('/')}"


def upload_file(path, key):
    if not cos_is_configured():
        return public_file_url(key)
    client = cos_client()
    client.upload_file(Bucket=settings.COS_BUCKET, LocalFilePath=path, Key=key)
    if settings.COS_BUCKET.find("test") != -1:
        return f"https://cos.test.edialect.top/{key}"
    return f"https://cos.edialect.top/{key}"


def delete_file(key):
    if not cos_is_configured():
        return
    cos_client().delete_object(Bucket=settings.COS_BUCKET, Key=key)


def download_file(url, file_type, user_id, filename):
    try:
        folder = os.path.join(settings.MEDIA_ROOT, file_type, user_id)
        os.makedirs(folder, exist_ok=True)
        path = os.path.join(folder, filename)
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        with open(path, "wb") as f:
            f.write(response.content)
        key = f'files/{file_type}/{user_id}/{filename.replace("_", "/")}'
        return upload_file(path, key)
    except Exception as exc:
        print(f"download_file failed: {exc}")
        return None


def cos_client():
    config = CosConfig(
        Region=settings.COS_REGION,
        SecretId=settings.COS_SECRET_ID,
        SecretKey=settings.COS_SECRET_KEY,
    )
    return CosS3Client(config)
