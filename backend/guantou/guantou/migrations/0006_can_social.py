from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("guantou", "0005_flavorpackage_created_at_package_updated_at_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="CanLike",
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
                    "created_at",
                    models.DateTimeField(auto_now_add=True, verbose_name="创建时间"),
                ),
                (
                    "can",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="likes",
                        to="guantou.can",
                        verbose_name="罐头",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="can_likes",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="用户",
                    ),
                ),
            ],
            options={
                "verbose_name": "罐头点赞",
                "verbose_name_plural": "罐头点赞",
                "ordering": ["-created_at", "-id"],
                "constraints": [
                    models.UniqueConstraint(
                        fields=("can", "user"), name="unique_can_like_user"
                    )
                ],
            },
        ),
        migrations.CreateModel(
            name="CanComment",
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
                ("content", models.CharField(max_length=500, verbose_name="内容")),
                (
                    "created_at",
                    models.DateTimeField(auto_now_add=True, verbose_name="创建时间"),
                ),
                (
                    "author",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="can_comments",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="作者",
                    ),
                ),
                (
                    "can",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="comments",
                        to="guantou.can",
                        verbose_name="罐头",
                    ),
                ),
            ],
            options={
                "verbose_name": "罐头评论",
                "verbose_name_plural": "罐头评论",
                "ordering": ["created_at", "id"],
            },
        ),
    ]
