import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from guantou.legacy_import import (
    HinghwaImporter,
    export_demo_fixture,
    import_demo_fixture,
    open_legacy_database,
)


class Command(BaseCommand):
    help = "只读分析/导入兴化语记旧库 SQLite，或导入/导出脱敏逻辑键 demo fixture"

    def add_arguments(self, parser):
        source_group = parser.add_mutually_exclusive_group(required=True)
        source_group.add_argument("--source", help="旧 SQLite 文件路径（始终只读）")
        source_group.add_argument("--fixture", help="脱敏逻辑键 JSON fixture 路径")
        mode_group = parser.add_mutually_exclusive_group(required=True)
        mode_group.add_argument(
            "--dry-run", action="store_true", help="只校验，不写数据库"
        )
        mode_group.add_argument("--apply", action="store_true", help="执行写入")
        scope_group = parser.add_mutually_exclusive_group()
        scope_group.add_argument("--all", action="store_true", help="处理全部来源记录")
        scope_group.add_argument(
            "--limit", type=int, help="各类最多处理 N 条，用于测试"
        )
        parser.add_argument("--report", help="将无秘密汇总报告写为 JSON")
        parser.add_argument(
            "--export-demo",
            help="源库 apply 后导出五地方言的脱敏逻辑键 fixture",
        )

    def handle(self, *args, **options):
        if options["limit"] is not None and options["limit"] <= 0:
            raise CommandError("--limit 必须大于 0")
        if options["source"] and not (options["all"] or options["limit"]):
            raise CommandError("旧库导入必须明确指定 --all 或 --limit")
        if options["fixture"] and (options["all"] or options["limit"]):
            raise CommandError("fixture 导入不接受 --all/--limit")
        if options["export_demo"] and not (
            options["source"] and options["apply"] and options["all"]
        ):
            raise CommandError("--export-demo 只可配合 --source --apply --all")

        try:
            if options["source"]:
                with open_legacy_database(options["source"]) as connection:
                    report = HinghwaImporter(
                        connection,
                        apply=options["apply"],
                        limit=options["limit"],
                    ).run()
            else:
                fixture_path = Path(options["fixture"]).expanduser().resolve()
                payload = json.loads(fixture_path.read_text(encoding="utf-8"))
                report = import_demo_fixture(payload, apply=options["apply"])
        except (OSError, ValueError, json.JSONDecodeError) as exc:
            raise CommandError(str(exc)) from exc

        if options["export_demo"]:
            demo_path = Path(options["export_demo"]).expanduser().resolve()
            demo_path.parent.mkdir(parents=True, exist_ok=True)
            demo_path.write_text(
                json.dumps(export_demo_fixture(), ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            report["demo_fixture"] = str(demo_path)

        serialized = json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True)
        if options["report"]:
            report_path = Path(options["report"]).expanduser().resolve()
            report_path.parent.mkdir(parents=True, exist_ok=True)
            report_path.write_text(serialized + "\n", encoding="utf-8")
        self.stdout.write(serialized)
