from django.db import migrations, models


def preserve_legacy_titles(apps, schema_editor):
    Notification = apps.get_model("inbox", "Notification")
    for notification in Notification.objects.all().iterator():
        title = notification.verb
        notification.verb = "system.message"
        notification.metadata = {"title": title}
        notification.save(update_fields=["verb", "metadata"])


class Migration(migrations.Migration):

    dependencies = [
        ("inbox", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="notification",
            name="metadata",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.RunPython(preserve_legacy_titles, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="notification",
            name="verb",
            field=models.CharField(
                choices=[
                    ("system.message", "系统消息"),
                    ("nameplate.support", "铭牌获支持"),
                    ("can.like", "罐头获收藏"),
                    ("can.comment", "罐头有新评论"),
                    ("comment.like", "评论获支持"),
                    ("can.review", "罐头审核结果"),
                    ("can.reuse", "罐头被用同款"),
                ],
                default="system.message",
                max_length=64,
            ),
        ),
    ]
