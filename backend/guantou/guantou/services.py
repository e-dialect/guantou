import logging

from django.db import transaction
from django.db.models import (
    BooleanField,
    Case,
    Count,
    Exists,
    F,
    IntegerField,
    OuterRef,
    Prefetch,
    Q,
    Value,
    When,
)
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from user.models import UserFollow
from utils.exceptions.payload import field_error
from utils.exceptions.types.conflict import ConflictException

from .models import (
    Can,
    DailyCanSelection,
    CanLike,
    CanPost,
    CanTransition,
    Flavor,
    FlavorPackage,
    Nameplate,
    Package,
    Pronunciation,
    SearchTerm,
    SearchTermHit,
)

logger = logging.getLogger(__name__)

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


def nameplate_preview_queryset():
    """Return the complete, query-stable source for every embedded nameplate card."""
    return (
        Nameplate.objects.select_related(
            "can",
            "package",
            "flavor",
            "dialect",
            "dialect__parent",
            "dialect__parent__parent",
            "pronunciation",
            "creator",
        )
        .prefetch_related("supports")
        .annotate(comment_count=Count("comments", distinct=True))
    )


def prefetch_nameplate_previews(path="nameplates"):
    return Prefetch(path, queryset=nameplate_preview_queryset())


def visible_cans_for_user(user):
    queryset = Can.objects.select_related(
        "recorder", "submitted_dialect", "verifier"
    ).prefetch_related(prefetch_nameplate_previews())
    if user and user.is_authenticated and user.is_staff:
        return queryset
    if user and user.is_authenticated:
        return queryset.filter(Q(visibility=True) | Q(recorder=user))
    return queryset.filter(visibility=True)


def _select_daily_can_id():
    """Pick today's can id using the public candidate pools.

    Selection precedence:
    1. operator-configured featured cans (date rotation within the pool)
    2. verified cans carrying a complete primary nameplate
    3. any public can
    """
    public = visible_cans_for_user(None).filter(visibility=True)
    today_ordinal = timezone.localdate().toordinal()

    from siteconfig.models import SiteSettings

    settings = SiteSettings.objects.filter(pk=1).first()
    featured_ids = [int(item) for item in (settings.featured_cans if settings else [])]
    if featured_ids:
        visible_featured = set(
            public.filter(id__in=featured_ids).values_list("id", flat=True)
        )
        ordered = [item for item in featured_ids if item in visible_featured]
        if ordered:
            return ordered[today_ordinal % len(ordered)]

    preferred_ids = list(
        public.filter(
            status=Can.Status.VERIFIED,
            nameplates__is_primary=True,
            nameplates__status=Nameplate.Status.ACTIVE,
            nameplates__package__isnull=False,
            nameplates__flavor__isnull=False,
            nameplates__dialect__isnull=False,
        )
        .order_by("id")
        .distinct()
        .values_list("id", flat=True)
    )
    if not preferred_ids:
        preferred_ids = list(public.order_by("id").values_list("id", flat=True))
    if not preferred_ids:
        return None
    return preferred_ids[today_ordinal % len(preferred_ids)]


@transaction.atomic
def daily_can(user=None):
    """Return the fully annotated daily can, persisted per calendar day."""
    today = timezone.localdate()

    from siteconfig.models import SiteSettings

    # Serialize first-selection by locking the stable singleton row.
    settings = SiteSettings.get_solo()
    SiteSettings.objects.select_for_update().filter(pk=settings.pk).first()

    selection = DailyCanSelection.objects.filter(date=today).first()
    can_id = selection.can_id if selection else None
    if can_id is None or not Can.objects.filter(pk=can_id, visibility=True).exists():
        can_id = _select_daily_can_id()
        if can_id is None:
            return None
        DailyCanSelection.objects.update_or_create(
            date=today, defaults={"can_id": can_id}
        )

    return with_can_card_annotations(
        visible_cans_for_user(user).filter(visibility=True, pk=can_id),
        user,
    ).first()


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
    return with_can_card_annotations(
        visible_cans_for_user(user).filter(
            Q(concept_text__icontains=keyword)
            | Q(nameplates__text_content__icontains=keyword)
            | Q(nameplates__definition__icontains=keyword)
        ),
        user,
    ).distinct()[:limit]


