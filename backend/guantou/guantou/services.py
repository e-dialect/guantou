from django.db import transaction
from django.db.models import Case, IntegerField, Q, Value, When
from rest_framework import serializers
from utils.exceptions.types.conflict import ConflictException

from .models import Can, Flavor, FlavorPackage, Nameplate, Package, Pronunciation

DEFAULT_SEARCH_LIMIT = 8
MAX_SEARCH_LIMIT = 20
SUGGEST_DEFAULT_LIMIT = 5
SUGGEST_MAX_LIMIT = 10
SUGGEST_KEYWORD_MAX_LENGTH = 50


def clean_text(value):
    return str(value or "").strip()


def result_limit(value, default=DEFAULT_SEARCH_LIMIT, maximum=MAX_SEARCH_LIMIT):
    try:
        return min(max(int(value), 1), maximum)
    except (TypeError, ValueError):
        return default


def visible_cans_for_user(user):
    queryset = Can.objects.select_related(
        "recorder", "submitted_dialect", "verifier"
    ).prefetch_related("nameplates")
    if user and user.is_authenticated and user.is_staff:
        return queryset
    if user and user.is_authenticated:
        return queryset.filter(Q(visibility=True) | Q(recorder=user))
    return queryset.filter(visibility=True)


def search_flavors(keyword, limit):
    return (
        Flavor.objects.prefetch_related("packages", "pronunciations")
        .filter(
            Q(name__icontains=keyword)
            | Q(definition__icontains=keyword)
            | Q(mandarin__icontains=keyword)
            | Q(packages__text__icontains=keyword)
        )
        .distinct()[:limit]
    )


def search_packages(keyword, limit):
    return (
        Package.objects.prefetch_related("flavors")
        .filter(text__icontains=keyword)
        .distinct()[:limit]
    )


def search_cans(keyword, user, limit):
    return (
        visible_cans_for_user(user)
        .filter(
            Q(concept_text__icontains=keyword)
            | Q(nameplates__text_content__icontains=keyword)
            | Q(nameplates__definition__icontains=keyword)
        )
        .distinct()[:limit]
    )


def aggregate_search(keyword, user=None, limit=DEFAULT_SEARCH_LIMIT):
    clean_keyword = clean_text(keyword)
    if not clean_keyword:
        return {
            "keyword": "",
            "flavors": [],
            "packages": [],
            "cans": [],
        }

    normalized_limit = result_limit(limit)
    return {
        "keyword": clean_keyword,
        "flavors": search_flavors(clean_keyword, normalized_limit),
        "packages": search_packages(clean_keyword, normalized_limit),
        "cans": search_cans(clean_keyword, user, normalized_limit),
    }


def _prefix_rank(prefix_condition):
    # 前缀匹配排 0，包含匹配排 1，保证前缀命中优先展示
    return Case(
        When(prefix_condition, then=Value(0)),
        default=Value(1),
        output_field=IntegerField(),
    )


def suggest_flavors(keyword, limit):
    return (
        Flavor.objects.filter(
            Q(name__icontains=keyword)
            | Q(definition__icontains=keyword)
            | Q(mandarin__icontains=keyword)
        )
        .annotate(suggest_rank=_prefix_rank(Q(name__istartswith=keyword)))
        .order_by("suggest_rank", "id")[:limit]
    )


def suggest_packages(keyword, limit):
    return (
        Package.objects.filter(text__icontains=keyword)
        .annotate(suggest_rank=_prefix_rank(Q(text__istartswith=keyword)))
        .order_by("suggest_rank", "id")[:limit]
    )


def suggest_nameplates(keyword, user, limit):
    return (
        Nameplate.objects.filter(can__in=visible_cans_for_user(user))
        .filter(Q(text_content__icontains=keyword) | Q(definition__icontains=keyword))
        .annotate(suggest_rank=_prefix_rank(Q(text_content__istartswith=keyword)))
        .order_by("suggest_rank", "id")[:limit]
    )


def _flavor_suggestion(flavor):
    mandarin = flavor.mandarin or []
    sub = f"义项 · 普通话: {mandarin[0]}" if mandarin else "义项"
    return {"type": "flavor", "id": flavor.id, "text": flavor.name, "sub": sub}


def _package_suggestion(package):
    return {"type": "package", "id": package.id, "text": package.text, "sub": "写法"}


def _nameplate_suggestion(nameplate):
    return {
        "type": "nameplate",
        "id": nameplate.id,
        "text": nameplate.text_content,
        "sub": f"铭牌 · 罐头 #{nameplate.can_id}",
    }


def suggest_search(keyword, user=None, limit=SUGGEST_DEFAULT_LIMIT):
    clean_keyword = clean_text(keyword)[:SUGGEST_KEYWORD_MAX_LENGTH]
    if not clean_keyword:
        return {"keyword": "", "suggestions": []}

    normalized_limit = result_limit(
        limit, default=SUGGEST_DEFAULT_LIMIT, maximum=SUGGEST_MAX_LIMIT
    )
    suggestions = []
    seen_texts = set()

    def append(items, build):
        for item in items:
            payload = build(item)
            # 同一文本按 flavor > package > nameplate 优先级去重
            if payload["text"] in seen_texts:
                continue
            seen_texts.add(payload["text"])
            suggestions.append(payload)

    append(suggest_flavors(clean_keyword, normalized_limit), _flavor_suggestion)
    append(suggest_packages(clean_keyword, normalized_limit), _package_suggestion)
    append(
        suggest_nameplates(clean_keyword, user, normalized_limit),
        _nameplate_suggestion,
    )
    return {"keyword": clean_keyword, "suggestions": suggestions}


