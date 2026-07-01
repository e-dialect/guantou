import os
import random

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


def upload_file(path, key):
    client = cos_client()
    client.upload_file(Bucket=settings.COS_BUCKET, LocalFilePath=path, Key=key)
    if settings.COS_BUCKET.find("test") != -1:
        return f"https://cos.test.edialect.top/{key}"
    return f"https://cos.edialect.top/{key}"


def delete_file(key):
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
