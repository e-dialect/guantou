from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models
from django.utils import timezone


class Notification(models.Model):
    class Verb(models.TextChoices):
        SYSTEM = "system.message", "系统消息"
        NAMEPLATE_SUPPORT = "nameplate.support", "铭牌获支持"
        CAN_LIKE = "can.like", "罐头获收藏"
        CAN_COMMENT = "can.comment", "罐头有新评论"
        COMMENT_LIKE = "comment.like", "评论获支持"
        CAN_REVIEW = "can.review", "罐头审核结果"
        CAN_REUSE = "can.reuse", "罐头被用同款"

    LEVEL_SUCCESS = "success"
    LEVEL_INFO = "info"
    LEVEL_WARNING = "warning"
    LEVEL_ERROR = "error"
    LEVEL_CHOICES = (
        (LEVEL_SUCCESS, "Success"),
        (LEVEL_INFO, "Info"),
        (LEVEL_WARNING, "Warning"),
        (LEVEL_ERROR, "Error"),
    )

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="sent_notifications",
        verbose_name="sender",
    )
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="received_notifications",
        verbose_name="recipient",
    )
    target = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        related_name="replies",
        blank=True,
        null=True,
    )
    related_content_type = models.ForeignKey(
        ContentType,
        on_delete=models.CASCADE,
        blank=True,
        null=True,
    )
    related_object_id = models.CharField(max_length=255, blank=True, null=True)
    related_object = GenericForeignKey("related_content_type", "related_object_id")
    level = models.CharField(max_length=20, choices=LEVEL_CHOICES, default=LEVEL_INFO)
    verb = models.CharField(
        max_length=64,
        choices=Verb.choices,
        default=Verb.SYSTEM,
    )
    description = models.TextField(blank=True, null=True)
    metadata = models.JSONField(default=dict, blank=True)
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)
    unread = models.BooleanField(default=True, db_index=True)
    public = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ("-timestamp",)
        indexes = [
            models.Index(fields=["recipient", "unread"]),
            models.Index(fields=["actor"]),
            models.Index(fields=["related_content_type", "related_object_id"]),
        ]
        verbose_name = "Notification"
        verbose_name_plural = "站内通知"

    @property
    def actor_object_id(self):
        return str(self.actor_id)

    def __str__(self):
        return self.verb

    @property
    def display_title(self):
        labels = dict(self.Verb.choices)
        return labels.get(self.verb, self.verb)
