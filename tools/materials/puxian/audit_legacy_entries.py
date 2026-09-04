#!/usr/bin/env python3
"""Read-only audit for the Hinghwa legacy lexicon SQLite database.

The audit deliberately reports candidates instead of changing or deciding the
target data model. JSON output contains every candidate; Markdown output keeps
the same totals but limits examples for human review.
"""

from __future__ import annotations

import argparse
import json
import re
import sqlite3
import sys
from collections import defaultdict
from contextlib import closing
from pathlib import Path


WORD_COLUMNS = {
    "id",
    "word",
    "definition",
    "annotation",
    "mandarin",
    "standard_ipa",
    "standard_pinyin",
    "visibility",
    "contributor_id",
    "tags",
}
RECORDING_COLUMNS = {
    "id",
    "source",
    "ipa",
    "pinyin",
    "county",
    "town",
    "visibility",
    "views",
    "contributor_id",
    "word_id",
    "verifier_id",
    "upload_time",
}
CIRCLED_NUMBER_RE = re.compile(r"([①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳])")
WHITESPACE_RE = re.compile(r"\s+")


class AuditError(RuntimeError):
    """Raised when the supplied database cannot be audited safely."""


def clean_text(value) -> str:
    return WHITESPACE_RE.sub(" ", str(value or "")).strip()


def excerpt(value, limit=180) -> str:
    text = clean_text(value)
    if len(text) <= limit:
        return text
    return f"{text[: limit - 1]}…"


def split_numbered_senses(definition) -> list[dict[str, str]]:
    """Return circled-number segments without asserting they are true senses."""

    text = clean_text(definition)
    parts = CIRCLED_NUMBER_RE.split(text)
    segments = []
    for index in range(1, len(parts), 2):
        marker = parts[index]
        content = parts[index + 1].strip() if index + 1 < len(parts) else ""
        segments.append({"marker": marker, "text": content})
    return segments


def connect_read_only(database_path) -> sqlite3.Connection:
    path = Path(database_path).expanduser().resolve()
    if not path.is_file():
        raise AuditError(f"数据库不存在或不是文件: {path}")
    try:
        connection = sqlite3.connect(f"{path.as_uri()}?mode=ro", uri=True)
    except sqlite3.Error as exc:
        raise AuditError(f"无法以只读方式打开数据库: {exc}") from exc
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA query_only = ON")
    return connection


def table_columns(connection, table: str) -> set[str]:
    return {row["name"] for row in connection.execute(f"PRAGMA table_info({table})")}


def validate_schema(connection) -> None:
    tables = {
        row["name"]
        for row in connection.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table'"
        )
    }
    missing_tables = {"word_word", "word_pronunciation"} - tables
    if missing_tables:
        raise AuditError(f"缺少旧库数据表: {', '.join(sorted(missing_tables))}")

    checks = (
        ("word_word", WORD_COLUMNS),
        ("word_pronunciation", RECORDING_COLUMNS),
    )
    for table, required in checks:
        missing = required - table_columns(connection, table)
        if missing:
            raise AuditError(f"{table} 缺少字段: {', '.join(sorted(missing))}")


def usage_area(row) -> tuple[str, str]:
    return clean_text(row["county"]), clean_text(row["town"])


def usage_area_label(area: tuple[str, str]) -> str:
    county, town = area
    return " · ".join(item for item in (county, town) if item) or "未填写地区"


def reading_key(row) -> tuple[str, str]:
    return clean_text(row["ipa"]), clean_text(row["pinyin"])


def reading_label(reading: tuple[str, str]) -> str:
    ipa, pinyin = reading
    if ipa and pinyin:
        return f"IPA {ipa} / {pinyin}"
    if ipa:
        return f"IPA {ipa}"
    if pinyin:
        return pinyin
    return "未标音"


def _visible(value) -> bool:
    return bool(int(value or 0))


def _candidate_sort_key(item):
    return (clean_text(item.get("writing")), item.get("source_word_id", 0))


