import logging

import demjson3
from django.conf import settings
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.db import transaction
from django.http import JsonResponse
from django.views import View

from user.models import EmailVerification
from user.passwords import validate_password_policy
from user.verification import (
    EmailCodeThrottled,
    check_email_code,
    issue_email_code,
    normalize_email,
)
from utils.exceptions.types.not_found import NotBoundEmail

logger = logging.getLogger("log")


def mask_email(email):
    local, domain = normalize_email(email).split("@", 1)
    visible = local[:1]
    return f"{visible}{'*' * max(2, len(local) - 1)}@{domain}"


def user_for_reset(username):
    user = User.objects.filter(username=str(username or "").strip()).first()
    if user is None:
        return None
    if not user.email:
        nickname = (
            getattr(getattr(user, "user_info", None), "nickname", "") or user.username
        )
        raise NotBoundEmail(nickname)
    return user


class Forget(View):
    def get(self, request):
        user = user_for_reset(request.GET.get("username"))
        if user is None:
            return JsonResponse({"msg": "找不到这个用户名"}, status=404)
        return JsonResponse({"email_masked": mask_email(user.email)}, status=200)

    def post(self, request):
        body = demjson3.decode(request.body)
        user = user_for_reset(body.get("username"))
        if user is None:
            # Do not reveal whether an arbitrary username exists on this write path.
            return JsonResponse({"email_masked": "***"}, status=200)
        try:
            code = issue_email_code(
                user.email,
                EmailVerification.Purpose.RESET_PASSWORD,
                subject=user.username,
            )
        except EmailCodeThrottled:
            return JsonResponse({"msg": "验证码发送过于频繁"}, status=429)
        except (ValidationError, ValueError):
            return JsonResponse({"msg": "账号邮箱无效"}, status=400)
        except Exception:
            logger.exception("Failed to send password reset email")
            return JsonResponse({"msg": "验证码发送失败，请稍后重试"}, status=502)
        payload = {
            "email_masked": mask_email(user.email),
            "retry_after": settings.EMAIL_CODE_THROTTLE_SECONDS,
        }
        if getattr(settings, "EMAIL_CODE_DEMO_MODE", False):
            payload["delivery"] = "demo"
            payload["demo_code"] = code
        return JsonResponse(payload, status=200)

    def put(self, request):
        body = demjson3.decode(request.body)
        user = user_for_reset(body.get("username"))
        if user is None:
            return JsonResponse({"msg": "验证码错误"}, status=400)
        validate_password_policy(body.get("password"))
        with transaction.atomic():
            if not check_email_code(
                user.email,
                body.get("code"),
                EmailVerification.Purpose.RESET_PASSWORD,
                subject=user.username,
            ):
                return JsonResponse({"msg": "验证码错误"}, status=400)
            user.set_password(body["password"])
            user.save(update_fields=["password"])
        return JsonResponse({}, status=200)
