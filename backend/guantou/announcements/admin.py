from django import forms
from django.contrib import admin

from utils.admin.widgets import ImagePreviewWidget, MarkdownEditorWidget

from .models import Announcement


class AnnouncementAdminForm(forms.ModelForm):
    class Meta:
        model = Announcement
        fields = "__all__"
        widgets = {
            "content": MarkdownEditorWidget(),
            "cover": ImagePreviewWidget(),
        }


@admin.register(Announcement)
class AnnouncementAdmin(admin.ModelAdmin):
    form = AnnouncementAdminForm
    list_display = (
        "id",
        "title",
        "author",
        "visibility",
        "publish_time",
        "update_time",
    )
    list_filter = ("visibility", "author")
    search_fields = ("title", "description", "content", "author__username")
    raw_id_fields = ("author",)
    ordering = ("-update_time", "-id")
