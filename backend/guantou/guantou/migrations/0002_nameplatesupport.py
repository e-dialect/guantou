from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("guantou", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="NameplateSupport",
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
                    "nameplate",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="supports",
                        to="guantou.nameplate",
                        verbose_name="铭牌",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="nameplate_supports",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="支持者",
                    ),
                ),
            ],
            options={
                "verbose_name": "铭牌支持",
                "verbose_name_plural": "铭牌支持",
                "ordering": ["-created_at", "-id"],
                "constraints": [
                    models.UniqueConstraint(
                        fields=("nameplate", "user"),
                        name="unique_nameplate_support_user",
                    )
                ],
            },
        ),
    ]
