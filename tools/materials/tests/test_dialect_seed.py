import json
import os
import tempfile
import unittest
from pathlib import Path

from tools.materials.dialect_seed import seed_dialects

SEED_JSON = Path(seed_dialects.__file__).resolve().parent / "dialects.json"
ALLOWED_FIELDS = {
    "key",
    "code",
    "name",
    "parent",
    "sort_order",
    "description",
    "aliases",
    "external_refs",
}


def _record(key, code, name, parent=None, sort_order=0, **extra):
    data = {
        "key": key,
        "code": code,
        "name": name,
        "parent": parent,
        "sort_order": sort_order,
    }
    data.update(extra)
    return data


class LoadRecordsTest(unittest.TestCase):
    def _write(self, suffix, content):
        handle = tempfile.NamedTemporaryFile(
            mode="w", suffix=suffix, delete=False, encoding="utf-8"
        )
        handle.write(content)
        handle.close()
        self.addCleanup(Path(handle.name).unlink)
        return handle.name

    def test_load_json_records(self):
        path = self._write(".json", json.dumps([_record("a", "甲", "甲方言")]))
        records = seed_dialects.load_records(path)
        self.assertEqual(records[0]["code"], "甲")

    def test_load_csv_records(self):
        path = self._write(".csv", "key,code,name,parent,sort_order\na,甲,甲方言,,10\n")
        records = seed_dialects.load_records(path)
        self.assertEqual(records[0]["name"], "甲方言")
        self.assertEqual(records[0]["sort_order"], "10")

    def test_unsupported_extension(self):
        path = self._write(".txt", "x")
        with self.assertRaises(seed_dialects.SeedError):
            seed_dialects.load_records(path)

    def test_invalid_json(self):
        path = self._write(".json", "{not json")
        with self.assertRaises(seed_dialects.SeedError):
            seed_dialects.load_records(path)

    def test_top_level_must_be_list(self):
        path = self._write(".json", json.dumps({"dialects": []}))
        with self.assertRaises(seed_dialects.SeedError):
            seed_dialects.load_records(path)


