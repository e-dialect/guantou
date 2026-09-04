import demjson3
from django.contrib.auth.models import User
from django.contrib.auth.validators import UnicodeUsernameValidator
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.http import JsonResponse
from django.views import View

from guantou.models import Can, Flavor, Nameplate
from inbox.models import Notification
from user.dto.user_all import user_all
from user.forms import UserInfoForm
from user.utils import get_user_by_id
from user.passwords import validate_password_policy
from user.avatar import upload_avatar
from utils.exceptions.payload import api_error_payload, field_error, request_id
from utils.exceptions.types.bad_request import BadRequestException
from utils.exceptions.types.forbidden import ForbiddenException
from utils.exceptions.types.unauthorized import WrongPassword
from user.tokens import get_request_user, generate_token
from user.models import EmailVerification
from user.verification import check_email_code, normalize_email
from user.verification import is_valid_phone, normalize_phone
from user.models import UserFollow, UserInfo

USERNAME_MAX_LENGTH = 20
USERNAME_VALIDATOR = UnicodeUsernameValidator()


def username_error(request, message, status):
    return JsonResponse(
        api_error_payload(
            message,
            status,
            data={"username": field_error(message)},
            rid=request_id(request),
        ),
        status=status,
    )


def apply_username_change(request, user, username):
    next_name = str(username or "").strip()
    if not next_name:
        return username_error(request, "请输入用户名", 400)
    if len(next_name) > USERNAME_MAX_LENGTH:
        return username_error(request, "用户名不要超过 20 个字", 400)
    try:
        USERNAME_VALIDATOR(next_name)
    except ValidationError:
        return username_error(request, "用户名只能包含字母、数字和 @/./+/-/_", 400)
    if (
        next_name != user.username
        and User.objects.exclude(pk=user.pk).filter(username__iexact=next_name).exists()
    ):
        return username_error(request, "用户名已被占用", 409)
    user.username = next_name
    return None


def contribution_payload(user, is_owner):
    public_cans = Can.objects.filter(recorder=user, visibility=True)
    payload = {
        "cans": public_cans.count(),
        "flavors": Flavor.objects.filter(created_by=user, visibility=True).count(),
        "nameplates": Nameplate.objects.filter(
            creator=user,
            status=Nameplate.Status.ACTIVE,
            can__visibility=True,
        ).count(),
        "views": sum(public_cans.values_list("views", flat=True)),
    }
    if not is_owner:
        return payload
    all_cans = Can.objects.filter(recorder=user)
    payload.update(
        {
            "cans_uploaded": all_cans.count(),
            "flavors_uploaded": Flavor.objects.filter(created_by=user).count(),
            "nameplates_uploaded": Nameplate.objects.filter(creator=user).count(),
            "views": sum(all_cans.values_list("views", flat=True)),
        }
    )
    return payload


