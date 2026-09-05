from django.db import migrations, models

import siteconfig.capabilities


class Migration(migrations.Migration):
    dependencies = [
        ("siteconfig", "0003_sitesettings_featured_cans"),
    ]

    operations = [
        migrations.AddField(
            model_name="sitesettings",
            name="remote_capabilities",
            field=models.JSONField(
                blank=True,
                default=siteconfig.capabilities.default_remote_capabilities,
                help_text="只能关闭客户端已编译的能力；不能凭空启用未编译能力。",
                validators=[siteconfig.capabilities.validate_remote_capabilities],
                verbose_name="远程能力开关",
            ),
        ),
    ]