def audit_database(database_path) -> dict:
    path = Path(database_path).expanduser().resolve()
    with closing(connect_read_only(path)) as connection:
        validate_schema(connection)
        words = [dict(row) for row in connection.execute("SELECT * FROM word_word ORDER BY id")]
        recordings = [
            dict(row)
            for row in connection.execute(
                "SELECT * FROM word_pronunciation ORDER BY id"
            )
        ]

    words_by_id = {int(row["id"]): row for row in words}
    recordings_by_word = defaultdict(list)
    orphan_recordings = []
    for row in recordings:
        word_id = int(row["word_id"])
        if word_id not in words_by_id:
            orphan_recordings.append(row)
            continue
        recordings_by_word[word_id].append(row)

    spellings = defaultdict(list)
    for row in words:
        spellings[clean_text(row["word"])].append(row)

    possible_duplicates = []
    for writing, rows in sorted(spellings.items()):
        if not writing or len(rows) < 2:
            continue
        possible_duplicates.append(
            {
                "writing": writing,
                "source_word_ids": [int(row["id"]) for row in rows],
                "records": [
                    {
                        "source_word_id": int(row["id"]),
                        "definition": excerpt(row["definition"]),
                        "standard_ipa": clean_text(row["standard_ipa"]),
                        "standard_pinyin": clean_text(row["standard_pinyin"]),
                    }
                    for row in rows
                ],
                "decision": "possible_duplicate",
            }
        )

    sense_segmentation = []
    numbering_anomalies = []
    for row in words:
        segments = split_numbered_senses(row["definition"])
        markers = {part["marker"] for part in segments}
        if not {"①", "②"}.issubset(markers):
            if len(segments) >= 2:
                numbering_anomalies.append(
                    {
                        "source_word_id": int(row["id"]),
                        "writing": clean_text(row["word"]),
                        "markers": [part["marker"] for part in segments],
                        "definition": excerpt(row["definition"]),
                        "decision": "review_numbering_anomaly",
                    }
                )
            continue
        sense_segmentation.append(
            {
                "source_word_id": int(row["id"]),
                "writing": clean_text(row["word"]),
                "segments": [
                    {"marker": part["marker"], "text": excerpt(part["text"])}
                    for part in segments
                ],
                "decision": "suggest_sense_segmentation",
            }
        )

    reading_variation = []
    same_area_entry_split = []
    for word_id, rows in recordings_by_word.items():
        readings_by_area = defaultdict(set)
        for row in rows:
            reading = reading_key(row)
            if any(reading):
                readings_by_area[usage_area(row)].add(reading)
        all_readings = {reading for readings in readings_by_area.values() for reading in readings}
        if len(all_readings) > 1:
            word = words_by_id[word_id]
            reading_variation.append(
                {
                    "source_word_id": word_id,
                    "writing": clean_text(word["word"]),
                    "areas": [
                        {
                            "usage_area": usage_area_label(area),
                            "readings": [reading_label(item) for item in sorted(readings)],
                        }
                        for area, readings in sorted(readings_by_area.items())
                    ],
                    "decision": "review_pronunciation_variation",
                }
            )
        for area, readings in readings_by_area.items():
            if len(readings) < 2:
                continue
            word = words_by_id[word_id]
            same_area_entry_split.append(
                {
                    "source_word_id": word_id,
                    "writing": clean_text(word["word"]),
                    "usage_area": usage_area_label(area),
                    "readings": [reading_label(item) for item in sorted(readings)],
                    "decision": "suggest_entry_split_review",
                }
            )

    sense_segmentation.sort(key=_candidate_sort_key)
    numbering_anomalies.sort(key=_candidate_sort_key)
    reading_variation.sort(key=_candidate_sort_key)
    same_area_entry_split.sort(key=_candidate_sort_key)

    valid_recording_word_ids = set(recordings_by_word)
    multi_recording_word_ids = {
        word_id for word_id, rows in recordings_by_word.items() if len(rows) > 1
    }
    cross_region_word_ids = {
        word_id
        for word_id, rows in recordings_by_word.items()
        if len({usage_area(row) for row in rows}) > 1
    }
    repeated_spelling_rows = sum(len(item["source_word_ids"]) for item in possible_duplicates)

    result = {
        "schema_version": 1,
        "source_database": path.name,
        "summary": {
            "legacy_entries": {
                "total": len(words),
                "visible": sum(_visible(row["visibility"]) for row in words),
                "hidden": sum(not _visible(row["visibility"]) for row in words),
                "with_recordings": len(valid_recording_word_ids),
                "without_recordings": len(words) - len(valid_recording_word_ids),
                "with_multiple_recordings": len(multi_recording_word_ids),
                "across_multiple_usage_areas": len(cross_region_word_ids),
                "empty_writing": sum(not clean_text(row["word"]) for row in words),
                "empty_definition": sum(not clean_text(row["definition"]) for row in words),
                "multi_numbered_definition": len(sense_segmentation),
                "numbering_anomalies": len(numbering_anomalies),
                "repeated_spelling_groups": len(possible_duplicates),
                "rows_in_repeated_spelling_groups": repeated_spelling_rows,
            },
            "legacy_recordings": {
                "total": len(recordings),
                "visible": sum(_visible(row["visibility"]) for row in recordings),
                "hidden": sum(not _visible(row["visibility"]) for row in recordings),
                "orphaned": len(orphan_recordings),
                "empty_source": sum(not clean_text(row["source"]) for row in recordings),
                "distinct_usage_areas": len({usage_area(row) for row in recordings}),
            },
            "standard_transcriptions": {
                "with_ipa": sum(bool(clean_text(row["standard_ipa"])) for row in words),
                "with_pinyin": sum(bool(clean_text(row["standard_pinyin"])) for row in words),
                "with_any": sum(
                    bool(clean_text(row["standard_ipa"]) or clean_text(row["standard_pinyin"]))
                    for row in words
                ),
                "with_neither": sum(
                    not (clean_text(row["standard_ipa"]) or clean_text(row["standard_pinyin"]))
                    for row in words
                ),
            },
            "review_candidates": {
                "sense_segmentation": len(sense_segmentation),
                "numbering_anomalies": len(numbering_anomalies),
                "pronunciation_variation": len(reading_variation),
                "same_area_entry_split": len(same_area_entry_split),
                "possible_duplicate": len(possible_duplicates),
            },
        },
        "candidates": {
            "sense_segmentation": sense_segmentation,
            "numbering_anomalies": numbering_anomalies,
            "pronunciation_variation": reading_variation,
            "same_area_entry_split": same_area_entry_split,
            "possible_duplicate": possible_duplicates,
            "orphan_recordings": [
                {
                    "source_recording_id": int(row["id"]),
                    "source_word_id": int(row["word_id"]),
                }
                for row in orphan_recordings
            ],
        },
    }
    return result


