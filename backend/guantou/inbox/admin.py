from notifications.admin import NotificationAdmin
from notifications.models import Notification


Notification._meta.verbose_name_plural = "站内通知"
NotificationAdmin.search_fields = ["recipient__username", "actor__username"]
NotificationAdmin.list_display = (
    "id",
    "recipient",
    "actor",
    "level",
    "verb",
    "timestamp",
    "unread",
    "public",
)
NotificationAdmin.date_hierarchy = "timestamp"
