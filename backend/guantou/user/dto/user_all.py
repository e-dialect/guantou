from ..models import User
from django.conf import settings
from django.utils.timezone import localtime


def dialect_ref(dialect):
    if dialect is None:
        return None
    return {
        "id": dialect.id,
        "name": dialect.name,
        "code": dialect.code,
        "qualified_code": dialect.qualified_code,
        "sort_order": dialect.sort_order,
    }


# 返回用户除了 密码 以外的全部信息
def user_all(user: User, *, private=False) -> dict:
    if user is None:
        return {
            "id": None,
            "username": "deleted-user",
            "nickname": "已注销用户",
            "avatar": settings.DEFAULT_AVATAR_URL,
            "primary_dialect": None,
        }
    # 获取用户信息
    info = user.user_info
    response = {
        "id": user.id,
        "username": user.username,
        "nickname": info.nickname,
        "avatar": info.avatar or settings.DEFAULT_AVATAR_URL,
        "primary_dialect": dialect_ref(info.primary_dialect),
    }

    if private:
        response.update(
            {
                "email": user.email,
                "telephone": info.telephone,
                "registration_time": localtime(user.date_joined).__format__(
                    "%Y-%m-%d %H:%M:%S"
                ),
                "birthday": info.birthday.isoformat() if info.birthday else None,
                "is_admin": user.is_superuser,
                "is_staff": user.is_staff,
                "wechat": bool(info.wechat),
                "has_password": user.has_usable_password(),
                "followed_dialects": [
                    dialect_ref(dialect) for dialect in info.followed_dialects.all()
                ],
                "login_time": (
                    localtime(user.last_login).__format__("%Y-%m-%d %H:%M:%S")
                    if user.last_login
                    else ""
                ),
            }
        )
    return response
