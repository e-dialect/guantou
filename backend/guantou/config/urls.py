from django.contrib import admin
from django.urls import path, include

from user import views as user
from files.views import open_file_url

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("guantou.urls")),
    path("api/users/", include("user.urls", namespace="api_users")),
    path("api/login/", include("user.urls", namespace="api_login")),
    path("api/users", user.router_users),
    path("api/login", user.login),
    path(
        "api/announcements",
        include("announcements.urls", namespace="api_announcements"),
    ),
    path("api/site-settings/", include("siteconfig.urls", namespace="api_siteconfig")),
    path("api/files", include("files.urls", namespace="api_files")),
    path("api/notifications", include("inbox.urls", namespace="api_inbox")),
    path("api/files/<type>/<id>/<Y>/<M>/<D>/<X>", open_file_url),
    # Legacy aliases kept for existing clients. New frontend/backend work should use /api/*.
    path("users/", include("user.urls", namespace="users")),
    path("login/", include("user.urls", namespace="login")),
    path("users", user.router_users),
    path("login", user.login),
    path("announcements", include("announcements.urls", namespace="announcements")),
    path("site-settings/", include("siteconfig.urls", namespace="siteconfig")),
    path("files", include("files.urls", namespace="files")),
    path("notifications", include("inbox.urls", namespace="inbox")),
    path("files/<type>/<id>/<Y>/<M>/<D>/<X>", open_file_url),
]
