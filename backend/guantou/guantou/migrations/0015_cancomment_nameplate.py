from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [("guantou", "0014_repair_legacy_schema_drift")]

    operations = [
        migrations.AddField(
            model_name="cancomment",
            name="nameplate",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="comments",
                to="guantou.nameplate",
                verbose_name="铭牌",
            ),
        ),
        migrations.AddIndex(
            model_name="cancomment",
            index=models.Index(
                fields=["nameplate", "created_at"],
                name="guantou_can_namepla_143344_idx",
            ),
        ),
    ]
