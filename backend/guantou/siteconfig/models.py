from django.db import models


class SiteSettings(models.Model):
    announcements = models.JSONField(default=list, blank=True, verbose_name="公告排序")
    featured_announcements = models.JSONField(
        default=list, blank=True, verbose_name="推荐公告"
    )
    carousel = models.JSONField(default=list, blank=True, verbose_name="首页轮播")

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
