import hashlib
import sqlite3
import tempfile
import unittest
from pathlib import Path

from tools.materials.puxian import audit_legacy_entries


SOURCE_SCHEMA = """
CREATE TABLE word_word (
    id INTEGER PRIMARY KEY, word TEXT, definition TEXT, annotation TEXT,
    mandarin TEXT, standard_ipa TEXT, standard_pinyin TEXT, visibility INTEGER,
    contributor_id INTEGER, tags TEXT
);
CREATE TABLE word_pronunciation (
    id INTEGER PRIMARY KEY, source TEXT, ipa TEXT, pinyin TEXT, county TEXT,
    town TEXT, visibility INTEGER, views INTEGER, contributor_id INTEGER,
    word_id INTEGER, verifier_id INTEGER, upload_time TEXT
);
"""


def file_hash(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


class LegacyEntryAuditTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.database_path = Path(self.directory.name) / "legacy.sqlite3"
        connection = sqlite3.connect(self.database_path)
        connection.executescript(SOURCE_SCHEMA)
        connection.executemany(
            "INSERT INTO word_word VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
                (1, "行", "①行走。②运行。", "", "[]", "xiŋ", "xing", 1, 1, "[]"),
                (2, "行", "行业；银行。", "", "[]", "haŋ", "hang", 0, 1, "[]"),
                (3, "走", "奔跑。", "", "[]", "", "", 1, 1, "[]"),
                (4, "空", "", "", "[]", "", "", 1, 1, "[]"),
            ],
        )
        connection.executemany(
            "INSERT INTO word_pronunciation VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
                (10, "a.mp3", "xiŋ", "xing", "莆田", "城里", 1, 1, 1, 1, None, "2020-01-01"),
                (11, "b.mp3", "seŋ", "seng", "莆田", "城里", 1, 1, 1, 1, None, "2020-01-02"),
                (12, "c.mp3", "siŋ", "sing", "仙游", "城关", 1, 1, 1, 1, None, "2020-01-03"),
                (13, "d.mp3", "haŋ", "hang", "莆田", "城里", 0, 1, 1, 2, None, "2020-01-04"),
                (14, "orphan.mp3", "", "", "莆田", "城里", 1, 1, 1, 999, None, "2020-01-05"),
            ],
        )
        connection.commit()
        connection.close()

    def test_audit_counts_and_candidate_categories(self):
        result = audit_legacy_entries.audit_database(self.database_path)
        entries = result["summary"]["legacy_entries"]
        recordings = result["summary"]["legacy_recordings"]
        transcriptions = result["summary"]["standard_transcriptions"]
        review = result["summary"]["review_candidates"]

        self.assertEqual(entries["total"], 4)
        self.assertEqual((entries["visible"], entries["hidden"]), (3, 1))
        self.assertEqual((entries["with_recordings"], entries["without_recordings"]), (2, 2))
        self.assertEqual(entries["with_multiple_recordings"], 1)
        self.assertEqual(entries["across_multiple_usage_areas"], 1)
        self.assertEqual(entries["multi_numbered_definition"], 1)
        self.assertEqual((entries["repeated_spelling_groups"], entries["rows_in_repeated_spelling_groups"]), (1, 2))
        self.assertEqual(entries["empty_definition"], 1)

        self.assertEqual(recordings["total"], 5)
        self.assertEqual((recordings["visible"], recordings["hidden"]), (4, 1))
        self.assertEqual(recordings["orphaned"], 1)
        self.assertEqual(transcriptions["with_any"], 2)
        self.assertEqual(review["sense_segmentation"], 1)
        self.assertEqual(review["numbering_anomalies"], 0)
        self.assertEqual(review["pronunciation_variation"], 1)
        self.assertEqual(review["same_area_entry_split"], 1)
        self.assertEqual(review["possible_duplicate"], 1)

        duplicate = result["candidates"]["possible_duplicate"][0]
        self.assertEqual(duplicate["writing"], "行")
        self.assertEqual(duplicate["source_word_ids"], [1, 2])

    def test_source_file_is_unchanged(self):
        before = file_hash(self.database_path)
        audit_legacy_entries.audit_database(self.database_path)
        after = file_hash(self.database_path)
        self.assertEqual(before, after)

    def test_markdown_is_a_reviewable_summary(self):
        result = audit_legacy_entries.audit_database(self.database_path)
        markdown = audit_legacy_entries.render_markdown(result, candidate_limit=1)
        self.assertIn("# 兴化语记旧库词条审计", markdown)
        self.assertIn("| 旧词条 | 4 |", markdown)
        self.assertIn("同地多读音候选", markdown)
        self.assertIn("| 行 | 1, 2 |", markdown)

    def test_missing_schema_is_rejected(self):
        invalid_path = Path(self.directory.name) / "invalid.sqlite3"
        sqlite3.connect(invalid_path).close()
        with self.assertRaises(audit_legacy_entries.AuditError):
            audit_legacy_entries.audit_database(invalid_path)


class NumberedSenseParserTest(unittest.TestCase):
    def test_requires_callers_to_decide_whether_segments_are_senses(self):
        segments = audit_legacy_entries.split_numbered_senses(
            "前言。①行走：例句。②运行：例句。③离开。"
        )
        self.assertEqual([item["marker"] for item in segments], ["①", "②", "③"])
        self.assertEqual(segments[0]["text"], "行走：例句。")

    def test_plain_definition_has_no_segments(self):
        self.assertEqual(audit_legacy_entries.split_numbered_senses("奔跑。"), [])


if __name__ == "__main__":
    unittest.main()