def with_can_card_annotations(queryset, user):
    """为消费 CanCardSerializer 的列表路径批量注解计数与“我”视角布尔，

    避免逐罐 fallback 查询；配合 visible_cans_for_user 的 nameplates/supports
    预取，保证列表序列化不产生逐罐/逐铭牌额外查询。
    """
    queryset = queryset.annotate(
        nameplate_count=Count(
            "nameplates",
            filter=Q(nameplates__status=Nameplate.Status.ACTIVE),
            distinct=True,
        ),
        like_count=Count("likes", distinct=True),
        comment_count=Count(
            "comments",
            filter=Q(comments__nameplate__isnull=True),
            distinct=True,
        ),
        use_count=Count(
            "posts",
            filter=Q(posts__visibility=CanPost.Visibility.PUBLIC),
            distinct=True,
        ),
    )
    if user and user.is_authenticated:
        return queryset.annotate(
            liked_by_me=Exists(
                CanLike.objects.filter(can_id=OuterRef("pk"), user=user)
            ),
            recorder_followed_by_me=Exists(
                UserFollow.objects.filter(
                    follower=user, followed_id=OuterRef("recorder_id")
                )
            ),
        )
    return queryset.annotate(
        liked_by_me=Value(False, output_field=BooleanField()),
        recorder_followed_by_me=Value(False, output_field=BooleanField()),
    )


