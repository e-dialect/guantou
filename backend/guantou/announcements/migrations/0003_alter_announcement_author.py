import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("announcements", "0002_alter_announcement_description"),
    ]

    operations = [
        migrations.AlterField(
            model_name="announcement",
            name="author",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="announcements",
                to=settings.AUTH_USER_MODEL,
                verbose_name="发布者",
            ),
        )
    ]
