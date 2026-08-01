from django.conf import settings
from django.db import models
from django.utils import timezone


class Notification(models.Model):
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
    level = models.CharField(max_length=20, choices=LEVEL_CHOICES, default=LEVEL_INFO)
    verb = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)
    unread = models.BooleanField(default=True, db_index=True)
    public = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ("-timestamp",)
        indexes = [
            models.Index(fields=["recipient", "unread"]),
            models.Index(fields=["actor"]),
        ]
        verbose_name = "Notification"
        verbose_name_plural = "站内通知"

    @property
    def actor_object_id(self):
        return str(self.actor_id)

    def __str__(self):
        return self.verb
