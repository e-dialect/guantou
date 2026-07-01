import demjson3
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

from announcements.dto.announcement import announcement_normal
from announcements.models import Announcement
from user.dto.user_simple import user_simple
from user.tokens import token_check
from utils.collections import order_by_id_list

from .models import SiteSettings


def announcement_payload(announcement):
    return {
        "announcement": announcement_normal(announcement),
        "author": user_simple(announcement.author),
    }


def ordered_visible_announcements(ids):
    result = Announcement.objects.filter(id__in=ids, visibility=True)
    return order_by_id_list(result, ids)


def admin_user_from_request(request):
    return token_check(request.headers.get("token"), -1)


@csrf_exempt
def announcements(request):
    item = SiteSettings.get_solo()
    if request.method == "GET":
        return JsonResponse(
            {
                "announcements": [
                    announcement_payload(announcement)
                    for announcement in ordered_visible_announcements(
                        item.announcements
                    )
                ]
            },
            status=200,
        )
    if request.method == "PUT":
        if not admin_user_from_request(request):
            return JsonResponse({}, status=401)
        body = demjson3.decode(request.body)
        if isinstance(body.get("announcements"), list):
            item.announcements = body["announcements"]
            item.save(update_fields=["announcements"])
            return JsonResponse({}, status=200)
        return JsonResponse({}, status=400)
    return JsonResponse({}, status=405)


@csrf_exempt
def featured_announcements(request):
    item = SiteSettings.get_solo()
    if request.method == "GET":
        return JsonResponse(
            {
                "featured_announcements": [
                    announcement_payload(announcement)
                    for announcement in ordered_visible_announcements(
                        item.featured_announcements
                    )
                ]
            },
            status=200,
        )
    if request.method == "PUT":
        if not admin_user_from_request(request):
            return JsonResponse({}, status=401)
        body = demjson3.decode(request.body)
        if isinstance(body.get("featured_announcements"), list):
            item.featured_announcements = body["featured_announcements"]
            item.save(update_fields=["featured_announcements"])
            return JsonResponse({}, status=200)
        return JsonResponse({}, status=400)
    return JsonResponse({}, status=405)


@csrf_exempt
def carousel(request):
    item = SiteSettings.get_solo()
    if request.method == "GET":
        return JsonResponse({"carousel": item.carousel}, status=200)
    if request.method == "PUT":
        if not admin_user_from_request(request):
            return JsonResponse({}, status=401)
        body = demjson3.decode(request.body)
        if isinstance(body.get("carousel"), list):
            item.carousel = body["carousel"]
            item.save(update_fields=["carousel"])
            return JsonResponse({}, status=200)
        return JsonResponse({}, status=400)
    return JsonResponse({}, status=405)
