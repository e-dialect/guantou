from django.db.models import Q

from guantou.models import Can, Flavor, Package

DEFAULT_LIMIT = 8
MAX_LIMIT = 20


def result_limit(value):
    try:
        return min(max(int(value), 1), MAX_LIMIT)
    except (TypeError, ValueError):
        return DEFAULT_LIMIT


def visible_cans_for_user(user):
    queryset = Can.objects.select_related(
        "recorder", "dialect", "flavor_variant", "verifier"
    ).prefetch_related("nameplates")
    if user and user.is_authenticated and user.is_staff:
        return queryset
    if user and user.is_authenticated:
        return queryset.filter(Q(visibility=True) | Q(recorder=user))
    return queryset.filter(visibility=True)


def search_flavors(keyword, limit):
    return (
        Flavor.objects.prefetch_related("packages", "variants")
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


def aggregate_search(keyword, user=None, limit=DEFAULT_LIMIT):
    clean_keyword = str(keyword or "").strip()
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
