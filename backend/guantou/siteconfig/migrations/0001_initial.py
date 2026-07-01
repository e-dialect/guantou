from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="SiteSettings",
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
                    "announcements",
                    models.JSONField(blank=True, default=list, verbose_name="公告排序"),
                ),
                (
                    "featured_announcements",
                    models.JSONField(blank=True, default=list, verbose_name="推荐公告"),
                ),
                (
                    "carousel",
                    models.JSONField(blank=True, default=list, verbose_name="首页轮播"),
                ),
            ],
            options={
                "verbose_name": "站点运营配置",
                "verbose_name_plural": "站点运营配置",
            },
        ),
    ]
