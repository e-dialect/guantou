from django.db import migrations, models


def normalize_existing_emails(apps, schema_editor):
    User = apps.get_model("auth", "User")
    seen = set()
    for user in User.objects.exclude(email="").order_by("id").iterator():
        normalized = (user.email or "").strip().lower()
        if normalized in seen:
            raise RuntimeError(
                "Cannot enable unique email identity while duplicate emails exist"
            )
        seen.add(normalized)
        if user.email != normalized:
            User.objects.filter(pk=user.pk).update(email=normalized)


class Migration(migrations.Migration):
    dependencies = [
        ("auth", "0012_alter_user_first_name_max_length"),
        ("user", "0005_user_identity_integrity"),
    ]

    operations = [
        migrations.CreateModel(
            name="EmailVerification",
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
                ("normalized_email", models.EmailField(max_length=254)),
                (
                    "purpose",
                    models.CharField(
                        choices=[
                            ("register", "注册"),
                            ("bind", "绑定邮箱"),
                            ("reset_password", "重置密码"),
                        ],
                        max_length=32,
                    ),
                ),
                ("subject", models.CharField(blank=True, default="", max_length=150)),
                ("code_digest", models.CharField(max_length=64)),
                ("expires_at", models.DateTimeField()),
                ("attempts", models.PositiveSmallIntegerField(default=0)),
                ("delivered_at", models.DateTimeField(blank=True, null=True)),
                ("consumed_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "邮箱验证码",
                "verbose_name_plural": "邮箱验证码",
                "indexes": [
                    models.Index(fields=["expires_at"], name="email_code_expires_idx")
                ],
                "constraints": [
                    models.UniqueConstraint(
                        fields=("normalized_email", "purpose", "subject"),
                        name="unique_email_verification_scope",
                    )
                ],
            },
        ),
        migrations.RunPython(normalize_existing_emails, migrations.RunPython.noop),
        migrations.RunSQL(
            sql=(
                "CREATE UNIQUE INDEX unique_nonempty_auth_user_email_ci "
                "ON auth_user (lower(trim(email))) WHERE trim(email) <> ''"
            ),
            reverse_sql="DROP INDEX IF EXISTS unique_nonempty_auth_user_email_ci",
        ),
    ]
