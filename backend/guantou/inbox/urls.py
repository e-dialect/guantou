from django.urls import path
from django.views.decorators.csrf import csrf_exempt

from .views import Notifications, manage_notification, mark_notifications_read

app_name = "inbox"

urlpatterns = [
    path("", csrf_exempt(Notifications.as_view())),
    path("/<int:id>", manage_notification),
    path("/unread", mark_notifications_read),
]
