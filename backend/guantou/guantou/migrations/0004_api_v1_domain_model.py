# Generated manually for the API v1 domain migration.

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models
from django.db.models import Q


def migrate_domain_data(apps, schema_editor):
    Dialect = apps.get_model("guantou", "Dialect")
    Package = apps.get_model("guantou", "Package")
    FlavorPackage = apps.get_model("guantou", "FlavorPackage")
    Pronunciation = apps.get_model("guantou", "Pronunciation")
    Can = apps.get_model("guantou", "Can")
    Nameplate = apps.get_model("guantou", "Nameplate")

    for dialect in Dialect.objects.all().iterator():
        legacy_location = {
            key: value
            for key, value in {
                "province": dialect.province,
                "city": dialect.city,
                "county": dialect.county,
                "town": dialect.town,
            }.items()
            if value
        }
        external_refs = dict(dialect.metadata or {})
        if legacy_location:
            external_refs["legacy_location"] = legacy_location
        if dialect.region_level:
            external_refs["legacy_region_level"] = dialect.region_level
        dialect.external_refs = external_refs
        dialect.save(update_fields=["external_refs"])

    uncategorized = None
    if Pronunciation.objects.filter(dialect__isnull=True).exists():
        uncategorized, _ = Dialect.objects.get_or_create(
            parent=None,
            code="待归类",
            defaults={
                "name": "待归类",
                "sort_order": 999999,
                "aliases": [],
                "external_refs": {"migration": "legacy_missing_dialect"},
            },
        )

    for pronunciation in Pronunciation.objects.select_related("flavor").iterator():
        link = (
            FlavorPackage.objects.filter(flavor_id=pronunciation.flavor_id)
            .order_by(
                models.Case(
                    models.When(mapping_type="primary", then=models.Value(0)),
                    default=models.Value(1),
                    output_field=models.IntegerField(),
                ),
                "id",
            )
            .first()
        )
        if link is None:
            package, _ = Package.objects.get_or_create(
                text=pronunciation.flavor.name,
                package_type="uncertain",
                defaults={"metadata": {"migration": "legacy_flavor_variant"}},
            )
            link = FlavorPackage.objects.create(
                flavor_id=pronunciation.flavor_id,
                package_id=package.id,
                mapping_type="primary",
                note="由旧 FlavorVariant 迁移，待人工复核",
            )
        pronunciation.package_id = link.package_id
        if pronunciation.dialect_id is None:
            pronunciation.dialect_id = uncategorized.id
        if pronunciation.reading_type == "changed_tone":
            pronunciation.reading_type = "other"
            legacy_note = "旧数据 reading_type=changed_tone，需补充本调和变调后罗马字"
            pronunciation.usage_note = (
                f"{legacy_note}；{pronunciation.usage_note}"
                if pronunciation.usage_note
                else legacy_note
            )
        elif not pronunciation.reading_type:
            pronunciation.reading_type = "general"
        legacy_source = pronunciation.source_citation
        if pronunciation.audio_url:
            audio_note = f"旧读音音频：{pronunciation.audio_url}"
            legacy_source = (
                f"{legacy_source}；{audio_note}" if legacy_source else audio_note
            )
        pronunciation.source_citation = legacy_source[:300]
        pronunciation.save(
            update_fields=[
                "package",
                "dialect",
                "reading_type",
                "usage_note",
                "source_citation",
            ]
        )

    for can in Can.objects.all().iterator():
        legacy_location = {
            key: value
            for key, value in {
                "province": can.province,
                "city": can.city,
                "county": can.county,
                "town": can.town,
            }.items()
            if value
        }
        if legacy_location:
            metadata = dict(can.metadata or {})
            metadata["legacy_location"] = legacy_location
            can.metadata = metadata
            can.save(update_fields=["metadata"])

    for nameplate in Nameplate.objects.select_related("can").iterator():
        citation = (nameplate.source_citation or "").strip()
        nameplate.source = (
            {"type": "other", "note": citation} if citation else {"type": "creator"}
        )
        if nameplate.dialect_id is None:
            nameplate.dialect_id = nameplate.can.submitted_dialect_id
        nameplate.save(update_fields=["source", "dialect"])

    for can in Can.objects.exclude(flavor_variant__isnull=True).iterator():
        pronunciation = Pronunciation.objects.get(pk=can.flavor_variant_id)
        nameplate = (
            Nameplate.objects.filter(can_id=can.id)
            .filter(Q(flavor_id=pronunciation.flavor_id) | Q(flavor__isnull=True))
            .order_by("-is_primary", "-weight", "id")
            .first()
        )
        if nameplate is None:
            nameplate = Nameplate.objects.create(
                can_id=can.id,
                creator_id=can.recorder_id,
                text_content=pronunciation.package.text,
                definition=pronunciation.flavor.definition,
                evidence_level=1,
                source={"type": "creator"},
                status="active",
            )
        nameplate.package_id = pronunciation.package_id
        nameplate.flavor_id = pronunciation.flavor_id
        nameplate.dialect_id = pronunciation.dialect_id
        nameplate.pronunciation_id = pronunciation.id
        nameplate.save(update_fields=["package", "flavor", "dialect", "pronunciation"])

    for can in Can.objects.all().iterator():
        plates = Nameplate.objects.filter(can_id=can.id, status="active")
        complete = plates.filter(
            package__isnull=False, flavor__isnull=False, dialect__isnull=False
        ).order_by("-is_primary", "-weight", "id")
        selected = complete.first()
        plates.update(is_primary=False)
        if selected:
            Nameplate.objects.filter(pk=selected.pk).update(is_primary=True)


