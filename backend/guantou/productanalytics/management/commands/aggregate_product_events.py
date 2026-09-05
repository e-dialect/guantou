from django.core.management.base import BaseCommand

from productanalytics.services import aggregate_and_prune_product_events


class Command(BaseCommand):
    help = "汇总产品事件并删除超过配置保留期（最长 90 天）的原始明细"

    def handle(self, *args, **options):
        result = aggregate_and_prune_product_events()
        self.stdout.write(
            self.style.SUCCESS(
                f"updated {result['summaries']} summaries; "
                f"deleted {result['deleted_raw_events']} raw events"
            )
        )
