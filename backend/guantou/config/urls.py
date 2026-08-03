from django.contrib import admin
from django.urls import path, include

from user import views as user
from files.views import open_file_url

urlpatterns = [
    path("admin/", admin.site.urls),
    path("", include("guantou.urls")),
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
