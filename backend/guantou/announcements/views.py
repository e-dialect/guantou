import demjson3
from django.http import JsonResponse
from django.views import View

from user.tokens import get_authorization_token, token_check
from utils.exceptions.types.not_found import AnnouncementNotFoundException
from user.dto.user_simple import user_simple
from utils.collections import order_by_id_list

from .dto.announcement import announcement_all, announcement_normal
from .forms import AnnouncementForm
from .models import Announcement


class SearchAnnouncement(View):
    def get(self, request) -> JsonResponse:
        announcements = Announcement.objects.filter(visibility=True)
        search = request.GET.get("search")
        if search:
            announcements = announcements.filter(title__icontains=search)
        return JsonResponse(
            {
                "announcements": [
                    {
                        "announcement": announcement_normal(announcement),
                        "author": user_simple(announcement.author),
                    }
                    for announcement in announcements
                ]
            },
            status=200,
        )

    def post(self, request) -> JsonResponse:
        user = token_check(get_authorization_token(request), -1)
        if not user:
            return JsonResponse({}, status=401)
        form = AnnouncementForm(demjson3.decode(request.body))
        if not form.is_valid():
            return JsonResponse({}, status=400)
        announcement = form.save(commit=False)
        announcement.author = user
        announcement.save()
        return JsonResponse({"id": announcement.id}, status=200)

    def put(self, request) -> JsonResponse:
        body = demjson3.decode(request.body)
        ids = body.get("announcements", [])
        announcements = Announcement.objects.filter(id__in=ids)
        announcements = order_by_id_list(announcements, ids)
        return JsonResponse(
            {
                "announcements": [
                    {
                        "announcement": announcement_normal(announcement),
                        "author": user_simple(announcement.author),
                    }
                    for announcement in announcements
                ]
            },
            status=200,
        )


def get_announcement(id):
    announcement = Announcement.objects.filter(id=id).first()
    if not announcement:
        raise AnnouncementNotFoundException(id)
    return announcement


class ManageAnnouncement(View):
    def get(self, request, id) -> JsonResponse:
        announcement = get_announcement(id)
        user = token_check(get_authorization_token(request))
        if not announcement.visibility and not (
            user and (user.is_superuser or user == announcement.author)
        ):
            return JsonResponse({}, status=403)
        return JsonResponse(
            {
                "announcement": announcement_all(announcement),
                "me": {
                    "is_author": bool(user and user == announcement.author),
                    "is_admin": bool(user and user.is_superuser),
                },
            },
            status=200,
        )

    def put(self, request, id) -> JsonResponse:
        announcement = get_announcement(id)
        user = token_check(get_authorization_token(request))
        if not (user and (user.is_superuser or user == announcement.author)):
            return JsonResponse({}, status=401)
        data = demjson3.decode(request.body).get(
            "announcement", demjson3.decode(request.body)
        )
        form = AnnouncementForm(data)
        if not form.is_valid():
            return JsonResponse({}, status=400)
        for field in ["title", "description", "content", "cover"]:
            setattr(announcement, field, data[field])
        announcement.save()
        return JsonResponse({}, status=200)

    def delete(self, request, id) -> JsonResponse:
        announcement = get_announcement(id)
        user = token_check(get_authorization_token(request))
        if not (user and (user.is_superuser or user == announcement.author)):
            return JsonResponse({}, status=401)
        announcement.delete()
        return JsonResponse({}, status=200)


class ManageAnnouncementVisibility(View):
    def put(self, request, id) -> JsonResponse:
        announcement = get_announcement(id)
        user = token_check(get_authorization_token(request), -1)
        if not user:
            return JsonResponse({}, status=401)
        body = demjson3.decode(request.body)
        announcement.visibility = bool(body.get("result"))
        announcement.save(update_fields=["visibility", "update_time"])
        return JsonResponse({}, status=200)
