from django.urls import path
from django.views.decorators.csrf import csrf_exempt

from .views import (
    ManageAnnouncement,
    ManageAnnouncementVisibility,
    SearchAnnouncement,
)

app_name = "announcements"

urlpatterns = [
    path("", csrf_exempt(SearchAnnouncement.as_view())),
    path("/<int:id>", csrf_exempt(ManageAnnouncement.as_view())),
    path("/<int:id>/visibility", csrf_exempt(ManageAnnouncementVisibility.as_view())),
]
