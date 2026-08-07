from ..models import User
from django.utils.timezone import localtime


def dialect_ref(dialect):
    if dialect is None:
        return None
    return {
        "id": dialect.id,
        "name": dialect.name,
        "code": dialect.code,
        "qualified_code": dialect.qualified_code,
        "kind": dialect.kind,
        "sort_order": dialect.sort_order,
    }


def calculate_title(points_sum) -> dict:
    if points_sum < 100:
        return {"title": "新手装罐员", "color": "gray"}
    if points_sum < 500:
        return {"title": "方言采集员", "color": "blue"}
    if points_sum < 1500:
        return {"title": "义项鉴定师", "color": "green"}
    return {"title": "罐头馆长", "color": "gold"}


def calculate_level(points_sum) -> int:
    return max(1, int(points_sum // 100) + 1)


# 返回用户除了 密码 以外的全部信息
def user_all(user: User, *, private=False) -> dict:
    # 获取用户信息
    info = user.user_info
    response = {
        "id": user.id,
        "username": user.username,
        "nickname": info.nickname,
        "avatar": info.avatar,
        "primary_dialect": dialect_ref(info.primary_dialect),
        "points_sum": info.points_sum,
        "title": calculate_title(info.points_sum),
        "level": calculate_level(info.points_sum),
    }

    if private:
        response.update(
            {
                "email": user.email,
                "telephone": info.telephone,
                "registration_time": localtime(user.date_joined).__format__(
                    "%Y-%m-%d %H:%M:%S"
                ),
                "birthday": info.birthday,
                "is_admin": user.is_superuser,
                "wechat": bool(info.wechat),
                "points_now": info.points_now,
                "login_time": (
                    localtime(user.last_login).__format__("%Y-%m-%d %H:%M:%S")
                    if user.last_login
                    else ""
                ),
            }
        )
    return response
