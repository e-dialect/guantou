import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("contenttypes", "0002_remove_content_type_name"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Notification",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "level",
                    models.CharField(
                        choices=[
                            ("success", "Success"),
                            ("info", "Info"),
                            ("warning", "Warning"),
                            ("error", "Error"),
                        ],
                        default="info",
                        max_length=20,
                    ),
                ),
                ("verb", models.CharField(max_length=255)),
                ("description", models.TextField(blank=True, null=True)),
                (
                    "related_object_id",
                    models.CharField(blank=True, max_length=255, null=True),
                ),
                (
                    "timestamp",
                    models.DateTimeField(
                        db_index=True, default=django.utils.timezone.now
                    ),
                ),
                ("unread", models.BooleanField(db_index=True, default=True)),
                ("public", models.BooleanField(db_index=True, default=True)),
                (
                    "actor",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="sent_notifications",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="sender",
                    ),
                ),
                (
                    "recipient",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="received_notifications",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="recipient",
                    ),
                ),
                (
                    "related_content_type",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        to="contenttypes.contenttype",
                    ),
                ),
                (
                    "target",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="replies",
                        to="inbox.notification",
                    ),
                ),
            ],
            options={
                "verbose_name": "Notification",
                "verbose_name_plural": "站内通知",
                "ordering": ("-timestamp",),
            },
        ),
        migrations.AddIndex(
            model_name="notification",
            index=models.Index(
                fields=["recipient", "unread"], name="inbox_notif_recipie_4d3810_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="notification",
            index=models.Index(fields=["actor"], name="inbox_notif_actor_i_13f4bc_idx"),
        ),
        migrations.AddIndex(
            model_name="notification",
            index=models.Index(
                fields=["related_content_type", "related_object_id"],
                name="inbox_notif_related_6e16e2_idx",
            ),
        ),
    ]
