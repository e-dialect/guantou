import random
import re

import demjson3
from django.conf import settings
from django.core.cache import cache
from django.core.mail import send_mail
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

EMAIL_CODE_TTL_SECONDS = 600
PHONE_PATTERN = re.compile(r"^1\d{10}$")


def normalize_email(email):
    return str(email).replace(" ", "").strip().lower()


def email_cache_key(email):
    return f"email_code:{normalize_email(email)}"


def generate_email_code(length=6):
    return "".join(random.choice("1234567890") for _ in range(length))


def normalize_phone(phone):
    return re.sub(r"[\s-]+", "", str(phone or "")).strip()


def is_valid_phone(phone):
    return bool(PHONE_PATTERN.fullmatch(normalize_phone(phone)))


def phone_cache_key(phone):
    return f"phone_code:{normalize_phone(phone)}"


def phone_throttle_cache_key(phone):
    return f"phone_code_throttle:{normalize_phone(phone)}"


def generate_phone_code(length=6):
    return "".join(random.SystemRandom().choice("0123456789") for _ in range(length))


def issue_phone_code(phone):
    normalized = normalize_phone(phone)
    if not is_valid_phone(normalized):
        raise ValueError("请输入有效的 11 位手机号")
    throttle_key = phone_throttle_cache_key(normalized)
    if not cache.add(
        throttle_key,
        True,
        timeout=settings.PHONE_CODE_THROTTLE_SECONDS,
    ):
        return None
    code = generate_phone_code()
    cache.set(
        phone_cache_key(normalized),
        code,
        timeout=settings.PHONE_CODE_TTL_SECONDS,
    )
    return code


def check_phone_code(phone, code):
    key = phone_cache_key(phone)
    expected = cache.get(key)
    if expected and str(expected) == str(code).strip():
        cache.delete(key)
        return True
    return False


def check_email_code(email, code):
    key = email_cache_key(email)
    expected = cache.get(key)
    if expected and str(expected) == str(code):
        cache.delete(key)
        return True
    return False


def send_email_code(email):
    email_address = normalize_email(email)
    if "@" not in email_address:
        return False
    code = generate_email_code()
    subject = "[乡声集盒]验证码"
    html_message = f"""<!DOCTYPE html>
<html lang="zh-Hans">
<body>
    <p><strong>亲爱的用户：</strong></p>
    <p>你的验证码为：<strong>{code}</strong>，有效时间 10 分钟。</p>
    <p>乡声集盒团队</p>
    <p>{timezone.now().date()}</p>
</body>
</html>"""
    send_mail(
        subject,
        code,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[email_address],
        html_message=html_message,
    )
    cache.set(email_cache_key(email_address), code, EMAIL_CODE_TTL_SECONDS)
    return True


@csrf_exempt
@require_POST
def email_code(request):
    body = demjson3.decode(request.body)
    if send_email_code(body["email"]):
        return JsonResponse({}, status=200)
    return JsonResponse({}, status=400)


@csrf_exempt
@require_POST
def phone_code(request):
    body = demjson3.decode(request.body)
    if not settings.PHONE_CODE_DEMO_MODE:
        return JsonResponse({"message": "短信服务尚未配置"}, status=503)
    try:
        code = issue_phone_code(body.get("phone"))
    except ValueError as error:
        return JsonResponse({"message": str(error)}, status=400)
    if code is None:
        return JsonResponse({"message": "验证码发送过于频繁，请稍后再试"}, status=429)
    payload = {
        "expires_in": settings.PHONE_CODE_TTL_SECONDS,
        "retry_after": settings.PHONE_CODE_THROTTLE_SECONDS,
        "delivery": "demo",
        "demo_code": code,
    }
    return JsonResponse(payload, status=200)
