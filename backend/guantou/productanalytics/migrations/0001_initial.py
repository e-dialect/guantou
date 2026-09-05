from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="ProductEvent",
            fields=[
                (
                    "id",
                    models.AutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "event_name",
                    models.CharField(
                        choices=[
                            ("listen_feed_view", "浏览听音流"),
                            ("entry_search", "搜索词条"),
                            ("recording_submit", "提交录音"),
                            ("evidence_submit", "提交补证"),
                            ("curation_task_complete", "完成整理任务"),
                            ("capability_degraded", "能力降级"),
                        ],
                        max_length=48,
                    ),
                ),
                ("session_hash", models.CharField(max_length=64)),
                (
                    "platform",
                    models.CharField(
                        choices=[
                            ("h5", "H5"),
                            ("mp-weixin", "微信小程序"),
                            ("app", "原生应用"),
                            ("unknown", "未知"),
                        ],
                        default="unknown",
                        max_length=16,
                    ),
                ),
                ("surface", models.CharField(blank=True, max_length=32)),
                ("result", models.CharField(blank=True, max_length=24)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("received_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "verbose_name": "产品事件原始明细",
                "verbose_name_plural": "产品事件原始明细",
                "ordering": ["-received_at", "-id"],
            },
        ),
        migrations.CreateModel(
            name="ProductEventDailySummary",
            fields=[
                (
                    "id",
                    models.AutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("date", models.DateField()),
                (
                    "event_name",
                    models.CharField(
                        choices=[
                            ("listen_feed_view", "浏览听音流"),
                            ("entry_search", "搜索词条"),
                            ("recording_submit", "提交录音"),
                            ("evidence_submit", "提交补证"),
                            ("curation_task_complete", "完成整理任务"),
                            ("capability_degraded", "能力降级"),
                        ],
                        max_length=48,
                    ),
                ),
                (
                    "platform",
                    models.CharField(
                        choices=[
                            ("h5", "H5"),
                            ("mp-weixin", "微信小程序"),
                            ("app", "原生应用"),
                            ("unknown", "未知"),
                        ],
                        max_length=16,
                    ),
                ),
                ("surface", models.CharField(blank=True, max_length=32)),
                ("result", models.CharField(blank=True, max_length=24)),
                ("event_count", models.PositiveIntegerField(default=0)),
                ("unique_sessions", models.PositiveIntegerField(default=0)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "产品事件日汇总",
                "verbose_name_plural": "产品事件日汇总",
                "ordering": ["-date", "event_name", "platform", "surface", "result"],
            },
        ),
        migrations.AddIndex(
            model_name="productevent",
            index=models.Index(
                fields=["received_at"], name="productanal_receive_97c7e6_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="productevent",
            index=models.Index(
                fields=["event_name", "platform", "received_at"],
                name="productanal_event_n_0c5ce3_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="producteventdailysummary",
            index=models.Index(
                fields=["date", "event_name", "platform"],
                name="productanal_date_fea4ef_idx",
            ),
        ),
        migrations.AddConstraint(
            model_name="producteventdailysummary",
            constraint=models.UniqueConstraint(
                fields=("date", "event_name", "platform", "surface", "result"),
                name="unique_product_event_daily_dimension",
            ),
        ),
    ]
