from django.db import migrations, models
import django.db.models.deletion

LOCATION_SUFFIXES = (
    "特别行政区",
    "自治县",
    "街道",
    "地区",
    "新区",
    "县",
    "区",
    "镇",
    "乡",
    "村",
)


def location_variants(value):
    value = (value or "").strip()
    if not value:
        return set()
    variants = {value}
    for suffix in LOCATION_SUFFIXES:
        if value.endswith(suffix) and len(value) > len(suffix):
            variants.add(value[: -len(suffix)])
    return variants


def migrate_locations(apps, schema_editor):
    UserInfo = apps.get_model("user", "UserInfo")
    Dialect = apps.get_model("guantou", "Dialect")
    dialects = list(Dialect.objects.all())

    for info in UserInfo.objects.all().iterator():
        county = (info.county or "").strip()
        town = (info.town or "").strip()
        if county or town:
            info.legacy_location = {"county": county, "town": town}

        matched = None
        for location in (town, county):
            candidates = location_variants(location)
            if not candidates:
                continue
            matches = [
                dialect
                for dialect in dialects
                if dialect.name in candidates or dialect.code in candidates
            ]
            if len(matches) == 1:
                matched = matches[0]
                break

        info.primary_dialect_id = matched.id if matched else None
        info.save(update_fields=["legacy_location", "primary_dialect"])


def restore_locations(apps, schema_editor):
    UserInfo = apps.get_model("user", "UserInfo")
    Dialect = apps.get_model("guantou", "Dialect")

    for info in UserInfo.objects.all().iterator():
        legacy = info.legacy_location or {}
        county = legacy.get("county", "")
        town = legacy.get("town", "")
        if not (county or town) and info.primary_dialect_id:
            dialect = Dialect.objects.filter(pk=info.primary_dialect_id).first()
            if dialect:
                town = dialect.name
                if dialect.parent_id:
                    parent = Dialect.objects.filter(pk=dialect.parent_id).first()
                    county = parent.name if parent else ""
        info.county = county
        info.town = town
        info.save(update_fields=["county", "town"])


class Migration(migrations.Migration):
    dependencies = [
        ("guantou", "0004_api_v1_domain_model"),
        ("user", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="userinfo",
            name="primary_dialect",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="primary_users",
                to="guantou.dialect",
                verbose_name="主要方言点",
            ),
        ),
        migrations.AddField(
            model_name="userinfo",
            name="legacy_location",
            field=models.JSONField(
                blank=True,
                default=dict,
                editable=False,
                verbose_name="迁移前行政地点",
            ),
        ),
        migrations.RunPython(migrate_locations, restore_locations),
        migrations.RemoveField(model_name="userinfo", name="county"),
        migrations.RemoveField(model_name="userinfo", name="town"),
    ]
