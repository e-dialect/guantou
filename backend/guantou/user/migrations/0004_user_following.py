from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def subscribe_primary_dialects(apps, schema_editor):
    UserInfo = apps.get_model("user", "UserInfo")
    for info in UserInfo.objects.exclude(primary_dialect_id=None).iterator():
        info.followed_dialects.add(info.primary_dialect_id)


class Migration(migrations.Migration):

    dependencies = [
        ("guantou", "0004_api_v1_domain_model"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("user", "0003_userinfo_created_at_userinfo_updated_at"),
    ]

    operations = [
        migrations.AddField(
            model_name="userinfo",
            name="followed_dialects",
            field=models.ManyToManyField(
                blank=True,
                related_name="subscribers",
                to="guantou.dialect",
                verbose_name="关注的方言点",
            ),
        ),
        migrations.CreateModel(
            name="UserFollow",
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
                    "followed",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="follower_relationships",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="被关注者",
                    ),
                ),
                (
                    "follower",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="following_relationships",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="关注者",
                    ),
                ),
            ],
            options={
                "verbose_name": "用户关注",
                "verbose_name_plural": "用户关注",
                "ordering": ["-created_at", "-id"],
                "constraints": [
                    models.UniqueConstraint(
                        fields=("follower", "followed"), name="unique_user_follow"
                    ),
                    models.CheckConstraint(
                        condition=~models.Q(("follower", models.F("followed"))),
                        name="prevent_self_follow",
                    ),
                ],
            },
        ),
        migrations.RunPython(subscribe_primary_dialects, migrations.RunPython.noop),
    ]
