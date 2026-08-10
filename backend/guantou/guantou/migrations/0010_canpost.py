import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("guantou", "0009_circlemembership_dialectcircle_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="CanPost",
            fields=[
                (
                    "id",
                    models.AutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "text",
                    models.CharField(blank=True, max_length=500, verbose_name="配文"),
                ),
                (
                    "visibility",
                    models.CharField(
                        choices=[("public", "公开"), ("private", "仅自己")],
                        default="public",
                        max_length=16,
                        verbose_name="可见范围",
                    ),
                ),
                (
                    "source_snapshot",
                    models.JSONField(
                        blank=True, default=dict, verbose_name="罐头来源快照"
                    ),
                ),
                (
                    "created_at",
                    models.DateTimeField(auto_now_add=True, verbose_name="创建时间"),
                ),
                (
                    "updated_at",
                    models.DateTimeField(auto_now=True, verbose_name="更新时间"),
                ),
                (
                    "author",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="can_posts",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="作者",
                    ),
                ),
                (
                    "can",
                    models.ForeignKey(
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="posts",
                        to="guantou.can",
                        verbose_name="引用罐头",
                    ),
                ),
            ],
            options={
                "verbose_name": "罐头表达",
                "verbose_name_plural": "罐头表达",
                "ordering": ["-created_at", "-id"],
                "indexes": [
                    models.Index(
                        fields=["can", "visibility", "created_at"],
                        name="guantou_can_can_id_e0c34a_idx",
                    ),
                    models.Index(
                        fields=["author", "created_at"],
                        name="guantou_can_author__839a95_idx",
                    ),
                ],
            },
        )
    ]
