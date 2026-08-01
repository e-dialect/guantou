import demjson3
from django.contrib.auth.models import User
from django.core.paginator import Paginator
from django.db.models import Q
from django.http import JsonResponse
from django.views import View
from django.views.decorators.csrf import csrf_exempt

from user.tokens import get_request_user, token_check
from utils.exceptions.types.bad_request import BadRequestException
from utils.exceptions.types.unauthorized import UnauthorizedException

from .dto import notification_normal
from .models import Notification
from .services import mark_notification_read, send_notification


class Notifications(View):
    def post(self, request):
        user = get_request_user(request)
        if not user.id:
            raise UnauthorizedException()
        body = demjson3.decode(request.body)
        if len(body["recipients"]) == 1 and body["recipients"][0] == -1:
            recipients = None
        else:
            recipients = User.objects.filter(id__in=body["recipients"])
        title = body["title"] if "title" in body else None
        notifications = send_notification(
            user, recipients, body["content"], title=title
        )
        return JsonResponse({"notifications": notifications}, status=200)

    def get(self, request):
        user = get_request_user(request)
        if not user.id:
            raise UnauthorizedException()
        notifications = Notification.objects.all()
        if not user.is_staff:
            notifications = notifications.filter(
                Q(actor_id=user.id) | Q(recipient_id=user.id)
            )
        if "from" in request.GET:
            notifications = notifications.filter(actor_id=request.GET["from"])
        elif "to" in request.GET:
            notifications = notifications.filter(recipient_id=request.GET["to"])
        else:
            notifications = notifications.filter(recipient_id=user.id)
        if "unread" in request.GET:
            if request.GET["unread"] in ["True", "true", "1"]:
                notifications = notifications.filter(unread=True)
            elif request.GET["unread"] in ["False", "false", "0"]:
                notifications = notifications.filter(unread=False)
            else:
                raise BadRequestException("unread should be True or False")

        page_size = int(request.GET.get("pageSize", 10))
        page = int(request.GET.get("page", 1))
        pages = Paginator(notifications, page_size)
        return JsonResponse(
            {
                "notifications": [
                    notification_normal(notification)
                    for notification in pages.page(page)
                ],
                "total": notifications.count(),
                "pages": pages.num_pages,
            },
            status=200,
        )


@csrf_exempt
def manage_notification(request, id):
    notification = Notification.objects.filter(id=id).first()
    if not notification:
        return JsonResponse({}, status=404)
    if request.method != "GET":
        return JsonResponse({}, status=405)
    token = request.headers.get("token")
    user1 = token_check(token, notification.actor_id)
    user2 = token_check(token, notification.recipient_id)
    if not (user1 or user2):
        return JsonResponse({}, status=401)
    if user2 and user2.id == notification.recipient_id:
        mark_notification_read(notification)
    return JsonResponse(notification_normal(notification), status=200)


@csrf_exempt
def mark_notifications_read(request):
    user = token_check(request.headers.get("token"))
    if not user:
        return JsonResponse({}, status=401)
    if request.method != "PUT":
        return JsonResponse({}, status=405)
    body = demjson3.decode(request.body) if len(request.body) else {}
    notifications = Notification.objects.filter(recipient_id=user.id)
    if "notifications" in body:
        notifications = notifications.filter(id__in=body["notifications"])
    for notification in notifications:
        mark_notification_read(notification)
    return JsonResponse({}, status=200)