class ValidateRecordsTest(unittest.TestCase):
    def test_topological_ordering_with_shuffled_input(self):
        records = [
            _record("youyang", "游洋", "游洋", parent="xianyou"),
            _record("xianyou", "仙游", "仙游", parent="puxian"),
            _record("puxian", "莆仙", "莆仙片", parent="min"),
            _record("min", "闽", "闽语"),
        ]
        ordered, failed = seed_dialects.validate_records(records)
        self.assertEqual(
            [record["key"] for record in ordered],
            ["min", "puxian", "xianyou", "youyang"],
        )
        self.assertEqual(failed, [])

    def test_chinese_sibling_codes_form_qualified_path(self):
        records = [
            _record("min", "闽", "闽语"),
            _record("puxian", "莆仙", "莆仙片", parent="min"),
            _record("xianyou", "仙游", "仙游", parent="puxian"),
            _record("youyang", "游洋", "游洋", parent="xianyou"),
        ]
        ordered, failed = seed_dialects.validate_records(records)
        self.assertEqual(failed, [])
        self.assertEqual(
            seed_dialects.qualified_codes(ordered)["youyang"],
            "闽.莆仙.仙游.游洋",
        )

    def test_required_fields_are_validated(self):
        cases = [
            (_record("a", "甲", "  "), "缺少名称"),
            (_record("", "甲", "甲方言"), "缺少 source key"),
            (_record("a", "", "甲方言"), "缺少编码"),
        ]
        for record, expected in cases:
            ordered, failed = seed_dialects.validate_records([record])
            self.assertEqual(ordered, [])
            self.assertEqual(failed[0]["reason"], expected)

    def test_code_rejects_illegal_characters_and_excess_length(self):
        for bad_code in ("仙.游", "仙/游", "仙 游"):
            ordered, failed = seed_dialects.validate_records(
                [_record("a", bad_code, "甲方言")]
            )
            self.assertEqual(ordered, [])
            self.assertIn("非法字符", failed[0]["reason"])
        _, failed = seed_dialects.validate_records([_record("a", "长" * 33, "甲方言")])
        self.assertIn("超过 32 字符", failed[0]["reason"])

    def test_v1_optional_fields_are_normalized(self):
        ordered, failed = seed_dialects.validate_records(
            [
                _record(
                    "a",
                    "甲",
                    "甲方言",
                    sort_order="20",
                    aliases=["旧.甲"],
                    external_refs={"catalog": "A1"},
                )
            ]
        )
        self.assertEqual(failed, [])
        self.assertEqual(ordered[0]["sort_order"], 20)
        self.assertEqual(ordered[0]["aliases"], ["旧.甲"])
        self.assertEqual(ordered[0]["external_refs"], {"catalog": "A1"})

    def test_invalid_v1_optional_field_types_fail(self):
        cases = [
            (_record("a", "甲", "甲方言", sort_order="first"), "sort_order"),
            (_record("a", "甲", "甲方言", aliases="旧甲"), "aliases"),
            (_record("a", "甲", "甲方言", external_refs=[]), "external_refs"),
        ]
        for record, expected in cases:
            ordered, failed = seed_dialects.validate_records([record])
            self.assertEqual(ordered, [])
            self.assertIn(expected, failed[0]["reason"])

    def test_unknown_fields_fail_instead_of_being_ignored(self):
        ordered, failed = seed_dialects.validate_records(
            [_record("a", "甲", "甲方言", unexpected="value")]
        )
        self.assertEqual(ordered, [])
        self.assertEqual(failed[0]["reason"], "包含不支持的字段: unexpected")

    def test_duplicate_key_code_and_name_under_same_parent_fail(self):
        cases = [
            [
                _record("a", "甲", "甲方言"),
                _record("a", "乙", "乙方言"),
            ],
            [
                _record("root", "根", "方言根"),
                _record("a", "甲", "甲方言", parent="root"),
                _record("b", "甲", "乙方言", parent="root"),
            ],
            [
                _record("root", "根", "方言根"),
                _record("a", "甲", "同名", parent="root"),
                _record("b", "乙", "同名", parent="root"),
            ],
        ]
        for records in cases:
            _, failed = seed_dialects.validate_records(records)
            self.assertEqual(len(failed), 1)

    def test_same_code_under_different_branches_is_allowed(self):
        records = [
            _record("p1", "片一", "片一"),
            _record("p2", "片二", "片二"),
            _record("a", "城关", "城关（片一）", parent="p1"),
            _record("b", "城关", "城关（片二）", parent="p2"),
        ]
        ordered, failed = seed_dialects.validate_records(records)
        self.assertEqual(len(ordered), 4)
        self.assertEqual(failed, [])

    def test_missing_parent_and_cycle_fail(self):
        ordered, failed = seed_dialects.validate_records(
            [_record("a", "甲", "甲方言", parent="ghost")]
        )
        self.assertEqual(ordered, [])
        self.assertEqual(failed[0]["reason"], "父级不存在: ghost")

        ordered, failed = seed_dialects.validate_records(
            [
                _record("a", "甲", "甲方言", parent="b"),
                _record("b", "乙", "乙方言", parent="a"),
            ]
        )
        self.assertEqual(ordered, [])
        self.assertEqual({item["reason"] for item in failed}, {"父级引用成环"})

    def test_known_qualified_parent_resolves_external_parent(self):
        records = [_record("a", "游洋", "游洋", parent="闽.莆仙.仙游")]
        ordered, failed = seed_dialects.validate_records(
            records, known_parent_qualified=["闽.莆仙.仙游"]
        )
        self.assertEqual(failed, [])
        self.assertEqual(
            seed_dialects.qualified_codes(ordered)["a"], "闽.莆仙.仙游.游洋"
        )

    def test_child_of_invalid_record_fails(self):
        records = [
            _record("bad", "坏", "", sort_order="first"),
            _record("kid", "子", "子级", parent="bad"),
        ]
        ordered, failed = seed_dialects.validate_records(records)
        self.assertEqual(ordered, [])
        self.assertEqual(len(failed), 2)


class SeedFileTest(unittest.TestCase):
    def test_seed_file_is_v1_only_and_contains_key_path(self):
        records = seed_dialects.load_records(SEED_JSON)
        self.assertEqual(len(records), 56)
        self.assertTrue(all(set(record) <= ALLOWED_FIELDS for record in records))
        ordered, failed = seed_dialects.validate_records(records)
        self.assertEqual(failed, [])
        qualified = seed_dialects.qualified_codes(ordered)
        required = {
            "闽.莆仙",
            "闽.莆仙.莆田",
            "闽.莆仙.莆田.城里",
            "闽.莆仙.莆田.江口",
            "闽.莆仙.莆田.湄洲",
            "闽.莆仙.仙游",
            "闽.莆仙.仙游.城关",
            "闽.莆仙.仙游.游洋",
            "闽.莆仙.仙游.枫亭",
        }
        self.assertTrue(required.issubset(set(qualified.values())))


class SeedRecordsOrmTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls._tmpdir = tempfile.TemporaryDirectory()
        cls._previous_sqlite_path = os.environ.get("SQLITE_PATH")
        os.environ["SQLITE_PATH"] = os.path.join(
            cls._tmpdir.name, "dialect_seed_test.sqlite3"
        )
        try:
            cls.dialect_model = seed_dialects.setup_django()
        except Exception as exc:
            cls._restore_sqlite_path()
            cls._tmpdir.cleanup()
            raise unittest.SkipTest(f"Django 环境不可用: {exc}")
        from django.core.management import call_command

        call_command("migrate", run_syncdb=True, verbosity=0)

    @classmethod
    def _restore_sqlite_path(cls):
        if cls._previous_sqlite_path is None:
            os.environ.pop("SQLITE_PATH", None)
        else:
            os.environ["SQLITE_PATH"] = cls._previous_sqlite_path

    @classmethod
    def tearDownClass(cls):
        cls._restore_sqlite_path()
        cls._tmpdir.cleanup()
        super().tearDownClass()

    def setUp(self):
        self.dialect_model._meta.apps.get_model(
            "guantou", "DialectCircle"
        ).objects.all().delete()
        self.dialect_model.objects.all().delete()

    def test_dry_run_matches_real_run_and_repeat_is_idempotent(self):
        records = [
            _record("root", "根", "根", sort_order=10),
            _record("child", "子", "子", parent="root", sort_order=20),
        ]
        ordered, failed = seed_dialects.validate_records(records)
        self.assertEqual(failed, [])

        dry_report = seed_dialects.seed_records(
            ordered, self.dialect_model, dry_run=True
        )
        real_report = seed_dialects.seed_records(ordered, self.dialect_model)
        repeated = seed_dialects.seed_records(ordered, self.dialect_model)

        self.assertEqual(dry_report, {"created": 2, "skipped": 0, "failed": []})
        self.assertEqual(real_report, dry_report)
        self.assertEqual(repeated, {"created": 0, "skipped": 2, "failed": []})
        child = self.dialect_model.objects.get(code="子")
        self.assertEqual(child.sort_order, 20)

    def test_same_code_can_be_created_under_different_parents(self):
        records = [
            _record("p1", "片一", "片一"),
            _record("p2", "片二", "片二"),
            _record("a", "城关", "城关一", parent="p1"),
            _record("b", "城关", "城关二", parent="p2"),
        ]
        ordered, _ = seed_dialects.validate_records(records)
        report = seed_dialects.seed_records(ordered, self.dialect_model)
        self.assertEqual(report, {"created": 4, "skipped": 0, "failed": []})
        self.assertEqual(self.dialect_model.objects.filter(code="城关").count(), 2)

    def test_sibling_code_conflict_matches_in_dry_run_and_real_run(self):
        root = self.dialect_model.objects.create(name="根", code="根")
        self.dialect_model.objects.create(name="原名", code="冲突", parent=root)
        records = [_record("new", "冲突", "新名", parent="根")]
        ordered, failed = seed_dialects.validate_records(
            records, known_parent_qualified=["根"]
        )
        self.assertEqual(failed, [])

        dry_report = seed_dialects.seed_records(
            ordered, self.dialect_model, dry_run=True
        )
        real_report = seed_dialects.seed_records(ordered, self.dialect_model)

        self.assertEqual(dry_report, real_report)
        self.assertEqual(len(real_report["failed"]), 1)
        self.assertIn("同级编码", real_report["failed"][0]["reason"])

    def test_same_name_with_different_code_fails_without_overwrite(self):
        self.dialect_model.objects.create(name="已有", code="旧")
        ordered, _ = seed_dialects.validate_records([_record("new", "新", "已有")])
        report = seed_dialects.seed_records(ordered, self.dialect_model)
        self.assertEqual(len(report["failed"]), 1)
        self.assertEqual(self.dialect_model.objects.get(name="已有").code, "旧")

    def test_parent_reference_by_existing_qualified_code(self):
        root = self.dialect_model.objects.create(name="闽语", code="闽")
        puxian = self.dialect_model.objects.create(
            name="莆仙片", code="莆仙", parent=root
        )
        xianyou = self.dialect_model.objects.create(
            name="仙游", code="仙游", parent=puxian
        )
        known = seed_dialects.existing_qualified_codes(self.dialect_model)
        records = [_record("youyang", "游洋", "游洋", parent="闽.莆仙.仙游")]
        ordered, failed = seed_dialects.validate_records(
            records, known_parent_qualified=known
        )
        self.assertEqual(failed, [])

        report = seed_dialects.seed_records(ordered, self.dialect_model)
        self.assertEqual(report, {"created": 1, "skipped": 0, "failed": []})
        self.assertEqual(
            self.dialect_model.objects.get(code="游洋").parent_id, xianyou.id
        )

    def test_bundled_seed_imports_with_stable_order_and_qualified_code(self):
        records = seed_dialects.load_records(SEED_JSON)
        ordered, failed = seed_dialects.validate_records(records)
        self.assertEqual(failed, [])

        report = seed_dialects.seed_records(ordered, self.dialect_model)
        repeated = seed_dialects.seed_records(ordered, self.dialect_model)

        self.assertEqual(report, {"created": 56, "skipped": 0, "failed": []})
        self.assertEqual(repeated, {"created": 0, "skipped": 56, "failed": []})
        youyang = self.dialect_model.objects.get(code="游洋")
        self.assertEqual(youyang.qualified_code, "闽.莆仙.仙游.游洋")
        min_root = self.dialect_model.objects.get(code="闽")
        self.assertEqual(
            list(min_root.children.values_list("code", flat=True)),
            ["莆仙", "闽东", "闽南"],
        )


if __name__ == "__main__":
    unittest.main()
