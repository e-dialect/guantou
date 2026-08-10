from django.contrib.auth.models import User
from django.db.models import Count, Q
from django.http import JsonResponse
from django.views import View

from guantou.models import Dialect
from user.dto.user_all import dialect_ref
from user.models import UserFollow
from user.tokens import get_request_user
from user.utils import get_user_by_id
from utils.exceptions.types.bad_request import BadRequestException
from utils.exceptions.types.unauthorized import UnauthorizedException


def user_recommendation(user, viewer):
    return {
        "id": user.id,
        "username": user.username,
        "nickname": user.user_info.nickname or user.username,
        "avatar": user.user_info.avatar,
        "primary_dialect": dialect_ref(user.user_info.primary_dialect),
        "public_can_count": user.public_can_count,
        "is_following": UserFollow.objects.filter(
            follower=viewer, followed=user
        ).exists(),
    }


class FollowManage(View):
    def put(self, request, id):
        viewer = get_request_user(request)
        if not viewer.is_authenticated:
            raise UnauthorizedException()
        if viewer.id == id:
            raise BadRequestException("不能关注自己")
        followed = get_user_by_id(id)
        _, created = UserFollow.objects.get_or_create(
            follower=viewer, followed=followed
        )
        return JsonResponse(
            {
                "following": True,
                "created": created,
                "user_id": followed.id,
            }
        )

    def delete(self, request, id):
        viewer = get_request_user(request)
        if not viewer.is_authenticated:
            raise UnauthorizedException()
        if viewer.id == id:
            raise BadRequestException("不能取消关注自己")
        followed = get_user_by_id(id)
        deleted, _ = UserFollow.objects.filter(
            follower=viewer, followed=followed
        ).delete()
        return JsonResponse(
            {
                "following": False,
                "deleted": bool(deleted),
                "user_id": followed.id,
            }
        )


class FollowRecommendations(View):
    def get(self, request):
        viewer = get_request_user(request)
        if not viewer.is_authenticated:
            raise UnauthorizedException()
        dialect_id = request.GET.get("dialect_id")
        if not dialect_id:
            raise BadRequestException("dialect_id 不能为空")
        try:
            dialect = Dialect.objects.get(pk=int(dialect_id))
            limit = max(1, min(int(request.GET.get("limit", 6)), 20))
        except (Dialect.DoesNotExist, TypeError, ValueError) as exc:
            raise BadRequestException("方言或数量参数无效") from exc

        followed_ids = UserFollow.objects.filter(follower=viewer).values_list(
            "followed_id", flat=True
        )
        candidates = (
            User.objects.select_related("user_info__primary_dialect")
            .filter(
                user_info__primary_dialect_id__in=dialect.descendant_ids(),
                cans__visibility=True,
            )
            .exclude(id=viewer.id)
            .exclude(id__in=followed_ids)
            .annotate(
                public_can_count=Count(
                    "cans", filter=Q(cans__visibility=True), distinct=True
                )
            )
            .order_by("-public_can_count", "id")[:limit]
        )
        return JsonResponse(
            {"results": [user_recommendation(user, viewer) for user in candidates]}
        )
