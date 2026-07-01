import random

import demjson3
from django.conf import settings
from django.core.cache import cache
from django.core.mail import send_mail
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST


EMAIL_CODE_TTL_SECONDS = 600


def normalize_email(email):
    return str(email).replace(" ", "").strip().lower()


def email_cache_key(email):
    return f"email_code:{normalize_email(email)}"


def generate_email_code(length=6):
    return "".join(random.choice("1234567890") for _ in range(length))


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
    subject = "[方言罐头]验证码"
    html_message = f"""<!DOCTYPE html>
<html lang="zh-Hans">
<body>
    <p><strong>亲爱的用户：</strong></p>
    <p>你的验证码为：<strong>{code}</strong>，有效时间 10 分钟。</p>
    <p>方言罐头团队</p>
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
