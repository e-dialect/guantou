from django.contrib.auth.models import User
from django.db import models


class Announcement(models.Model):
    """站内公告；用于发布产品通知、资料库更新和维护信息。"""

    author = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="announcements",
        verbose_name="发布者",
    )
    publish_time = models.DateTimeField(auto_now_add=True, verbose_name="发布时间")
    update_time = models.DateTimeField(auto_now=True, verbose_name="最近更新时间")
    title = models.CharField(max_length=100, verbose_name="标题")
    description = models.TextField(verbose_name="摘要", max_length=300, blank=True)
    content = models.TextField(verbose_name="正文")
    cover = models.URLField(verbose_name="图片地址", blank=True)
    visibility = models.BooleanField(default=False, verbose_name="是否发布")

    def __str__(self):
        return self.title

    def clean(self):
        self.title = self.title.strip()
        self.description = self.description.strip()
        self.content = self.content.strip()
        return super().clean()

    def save(self, *args, **kwargs):
        self.clean()
        return super().save(*args, **kwargs)

    class Meta:
        ordering = ["-update_time", "-id"]
        verbose_name_plural = "公告"
        verbose_name = "公告"
