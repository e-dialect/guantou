import demjson3
from django.db import transaction
from django.http import JsonResponse
from django.views import View

from guantou.models import Can, Flavor, Nameplate
from inbox.models import Notification
from user.dto.user_all import user_all
from user.forms import UserInfoForm
from user.utils import get_user_by_id
from user.passwords import validate_password_policy
from user.avatar import upload_avatar
from utils.exceptions.types.bad_request import BadRequestException
from utils.exceptions.types.forbidden import ForbiddenException
from utils.exceptions.types.unauthorized import WrongPassword
from user.tokens import get_request_user, generate_token
from user.verification import check_email_code
from user.models import UserFollow, UserInfo


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
            "contribution": {
                "cans": Can.objects.filter(recorder=user, visibility=True).count(),
                "cans_uploaded": Can.objects.filter(recorder=user).count(),
                "flavors": Flavor.objects.filter(
                    created_by=user, visibility=True
                ).count(),
                "flavors_uploaded": Flavor.objects.filter(created_by=user).count(),
                "nameplates": Nameplate.objects.filter(creator=user).count(),
                "views": sum(
                    Can.objects.filter(recorder=user).values_list("views", flat=True)
                ),
            },
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
        if "primary_dialect_id" in mutable_info:
            mutable_info["primary_dialect"] = mutable_info.pop("primary_dialect_id")
        elif isinstance(mutable_info.get("primary_dialect"), dict):
            mutable_info["primary_dialect"] = mutable_info["primary_dialect"].get("id")
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
        user.save()

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
        if not user.check_password(body["oldpassword"]):
            raise WrongPassword()
        validate_password_policy(body["newpassword"])
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
        if not check_email_code(body["email"], body["code"]):
            raise BadRequestException("验证码错误")
        user.email = body["email"]
        user.save()
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
