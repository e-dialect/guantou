from django.db import models

from .capabilities import default_remote_capabilities, validate_remote_capabilities


class SiteSettings(models.Model):
    announcements = models.JSONField(default=list, blank=True, verbose_name="公告排序")
    featured_announcements = models.JSONField(
        default=list, blank=True, verbose_name="推荐公告"
    )
    featured_cans = models.JSONField(default=list, blank=True, verbose_name="推荐罐头")
    carousel = models.JSONField(default=list, blank=True, verbose_name="首页轮播")
    remote_capabilities = models.JSONField(
        default=default_remote_capabilities,
        blank=True,
        validators=[validate_remote_capabilities],
        verbose_name="远程能力开关",
        help_text="只能关闭客户端已编译的能力；不能凭空启用未编译能力。",
    )
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    @classmethod
    def get_solo(cls):
        item, _ = cls.objects.get_or_create(pk=1)
        return item

    def save(self, *args, **kwargs):
        self.pk = 1
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        return None

    def __str__(self):
        return "乡声集盒站点运营配置"

    class Meta:
        verbose_name = "站点运营配置"
        verbose_name_plural = "站点运营配置"
