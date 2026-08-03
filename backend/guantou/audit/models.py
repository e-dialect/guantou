import uuid

from django.contrib.auth.models import User
from django.contrib.contenttypes.models import ContentType
from django.db import models


class AnonymousVisitor(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    first_seen_at = models.DateTimeField(auto_now_add=True)
    last_seen_at = models.DateTimeField(auto_now=True)
    user_agent = models.CharField(max_length=255, blank=True)
    ip_hash = models.CharField(max_length=64, blank=True)

    def __str__(self):
        return str(self.id)

    class Meta:
        ordering = ["-last_seen_at"]


class VisitorEvent(models.Model):
    visitor = models.ForeignKey(
        AnonymousVisitor,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="events",
    )
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="visitor_events",
    )
    method = models.CharField(max_length=10)
    path = models.CharField(max_length=512)
    status_code = models.PositiveSmallIntegerField(default=0)
    request_id = models.CharField(max_length=80, blank=True)
    duration_ms = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.method} {self.path} {self.status_code}"

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["path", "created_at"]),
            models.Index(fields=["visitor", "created_at"]),
            models.Index(fields=["user", "created_at"]),
        ]


class ObjectChangeLog(models.Model):
    class Action(models.TextChoices):
        CREATE = "create", "Create"
        UPDATE = "update", "Update"
        DELETE = "delete", "Delete"

    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.CharField(max_length=64)
    object_label = models.CharField(max_length=255, blank=True)
    action = models.CharField(max_length=10, choices=Action.choices)
    changed_fields = models.JSONField(default=list, blank=True)
    before = models.JSONField(default=dict, blank=True)
    after = models.JSONField(default=dict, blank=True)
    actor_user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="object_change_logs",
    )
    actor_visitor = models.ForeignKey(
        AnonymousVisitor,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="object_change_logs",
    )
    request_id = models.CharField(max_length=80, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.content_type.app_label}.{self.content_type.model} {self.object_id} {self.action}"

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["content_type", "object_id", "created_at"]),
            models.Index(fields=["actor_user", "created_at"]),
            models.Index(fields=["actor_visitor", "created_at"]),
        ]
