from django.urls import path

from . import views

app_name = "siteconfig"

urlpatterns = [
    path("announcements", views.announcements),
    path("featured-announcements", views.featured_announcements),
    path("carousel", views.carousel),
]
