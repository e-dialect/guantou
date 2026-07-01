from django.apps import AppConfig


class SiteConfigConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "siteconfig"
    verbose_name = "站点运营配置"
