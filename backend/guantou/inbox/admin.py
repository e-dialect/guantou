from django.contrib import admin

from .models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    search_fields = ["recipient__username", "actor__username"]
    list_display = (
        "id",
        "recipient",
        "actor",
        "level",
        "verb",
        "timestamp",
        "unread",
        "public",
    )
    date_hierarchy = "timestamp"