@transaction.atomic
def elect_primary_nameplate(can):
    candidates = (
        Nameplate.objects.select_for_update()
        .filter(
            can=can,
            status=Nameplate.Status.ACTIVE,
            package__isnull=False,
            flavor__isnull=False,
            dialect__isnull=False,
        )
        .order_by("-weight", "id")
    )
    strongest = candidates.first()
    Nameplate.objects.filter(can=can, is_primary=True).exclude(
        pk=getattr(strongest, "pk", None)
    ).update(is_primary=False)
    if strongest and not strongest.is_primary:
        strongest.is_primary = True
        strongest.save(update_fields=["is_primary", "updated_at"])
    return strongest


def get_or_create_package(label):
    text = clean_text(label.get("text_content"))
    if not text:
        return None
    package_type = label.get("package_type") or Package.PackageType.UNCERTAIN
    package, _ = Package.objects.get_or_create(
        text=text,
        package_type=package_type,
        defaults={"metadata": {}},
    )
    return package


def get_or_create_submission_flavor(can, label, user, package):
    flavor_id = label.get("flavor_id")
    if flavor_id:
        flavor = Flavor.objects.filter(id=flavor_id).first()
        if flavor is None:
            raise serializers.ValidationError(
                {"initial_nameplate": {"flavor_id": ["义项不存在"]}}
            )
        return flavor

    if not package:
        return None

    definition = clean_text(label.get("definition")) or can.concept_text or package.text
    flavor = Flavor.objects.create(
        name=definition,
        definition=definition,
        mandarin=[can.concept_text] if can.concept_text else [],
        created_by=user if user and user.is_authenticated else None,
    )
    FlavorPackage.objects.get_or_create(flavor=flavor, package=package)
    return flavor


def create_initial_nameplate(can, label, user):
    text_content = clean_text(label.get("text_content"))
    pronunciation_text = clean_text(label.get("pronunciation_text"))
    source = label.get("source")
    if (
        not isinstance(source, dict)
        or source.get("type") not in Nameplate.SourceType.values
    ):
        raise serializers.ValidationError(
            {"initial_nameplate": {"source": ["必须提供有效的 source.type"]}}
        )

    pronunciation = None
    pronunciation_id = label.get("pronunciation_id")
    if pronunciation_id:
        pronunciation = Pronunciation.objects.filter(id=pronunciation_id).first()
        if pronunciation is None:
            raise serializers.ValidationError(
                {"initial_nameplate": {"pronunciation_id": ["读音不存在"]}}
            )

    package = pronunciation.package if pronunciation else None
    if package is None and label.get("package_id"):
        package = Package.objects.filter(id=label["package_id"]).first()
        if package is None:
            raise serializers.ValidationError(
                {"initial_nameplate": {"package_id": ["写法不存在"]}}
            )
    if package is None:
        package = get_or_create_package(label)

    flavor = pronunciation.flavor if pronunciation else None
    if flavor is None:
        flavor = get_or_create_submission_flavor(can, label, user, package)

    dialect = pronunciation.dialect if pronunciation else None
    if dialect is None and label.get("dialect_id"):
        from .models import Dialect

        dialect = Dialect.objects.filter(id=label["dialect_id"]).first()
        if dialect is None:
            raise serializers.ValidationError(
                {"initial_nameplate": {"dialect_id": ["方言点不存在"]}}
            )
    dialect = dialect or can.submitted_dialect

    conflicts = {}
    if (
        pronunciation
        and label.get("package_id")
        and str(label["package_id"]) != str(pronunciation.package_id)
    ):
        conflicts["package_id"] = ["与 pronunciation_id 不一致"]
    if (
        pronunciation
        and label.get("flavor_id")
        and str(label["flavor_id"]) != str(pronunciation.flavor_id)
    ):
        conflicts["flavor_id"] = ["与 pronunciation_id 不一致"]
    if (
        pronunciation
        and label.get("dialect_id")
        and str(label["dialect_id"]) != str(pronunciation.dialect_id)
    ):
        conflicts["dialect_id"] = ["与 pronunciation_id 不一致"]
    if conflicts:
        raise ConflictException(
            "初始铭牌外键与 pronunciation_id 不一致",
            data={"fields": {"initial_nameplate": conflicts}},
        )

    if not any(
        [package, flavor, dialect, pronunciation, text_content, pronunciation_text]
    ):
        raise serializers.ValidationError(
            {"initial_nameplate": ["至少提供一个规范外键、原样写法或原样读音"]}
        )

    nameplate = Nameplate.objects.create(
        can=can,
        flavor=flavor,
        package=package,
        dialect=dialect,
        pronunciation=pronunciation,
        creator=user,
        text_content=text_content,
        definition=clean_text(label.get("definition")) or can.concept_text,
        pronunciation_text=pronunciation_text,
        evidence_level=label.get("evidence_level") or Nameplate.EvidenceLevel.MEMORY,
        source=source,
    )
    nameplate.promote_to_primary()
    if can.status == Can.Status.UNLABELED:
        can.status = Can.Status.PENDING
        can.save(update_fields=["status", "updated_at"])
    return nameplate


@transaction.atomic
def create_can_submission(*, user, can_data, initial_nameplate=None):
    data = dict(can_data)
    data["recorder"] = user

    can = Can.objects.create(**data)
    if initial_nameplate:
        create_initial_nameplate(can, initial_nameplate, user)
    return can
