from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("guantou", "0012_seed_puxian_dialects")]

    operations = [
        migrations.AddField(
            model_name="flavor",
            name="metadata",
            field=models.JSONField(blank=True, default=dict, verbose_name="扩展信息"),
        ),
        migrations.CreateModel(
            name="LegacyImportRecord",
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
                ("source_system", models.CharField(max_length=80)),
                ("source_table", models.CharField(max_length=80)),
                ("source_id", models.CharField(max_length=120)),
                ("target_model", models.CharField(max_length=120)),
                ("target_id", models.PositiveBigIntegerField()),
                ("fingerprint", models.CharField(blank=True, max_length=64)),
                ("action", models.CharField(default="created", max_length=32)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("imported_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "旧数据导入记录",
                "verbose_name_plural": "旧数据导入记录",
                "ordering": ["source_system", "source_table", "source_id"],
                "indexes": [
                    models.Index(
                        fields=["target_model", "target_id"],
                        name="legacy_target_idx",
                    )
                ],
                "constraints": [
                    models.UniqueConstraint(
                        fields=("source_system", "source_table", "source_id"),
                        name="unique_legacy_import_source",
                    )
                ],
            },
        ),
    ]