class Manage(View):
    # US0201 获取用户信息
    def get(self, request, id):
        user = get_user_by_id(id)

        # 创建默认用户信息
        if not hasattr(user, "user_info"):
            user.userinfo = UserInfo.objects.create(user=user, nickname=user.username)
            user.save()

        request_user = get_request_user(request)
        is_owner = request_user.id == id
        profile = user_all(user, private=is_owner)
        profile.update(
            {
                "follower_count": user.follower_relationships.count(),
                "following_count": user.following_relationships.count(),
                "is_following": bool(
                    request_user.is_authenticated
                    and request_user.id != user.id
                    and UserFollow.objects.filter(
                        follower=request_user, followed=user
                    ).exists()
                ),
            }
        )
        response = {
            "user": profile,
            "contribution": contribution_payload(user, is_owner),
        }

        # 如果是本人额外返回邮件
        if is_owner:
            sent = Notification.objects.filter(actor_id=id)
            received = Notification.objects.filter(recipient_id=id)
            unread = received.filter(unread=True)
            response.update(
                {
                    "notification": {
                        "statistics": {
                            "total": sent.count() + received.count(),
                            "sent": sent.count(),
                            "received": received.count(),
                            "unread": unread.count(),
                        },
                    }
                }
            )
        return JsonResponse(response, status=200)

    # US0301 修改用户信息
    @transaction.atomic
    def put(self, request, id):
        request_user = get_request_user(request)
        if request_user.id != id:
            raise ForbiddenException
        user = get_user_by_id(id)
        body = demjson3.decode(request.body)
        info = body["user"]
        mutable_info = dict(info)
        next_username = (
            mutable_info.pop("username") if "username" in mutable_info else None
        )
        if "primary_dialect_id" in mutable_info:
            mutable_info["primary_dialect"] = mutable_info.pop("primary_dialect_id")
        elif isinstance(mutable_info.get("primary_dialect"), dict):
            mutable_info["primary_dialect"] = mutable_info["primary_dialect"].get("id")
        if "telephone" in mutable_info:
            telephone = normalize_phone(mutable_info["telephone"])
            if telephone and not is_valid_phone(telephone):
                return JsonResponse({"message": "请输入有效的 11 位手机号"}, status=400)
            if (
                telephone
                and UserInfo.objects.exclude(user_id=id)
                .filter(telephone=telephone)
                .exists()
            ):
                return JsonResponse({"message": "手机号已被其他账号使用"}, status=409)
            mutable_info["telephone"] = telephone
        if next_username is not None:
            username_response = apply_username_change(request, user, next_username)
            if username_response:
                return username_response
        form_data = {
            field: (
                user.user_info.primary_dialect_id
                if field == "primary_dialect"
                else getattr(user.user_info, field)
            )
            for field in UserInfoForm.Meta.fields
        }
        form_data.update(mutable_info)
        user_info_form = UserInfoForm(form_data, instance=user.user_info)
        if not user_info_form.is_valid():
            raise ValueError(user_info_form.errors)
        user_info_form.save()
        if user.user_info.primary_dialect_id:
            user.user_info.followed_dialects.add(user.user_info.primary_dialect_id)
        # special fields
        if "avatar" in info:
            user.user_info.avatar = upload_avatar(user.id, info["avatar"])
        user.user_info.save()
        try:
            user.save()
        except IntegrityError:
            if next_username is None:
                raise
            transaction.set_rollback(True)
            return username_error(request, "用户名已被占用", 409)

        return JsonResponse(
            {
                "user": user_all(user, private=True),
                "token": generate_token(user),
            },
            status=200,
        )


class ManagePassword(View):
    # US0302 更新用户密码
    def put(self, request, id) -> JsonResponse:
        user = get_request_user(request)
        if user.id != id:
            raise ForbiddenException
        body = demjson3.decode(request.body)
        validate_password_policy(body["newpassword"])
        if user.has_usable_password():
            if not user.check_password(body.get("oldpassword") or ""):
                raise WrongPassword()
        user.set_password(body["newpassword"])
        user.save()
        return JsonResponse(
            {
                "user": user_all(user, private=True),
                "token": generate_token(user),
            },
            status=200,
        )


class ManageEmail(View):
    # US0303 更新用户邮箱
    def put(self, request, id) -> JsonResponse:
        user = get_request_user(request)
        if user.id != id:
            raise ForbiddenException
        body = demjson3.decode(request.body)
        email = normalize_email(body["email"])
        if User.objects.exclude(pk=user.pk).filter(email__iexact=email).exists():
            return JsonResponse({"msg": "该邮箱已被绑定"}, status=409)
        try:
            with transaction.atomic():
                if not check_email_code(
                    email,
                    body["code"],
                    EmailVerification.Purpose.BIND,
                ):
                    raise BadRequestException("验证码错误")
                user.email = email
                user.save(update_fields=["email"])
        except IntegrityError:
            return JsonResponse({"msg": "该邮箱已被绑定"}, status=409)
        return JsonResponse({"user": user_all(user, private=True)}, status=200)

    # US0306 解绑邮箱
    def delete(self, request, id) -> JsonResponse:
        user = get_request_user(request)
        if user.id != id:
            raise ForbiddenException
        # 确保至少绑定了微信
        if not user.user_info.wechat:
            return JsonResponse({"msg": "未绑定微信，无法解绑邮箱"}, status=403)
        user.email = ""
        user.save()
        return JsonResponse({"user": user_all(user, private=True)}, status=200)


class ManagePoints(View):
    # US0204 获取用户积分信息
    def get(self, request, id) -> JsonResponse:
        user = get_user_by_id(id)
        points_sum = int(user_all(user, private=True)["points_sum"])
        points_now = int(user_all(user, private=True)["points_now"])
        return JsonResponse(
            {
                "points_sum": points_sum,
                "points_now": points_now,
            },
            status=200,
        )