def _markdown_cell(value) -> str:
    return clean_text(value).replace("|", "\\|")


def render_markdown(result: dict, candidate_limit=20) -> str:
    summary = result["summary"]
    entries = summary["legacy_entries"]
    recordings = summary["legacy_recordings"]
    transcriptions = summary["standard_transcriptions"]
    review = summary["review_candidates"]
    candidates = result["candidates"]

    lines = [
        "# 兴化语记旧库词条审计",
        "",
        f"源文件：`{result['source_database']}`",
        "",
        "> 审计器以 SQLite 只读模式运行。以下项目都是待人工判断的候选，不会自动拆分、合并或修改数据。",
        "",
        "## 汇总",
        "",
        "| 项目 | 数量 |",
        "| --- | ---: |",
        f"| 旧词条 | {entries['total']} |",
        f"| 公开 / 隐藏词条 | {entries['visible']} / {entries['hidden']} |",
        f"| 有录音 / 无录音词条 | {entries['with_recordings']} / {entries['without_recordings']} |",
        f"| 拥有多条录音的词条 | {entries['with_multiple_recordings']} |",
        f"| 跨多个使用地区的词条 | {entries['across_multiple_usage_areas']} |",
        f"| 疑似多编号义词条 | {entries['multi_numbered_definition']} |",
        f"| 编号异常词条 | {entries['numbering_anomalies']} |",
        f"| 重复写法组 / 涉及旧记录 | {entries['repeated_spelling_groups']} / {entries['rows_in_repeated_spelling_groups']} |",
        f"| 空写法 / 空释义 | {entries['empty_writing']} / {entries['empty_definition']} |",
        f"| 旧录音 | {recordings['total']} |",
        f"| 公开 / 隐藏录音 | {recordings['visible']} / {recordings['hidden']} |",
        f"| 孤立录音 / 空音频来源 | {recordings['orphaned']} / {recordings['empty_source']} |",
        f"| 不同原始使用地区组合 | {recordings['distinct_usage_areas']} |",
        f"| 至少有一种标准转写 | {transcriptions['with_any']} |",
        f"| IPA / 拼音 / 两者皆无 | {transcriptions['with_ipa']} / {transcriptions['with_pinyin']} / {transcriptions['with_neither']} |",
        "",
        "## 待审核候选",
        "",
        "| 类型 | 数量 | 处理原则 |",
        "| --- | ---: | --- |",
        f"| 建议分义 | {review['sense_segmentation']} | 解析①②等编号，人工决定保留为分义或拆词条 |",
        f"| 编号异常 | {review['numbering_anomalies']} | 编号可能来自数量、OCR 或残缺格式，先修复原文结构 |",
        f"| 多地区或多读音 | {review['pronunciation_variation']} | 优先判断地区音变、文白异读或独立词条 |",
        f"| 同地多读音拆词条复核 | {review['same_area_entry_split']} | 不自动拆分，检查是否为不同词、不同读音身份或说话人差异 |",
        f"| 可能重复 | {review['possible_duplicate']} | 相同写法不等于同词，禁止自动合并 |",
        "",
        f"## 分义候选示例（前 {candidate_limit} 条）",
        "",
        "| 旧 ID | 写法 | 检出的编号 | 释义片段 |",
        "| ---: | --- | --- | --- |",
    ]
    for item in candidates["sense_segmentation"][:candidate_limit]:
        markers = " ".join(part["marker"] for part in item["segments"])
        definitions = " / ".join(
            f"{part['marker']}{part['text']}" for part in item["segments"]
        )
        lines.append(
            f"| {item['source_word_id']} | {_markdown_cell(item['writing'])} | "
            f"{markers} | {_markdown_cell(excerpt(definitions, 220))} |"
        )

    lines.extend(
        [
            "",
            f"## 同地多读音候选示例（前 {candidate_limit} 条）",
            "",
            "| 旧 ID | 写法 | 使用地区 | 读音 |",
            "| ---: | --- | --- | --- |",
        ]
    )
    for item in candidates["same_area_entry_split"][:candidate_limit]:
        lines.append(
            f"| {item['source_word_id']} | {_markdown_cell(item['writing'])} | "
            f"{_markdown_cell(item['usage_area'])} | {_markdown_cell('；'.join(item['readings']))} |"
        )

    lines.extend(
        [
            "",
            f"## 重复写法示例（前 {candidate_limit} 组）",
            "",
            "| 写法 | 旧 ID | 标准读音与释义片段 |",
            "| --- | --- | --- |",
        ]
    )
    for item in candidates["possible_duplicate"][:candidate_limit]:
        details = []
        for record in item["records"]:
            reading = record["standard_pinyin"] or record["standard_ipa"] or "未标音"
            details.append(
                f"#{record['source_word_id']} {reading}：{record['definition']}"
            )
        lines.append(
            f"| {_markdown_cell(item['writing'])} | "
            f"{', '.join(str(value) for value in item['source_word_ids'])} | "
            f"{_markdown_cell('；'.join(details))} |"
        )

    lines.extend(
        [
            "",
            "## 解释边界",
            "",
            "- 编号只是分义线索，可能表示子义、语法用法或例句分组。",
            "- 同写法可能是同词异写、同形异义或不同词源，必须结合释义、读音、地区和来源判断。",
            "- 同地多读音可能是文白异读、代际差异、录入差异或不同词条，审计器不作语言学裁决。",
            "- 无录音词条仍是有效词条，迁移时不得因缺少 `word_pronunciation` 而丢失。",
            "",
        ]
    )
    return "\n".join(lines)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="只读审计兴化语记旧词库")
    parser.add_argument("database", help="旧 SQLite 数据库路径")
    parser.add_argument(
        "--format",
        choices=("json", "markdown"),
        default="json",
        help="输出格式（默认 json）",
    )
    parser.add_argument(
        "--candidate-limit",
        type=int,
        default=20,
        help="Markdown 每类候选最多展示数量（默认 20）",
    )
    return parser


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)
    if args.candidate_limit < 0:
        raise SystemExit("--candidate-limit 不得小于 0")
    try:
        result = audit_database(args.database)
    except AuditError as exc:
        print(f"audit failed: {exc}", file=sys.stderr)
        return 2
    if args.format == "markdown":
        print(render_markdown(result, candidate_limit=args.candidate_limit))
    else:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
