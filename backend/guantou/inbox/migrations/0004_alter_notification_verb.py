from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("inbox", "0003_alter_notification_actor")]

    operations = [
        migrations.AlterField(
            model_name="notification",
            name="verb",
            field=models.CharField(
                choices=[
                    ("system.message", "系统消息"),
                    ("entry.bookmark", "词条获收藏"),
                    ("entry.usage_attestation", "词条获地区补证"),
                    ("recording.entry_link", "录音获词条关联"),
                    ("curation.review", "整理审核结果"),
                ],
                default="system.message",
                max_length=64,
            ),
        )
    ]