def reverse_domain_data(apps, schema_editor):
    Dialect = apps.get_model("guantou", "Dialect")
    Can = apps.get_model("guantou", "Can")
    Nameplate = apps.get_model("guantou", "Nameplate")

    for dialect in Dialect.objects.all().iterator():
        dialect.region_level = (dialect.external_refs or {}).get(
            "legacy_region_level", "dialect"
        )
        legacy = (dialect.external_refs or {}).get("legacy_location", {})
        for field in ("province", "city", "county", "town"):
            setattr(dialect, field, legacy.get(field, ""))
        dialect.metadata = {
            key: value
            for key, value in (dialect.external_refs or {}).items()
            if key not in {"legacy_location", "legacy_region_level"}
        }
        dialect.save()

    Pronunciation = apps.get_model("guantou", "Pronunciation")
    changed_tone_note = "旧数据 reading_type=changed_tone，需补充本调和变调后罗马字"
    for pronunciation in Pronunciation.objects.filter(
        reading_type="other", usage_note__contains=changed_tone_note
    ):
        pronunciation.reading_type = "changed_tone"
        pronunciation.usage_note = pronunciation.usage_note.replace(
            f"{changed_tone_note}；", "", 1
        ).replace(changed_tone_note, "", 1)
        pronunciation.save(update_fields=["reading_type", "usage_note"])

    for pronunciation in Pronunciation.objects.filter(surface_romanization="").exclude(
        base_romanization=""
    ):
        pronunciation.surface_romanization = pronunciation.base_romanization
        pronunciation.save(update_fields=["surface_romanization"])

    for can in Can.objects.all().iterator():
        legacy = (can.metadata or {}).get("legacy_location", {})
        for field in ("province", "city", "county", "town"):
            setattr(can, field, legacy.get(field, ""))
        primary = (
            Nameplate.objects.filter(can_id=can.id, pronunciation__isnull=False)
            .order_by("-is_primary", "id")
            .first()
        )
        can.flavor_variant_id = primary.pronunciation_id if primary else None
        can.save()

    for nameplate in Nameplate.objects.all().iterator():
        source = nameplate.source or {}
        nameplate.source_citation = source.get("note", "")[:300]
        nameplate.save(update_fields=["source_citation"])


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("guantou", "0003_can_transition_log"),
    ]

    operations = [
        migrations.AddField(
            model_name="dialect",
            name="aliases",
            field=models.JSONField(blank=True, default=list, verbose_name="历史限定码"),
        ),
        migrations.AddField(
            model_name="dialect",
            name="external_refs",
            field=models.JSONField(blank=True, default=dict, verbose_name="外部引用"),
        ),
        migrations.AddField(
            model_name="dialect",
            name="sort_order",
            field=models.IntegerField(default=0, verbose_name="同级排序"),
        ),
        migrations.AlterField(
            model_name="dialect",
            name="code",
            field=models.CharField(max_length=32, verbose_name="同级短码"),
        ),
        migrations.AddField(
            model_name="flavor",
            name="concepticon_id",
            field=models.CharField(
                blank=True,
                max_length=80,
                null=True,
                verbose_name="Concepticon 编号",
            ),
        ),
        migrations.RenameModel(
            old_name="FlavorVariant",
            new_name="Pronunciation",
        ),
        migrations.RenameField(
            model_name="pronunciation",
            old_name="romanization",
            new_name="surface_romanization",
        ),
        migrations.AddField(
            model_name="pronunciation",
            name="base_romanization",
            field=models.CharField(
                blank=True, max_length=120, verbose_name="变调前罗马字"
            ),
        ),
        migrations.AlterField(
            model_name="pronunciation",
            name="surface_romanization",
            field=models.CharField(
                blank=True, max_length=120, verbose_name="变调后罗马字"
            ),
        ),
        migrations.AlterField(
            model_name="pronunciation",
            name="tone_value",
            field=models.CharField(blank=True, max_length=40, verbose_name="实际调值"),
        ),
        migrations.AddField(
            model_name="pronunciation",
            name="package",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="pronunciations",
                to="guantou.package",
                verbose_name="写法",
            ),
        ),
        migrations.AddField(
            model_name="pronunciation",
            name="source_citation",
            field=models.CharField(blank=True, max_length=300, verbose_name="来源说明"),
        ),
        migrations.AddField(
            model_name="pronunciation",
            name="usage_note",
            field=models.TextField(blank=True, verbose_name="用法说明"),
        ),
        migrations.AlterField(
            model_name="pronunciation",
            name="ipa",
            field=models.CharField(max_length=120, verbose_name="IPA"),
        ),
        migrations.AlterField(
            model_name="pronunciation",
            name="reading_type",
            field=models.CharField(
                choices=[
                    ("general", "通用"),
                    ("literary", "文读"),
                    ("colloquial", "白读"),
                    ("other", "其他"),
                ],
                default="general",
                max_length=20,
                verbose_name="读音类型",
            ),
        ),
        migrations.AlterField(
            model_name="pronunciation",
            name="flavor",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name="pronunciations",
                to="guantou.flavor",
                verbose_name="义项",
            ),
        ),
        migrations.AlterField(
            model_name="pronunciation",
            name="created_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="created_pronunciations",
                to=settings.AUTH_USER_MODEL,
                verbose_name="创建者",
            ),
        ),
        migrations.RenameField(
            model_name="can",
            old_name="dialect",
            new_name="submitted_dialect",
        ),
        migrations.AlterField(
            model_name="can",
            name="submitted_dialect",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="submitted_cans",
                to="guantou.dialect",
                verbose_name="装罐时方言提示",
            ),
        ),
        migrations.AddField(
            model_name="nameplate",
            name="dialect",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="nameplates",
                to="guantou.dialect",
                verbose_name="方言点主张",
            ),
        ),
        migrations.AddField(
            model_name="nameplate",
            name="pronunciation",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="attestations",
                to="guantou.pronunciation",
                verbose_name="规范读音主张",
            ),
        ),
        migrations.AddField(
            model_name="nameplate",
            name="pronunciation_text",
            field=models.CharField(
                blank=True, max_length=160, verbose_name="来源原样读音"
            ),
        ),
        migrations.AddField(
            model_name="nameplate",
            name="source",
            field=models.JSONField(default=dict, verbose_name="结构化来源"),
        ),
        migrations.AddField(
            model_name="nameplate",
            name="status",
            field=models.CharField(
                choices=[
                    ("active", "有效"),
                    ("withdrawn", "已撤回"),
                    ("superseded", "已修订"),
                ],
                default="active",
                max_length=20,
                verbose_name="状态",
            ),
        ),
        migrations.AddField(
            model_name="nameplate",
            name="supersedes",
            field=models.OneToOneField(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="superseded_by",
                to="guantou.nameplate",
                verbose_name="修订自",
            ),
        ),
        migrations.AlterField(
            model_name="nameplate",
            name="text_content",
            field=models.CharField(
                blank=True, max_length=160, verbose_name="来源原样写法"
            ),
        ),
        migrations.RunPython(migrate_domain_data, reverse_domain_data),
        migrations.RemoveField(model_name="can", name="flavor_variant"),
        migrations.RemoveField(model_name="can", name="province"),
        migrations.RemoveField(model_name="can", name="city"),
        migrations.RemoveField(model_name="can", name="county"),
        migrations.RemoveField(model_name="can", name="town"),
        migrations.RemoveField(model_name="dialect", name="region_level"),
        migrations.RemoveField(model_name="dialect", name="province"),
        migrations.RemoveField(model_name="dialect", name="city"),
        migrations.RemoveField(model_name="dialect", name="county"),
        migrations.RemoveField(model_name="dialect", name="town"),
        migrations.RemoveField(model_name="dialect", name="metadata"),
        migrations.RemoveField(model_name="pronunciation", name="audio_url"),
        migrations.RemoveField(model_name="pronunciation", name="audio_source"),
        migrations.RemoveField(model_name="nameplate", name="source_citation"),
        migrations.AlterField(
            model_name="pronunciation",
            name="package",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name="pronunciations",
                to="guantou.package",
                verbose_name="写法",
            ),
        ),
        migrations.AlterField(
            model_name="pronunciation",
            name="dialect",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name="pronunciations",
                to="guantou.dialect",
                verbose_name="方言点",
            ),
        ),
        migrations.AlterModelOptions(
            name="dialect",
            options={
                "ordering": ["sort_order", "id"],
                "verbose_name": "方言点",
                "verbose_name_plural": "方言点",
            },
        ),
        migrations.AlterModelOptions(
            name="pronunciation",
            options={
                "ordering": ["flavor_id", "dialect_id", "-is_canonical", "id"],
                "verbose_name": "读音",
                "verbose_name_plural": "读音",
            },
        ),
        migrations.AddConstraint(
            model_name="dialect",
            constraint=models.UniqueConstraint(
                fields=("parent", "code"), name="unique_dialect_sibling_code"
            ),
        ),
        migrations.AddConstraint(
            model_name="dialect",
            constraint=models.UniqueConstraint(
                condition=Q(parent__isnull=True),
                fields=("code",),
                name="unique_root_dialect_code",
            ),
        ),
        migrations.AddConstraint(
            model_name="pronunciation",
            constraint=models.UniqueConstraint(
                condition=Q(is_canonical=True),
                fields=("package", "flavor", "dialect", "reading_type"),
                name="unique_canonical_pronunciation",
            ),
        ),
        migrations.AddConstraint(
            model_name="nameplate",
            constraint=models.CheckConstraint(
                condition=(
                    Q(package__isnull=False)
                    | Q(flavor__isnull=False)
                    | Q(dialect__isnull=False)
                    | Q(pronunciation__isnull=False)
                    | ~Q(text_content="")
                    | ~Q(pronunciation_text="")
                ),
                name="nameplate_has_claim",
            ),
        ),
        migrations.AddConstraint(
            model_name="nameplate",
            constraint=models.CheckConstraint(
                condition=(
                    Q(is_primary=False)
                    | (
                        Q(status="active")
                        & Q(package__isnull=False)
                        & Q(flavor__isnull=False)
                        & Q(dialect__isnull=False)
                    )
                ),
                name="primary_nameplate_is_active_complete",
            ),
        ),
        migrations.AddConstraint(
            model_name="nameplate",
            constraint=models.UniqueConstraint(
                condition=Q(is_primary=True),
                fields=("can",),
                name="unique_primary_nameplate_per_can",
            ),
        ),
    ]
