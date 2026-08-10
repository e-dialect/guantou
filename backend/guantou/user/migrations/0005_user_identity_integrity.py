from django.db import migrations, models

LEGACY_BIRTHDAY = "1970-01-01"
LEGACY_AVATAR = "https://cos.edialect.top/website/默认头像.jpg"


def normalize_identity_fields(apps, schema_editor):
    UserInfo = apps.get_model("user", "UserInfo")
    UserInfo.objects.filter(birthday=LEGACY_BIRTHDAY).update(birthday=None)
    UserInfo.objects.filter(avatar=LEGACY_AVATAR).update(avatar="")

    for field in ("wechat", "qq", "telephone"):
        seen = set()
        for info in UserInfo.objects.exclude(**{field: ""}).order_by("user_id"):
            value = getattr(info, field).strip()
            if not value or value in seen:
                setattr(info, field, "")
                info.save(update_fields=[field])
                continue
            if value != getattr(info, field):
                setattr(info, field, value)
                info.save(update_fields=[field])
            seen.add(value)


class Migration(migrations.Migration):

    dependencies = [
        ("user", "0004_user_following"),
    ]

    operations = [
        migrations.AlterField(
            model_name="userinfo",
            name="birthday",
            field=models.DateField(
                blank=True,
                default=None,
                null=True,
                verbose_name="生日",
            ),
        ),
        migrations.AlterField(
            model_name="userinfo",
            name="avatar",
            field=models.URLField(blank=True, default="", verbose_name="头像"),
        ),
        migrations.RunPython(normalize_identity_fields, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name="userinfo",
            constraint=models.UniqueConstraint(
                condition=~models.Q(wechat=""),
                fields=("wechat",),
                name="unique_nonempty_user_wechat",
            ),
        ),
        migrations.AddConstraint(
            model_name="userinfo",
            constraint=models.UniqueConstraint(
                condition=~models.Q(qq=""),
                fields=("qq",),
                name="unique_nonempty_user_qq",
            ),
        ),
        migrations.AddConstraint(
            model_name="userinfo",
            constraint=models.UniqueConstraint(
                condition=~models.Q(telephone=""),
                fields=("telephone",),
                name="unique_nonempty_user_telephone",
            ),
        ),
    ]
