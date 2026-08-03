from django.contrib import admin

from .models import AnonymousVisitor, ObjectChangeLog, VisitorEvent


@admin.register(AnonymousVisitor)
class AnonymousVisitorAdmin(admin.ModelAdmin):
    list_display = ("id", "first_seen_at", "last_seen_at", "user_agent")
    search_fields = ("id", "user_agent", "ip_hash")
    readonly_fields = ("id", "first_seen_at", "last_seen_at")


@admin.register(VisitorEvent)
class VisitorEventAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "method",
        "path",
        "status_code",
        "user",
        "visitor",
        "duration_ms",
        "created_at",
    )
    list_filter = ("method", "status_code", "created_at")
    search_fields = ("path", "request_id", "visitor__id", "user__username")
    raw_id_fields = ("visitor", "user")
    readonly_fields = ("created_at",)


@admin.register(ObjectChangeLog)
class ObjectChangeLogAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "content_type",
        "object_id",
        "action",
        "actor_user",
        "actor_visitor",
        "created_at",
    )
    list_filter = ("action", "content_type", "created_at")
    search_fields = (
        "object_id",
        "object_label",
        "request_id",
        "actor_user__username",
        "actor_visitor__id",
    )
    raw_id_fields = ("content_type", "actor_user", "actor_visitor")
    readonly_fields = ("created_at",)
