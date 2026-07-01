from django.utils.timezone import localtime

from user.dto.user_all import user_all


def announcement_normal(announcement) -> dict:
    return {
        "id": announcement.id,
        "author": announcement.author.id,
        "publish_time": localtime(announcement.publish_time).strftime(
            "%Y-%m-%d %H:%M:%S"
        ),
        "update_time": localtime(announcement.update_time).strftime(
            "%Y-%m-%d %H:%M:%S"
        ),
        "title": announcement.title,
        "description": announcement.description,
        "content": announcement.content,
        "cover": announcement.cover,
        "visibility": announcement.visibility,
    }


def announcement_all(announcement) -> dict:
    payload = announcement_normal(announcement)
    payload["author"] = user_all(announcement.author)
    return payload
