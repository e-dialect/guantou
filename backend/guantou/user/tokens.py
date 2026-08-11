import datetime

import jwt
from django.conf import settings
from django.contrib.auth.models import AnonymousUser, User
from django.utils import timezone

from utils.exceptions.types.forbidden import ForbiddenException, OnlyAdminException
from utils.exceptions.types.unauthorized import (
    InvalidTokenException,
    OutdatedException,
    UnauthorizedException,
)


def get_authorization_token(request):
    authorization = request.headers.get("Authorization", "")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        return ""
    return token.strip()


def token_pass(token, user_id=0):
    if not token:
        raise UnauthorizedException()

    try:
        info = jwt.decode(token, settings.JWT_KEY, algorithms=["HS256"])
    except Exception as exc:
        raise InvalidTokenException() from exc

    if not {"id", "exp", "username"}.issubset(info):
        raise InvalidTokenException()

    try:
        user = User.objects.get(id=info["id"])
    except User.DoesNotExist as exc:
        raise InvalidTokenException() from exc

    if info["exp"] < timezone.now().timestamp():
        raise OutdatedException()
    if user.username != info["username"]:
        raise InvalidTokenException()
    if user_id == -1 and not user.is_superuser:
        raise OnlyAdminException()
    if user_id > 0 and user.id != user_id and not user.is_superuser:
        raise ForbiddenException()
    return token


def token_user(token):
    token_pass(token)
    info = jwt.decode(token, settings.JWT_KEY, algorithms=["HS256"])
    return User.objects.get(id=info["id"])


def token_check(token, required_user_id=0):
    try:
        info = jwt.decode(token, settings.JWT_KEY, algorithms=["HS256"])
        if info["exp"] < timezone.now().timestamp():
            return 0
        user = User.objects.get(id=info["id"])
        if user.username == info["username"] and (
            required_user_id == 0 or required_user_id == info["id"] or user.is_superuser
        ):
            return user
        return 0
    except Exception:
        return 0


def generate_token(user: User):
    payload = {
        "username": user.username,
        "id": user.id,
        "exp": (timezone.now() + datetime.timedelta(days=7)).timestamp(),
    }
    return jwt.encode(payload, settings.JWT_KEY, algorithm="HS256")


def get_request_user(request):
    try:
        token = get_authorization_token(request)
        info = jwt.decode(token, settings.JWT_KEY, algorithms=["HS256"])
        if info["exp"] < timezone.now().timestamp():
            request.user = AnonymousUser()
            return request.user
        user = User.objects.get(id=info["id"])
        if user.username != info["username"]:
            request.user = AnonymousUser()
            return request.user
        request.user = user
        return user
    except Exception:
        request.user = AnonymousUser()
        return request.user


def check_request_user(request, user_id, message="无权操作！"):
    user = get_request_user(request)
    if user.id != user_id and not user.is_superuser:
        raise ForbiddenException(message)
    return user