def aggregate_search(keyword, user=None, limit=DEFAULT_SEARCH_LIMIT):
    clean_keyword = clean_text(keyword)
    if not clean_keyword:
        return {
            "keyword": "",
            "flavors": [],
            "packages": [],
            "nameplates": [],
            "cans": [],
        }

    normalized_limit = result_limit(limit)
    return {
        "keyword": clean_keyword,
        "flavors": search_flavors(clean_keyword, normalized_limit),
        "packages": search_packages(clean_keyword, normalized_limit),
        "nameplates": suggest_nameplates(clean_keyword, user, normalized_limit),
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
        nameplate_preview_queryset()
        .filter(can__in=visible_cans_for_user(user))
        .filter(Q(text_content__icontains=keyword) | Q(definition__icontains=keyword))
        .annotate(
            support_count=Count("supports", distinct=True),
            suggest_rank=_prefix_rank(Q(text_content__istartswith=keyword)),
        )
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


def _search_attributer(request):
    user = getattr(request, "user", None)
    if user is not None and user.is_authenticated:
        return f"user:{user.pk}"

    visitor = getattr(request, "visitor", None)
    if visitor is not None:
        return f"visitor:{visitor.pk}"
    return ""


def record_search(keyword, request):
    keyword = clean_text(keyword)
    attributer = _search_attributer(request)
    max_length = SearchTerm._meta.get_field("keyword").max_length
    if not keyword or len(keyword) > max_length or not attributer:
        return False

    try:
        with transaction.atomic():
            term, _ = SearchTerm.objects.get_or_create(keyword=keyword)
            _, created = SearchTermHit.objects.get_or_create(
                term=term,
                attributer=attributer,
                hit_date=timezone.localdate(),
            )
            if created:
                SearchTerm.objects.filter(pk=term.pk).update(
                    count=F("count") + 1,
                    last_searched_at=timezone.now(),
                )
        return created
    except Exception:
        # 热词统计是旁路能力，任何异常都不能影响主搜索请求。
        logger.debug("Failed to record search term", exc_info=True)
        return False


def hot_search_terms(limit=None):
    normalized_limit = result_limit(limit, default=8, maximum=20)
    terms = SearchTerm.objects.order_by("-count", "-last_searched_at", "id")[
        :normalized_limit
    ]
    return [
        {"keyword": term.keyword, "rank": rank}
        for rank, term in enumerate(terms, start=1)
    ]


CAN_TRANSITIONS = {
    "submit": {Can.Status.PENDING: Can.Status.TENTATIVE},
    "verify": {
        Can.Status.TENTATIVE: Can.Status.VERIFIED,
        Can.Status.DISPUTED: Can.Status.VERIFIED,
    },
    "reject": {
        Can.Status.PENDING: Can.Status.REJECTED,
        Can.Status.TENTATIVE: Can.Status.REJECTED,
        Can.Status.DISPUTED: Can.Status.REJECTED,
    },
    "dispute": {Can.Status.TENTATIVE: Can.Status.DISPUTED},
    "restore": {Can.Status.REJECTED: Can.Status.PENDING},
}


def _transition_actor(user):
    try:
        nickname = user.user_info.nickname or user.username
        avatar = user.user_info.avatar or ""
    except Exception:
        nickname = user.username
        avatar = ""
    return {
        "id": user.id,
        "username": user.username,
        "nickname": nickname,
        "avatar": avatar,
    }


def record_can_transition(
    can, *, from_status, to_status, action, actor=None, reason=""
):
    """Append a CanTransition row and the legacy JSON transition_log entry."""
    transition_log = list(can.transition_log or [])
    transition_log.append(
        {
            "action": action,
            "from": from_status,
            "to": to_status,
            "by": _transition_actor(actor) if actor else None,
            "at": timezone.now().isoformat(),
            "reason": reason,
        }
    )
    can.transition_log = transition_log
    CanTransition.objects.create(
        can=can,
        from_status=from_status,
        to_status=to_status,
        action=action,
        actor=actor,
        reason=reason,
    )


def normalize_transition_log(value):
    """Return the stable public audit schema while tolerating legacy JSON."""

    if not isinstance(value, list):
        return []
    normalized = []
    for raw_event in value:
        if not isinstance(raw_event, dict):
            continue
        raw_actor = raw_event.get("by")
        if isinstance(raw_actor, dict):
            actor = {
                "id": raw_actor.get("id"),
                "username": str(raw_actor.get("username") or ""),
                "nickname": str(raw_actor.get("nickname") or ""),
                "avatar": str(raw_actor.get("avatar") or ""),
            }
        else:
            actor = {
                "id": raw_actor if isinstance(raw_actor, int) else None,
                "username": "",
                "nickname": "",
                "avatar": "",
            }
        normalized.append(
            {
                "action": str(raw_event.get("action") or ""),
                "from": str(raw_event.get("from") or ""),
                "to": str(raw_event.get("to") or ""),
                "by": actor,
                "at": str(raw_event.get("at") or ""),
                "reason": str(raw_event.get("reason") or ""),
            }
        )
    return normalized


@transaction.atomic
def transition_can(*, can_id, user, action, reason=""):
    if action not in CAN_TRANSITIONS:
        raise serializers.ValidationError({"action": f"未知操作: {action}"})

    can = (
        Can.objects.select_for_update()
        .select_related("recorder", "verifier")
        .get(pk=can_id)
    )
    is_recorder = can.recorder_id == user.id
    if action in {"verify", "reject"}:
        allowed = user.is_staff
    elif action == "restore":
        allowed = user.is_staff or is_recorder
    else:
        allowed = is_recorder
    if not allowed:
        raise PermissionDenied("您没有权限执行此操作")

    target = CAN_TRANSITIONS[action].get(can.status)
    if target is None:
        raise ConflictException(f"不允许从 {can.status} 执行 {action}")

    clean_reason = clean_text(reason)
    if len(clean_reason) > 300:
        raise serializers.ValidationError({"reason": "流转理由不能超过 300 字"})
    from_status = can.status
    record_can_transition(
        can,
        from_status=from_status,
        to_status=target,
        action=action,
        actor=user,
        reason=clean_reason,
    )
    can.status = target
    if action in {"verify", "reject"}:
        can.verifier = user
    elif action == "restore":
        can.verifier = None
    can.save(update_fields=["status", "transition_log", "verifier", "updated_at"])
    if action in {"verify", "reject"}:
        from inbox.models import Notification
        from inbox.services import send_event_notification

        result_label = "审核通过" if action == "verify" else "审核驳回"
        description = (
            f"{result_label}：{clean_reason}" if clean_reason else result_label
        )
        transaction.on_commit(
            lambda: send_event_notification(
                actor=user,
                recipient=can.recorder,
                verb=Notification.Verb.CAN_REVIEW,
                description=description,
                action_object=can,
                metadata={
                    "target_type": "can",
                    "target_id": can.id,
                    "target_url": f"/pages/cans/details?id={can.id}",
                },
            )
        )
    return can


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
    # Serialize repeated submissions for the same package and tolerate duplicate
    # Flavor rows created by the legacy submission path. The earliest row is the
    # deterministic canonical choice until a dedicated data-governance migration
    # can establish a database-level Flavor identity constraint.
    Package.objects.select_for_update().get(pk=package.pk)
    flavor = (
        Flavor.objects.filter(name=definition, definition=definition)
        .order_by("id")
        .first()
    )
    if flavor is None:
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
    if package is not None and flavor is not None:
        FlavorPackage.objects.get_or_create(package=package, flavor=flavor)

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
            data={
                "initial_nameplate": {
                    field: field_error(messages[0], "relation_conflict")
                    for field, messages in conflicts.items()
                }
            },
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
        record_can_transition(
            can,
            from_status=Can.Status.UNLABELED,
            to_status=Can.Status.PENDING,
            action="label",
            actor=user,
        )
        can.status = Can.Status.PENDING
        can.save(update_fields=["status", "transition_log", "updated_at"])
    return nameplate


@transaction.atomic
def create_can_submission(*, user, can_data, initial_nameplate=None):
    data = dict(can_data)
    data["recorder"] = user

    can = Can.objects.create(**data)
    if initial_nameplate:
        create_initial_nameplate(can, initial_nameplate, user)
    return can
