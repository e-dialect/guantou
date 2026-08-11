import ast
import hashlib
import json
import sqlite3
from collections import defaultdict
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path

from django.contrib.auth import SESSION_KEY
from django.contrib.auth.models import User
from django.contrib.sessions.models import Session
from django.db import models, transaction
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime

from user.models import UserInfo
from user.verification import normalize_email, normalize_phone

from .models import (
    Can,
    Dialect,
    Flavor,
    FlavorPackage,
    LegacyImportRecord,
    Nameplate,
    Package,
    Pronunciation,
)

SOURCE_SYSTEM = "hinghwa-dict-backend"
DEMO_DIALECT_CODES = (
    "闽.莆仙.莆田.城里",
    "闽.莆仙.莆田.江口",
    "闽.莆仙.莆田.湄洲",
    "闽.莆仙.仙游.城关",
    "闽.莆仙.仙游.枫亭",
)
REQUIRED_SOURCE_COLUMNS = {
    "auth_user": {
        "id",
        "password",
        "last_login",
        "is_superuser",
        "username",
        "email",
        "is_staff",
        "is_active",
        "date_joined",
    },
    "user_userinfo": {
        "user_id",
        "wechat",
        "nickname",
        "birthday",
        "telephone",
        "avatar",
        "county",
        "town",
        "points_now",
        "points_sum",
    },
    "word_word": {
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
    },
    "word_pronunciation": {
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
    },
}

PUTIAN_COUNTIES = {
    "城厢区",
    "荔城区",
    "涵江区",
    "涵江",
    "秀屿区",
    "莆田市",
    "莆田",
}
XIANYOU_COUNTIES = {"仙游县", "仙游"}


@contextmanager
def open_legacy_database(path):
    source = Path(path).expanduser().resolve()
    if not source.is_file():
        raise ValueError(f"源数据库不存在: {source}")
    connection = sqlite3.connect(f"file:{source}?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    try:
        yield connection
    finally:
        connection.close()


def safe_legacy_list(value):
    if isinstance(value, list):
        return value
    text = str(value or "").strip()
    if not text:
        return []
    try:
        parsed = ast.literal_eval(text)
    except (ValueError, SyntaxError):
        return [text]
    return [str(item) for item in parsed] if isinstance(parsed, (list, tuple)) else []


def normalize_legacy_location(county, town, *, for_user=False):
    county = str(county or "").strip()
    town = str(town or "").strip()
    legacy = {"county": county, "town": town}
    if county in XIANYOU_COUNTIES:
        branch = "闽.莆仙.仙游"
        street = "城关"
    elif county in PUTIAN_COUNTIES:
        branch = "闽.莆仙.莆田"
        street = "城里"
    else:
        return {
            "qualified_code": None if for_user else "闽.莆仙",
            "legacy": legacy,
            "reason": "unrecognized_location",
        }

    if not town or town == "-" or town.endswith("区"):
        return {
            "qualified_code": branch,
            "legacy": legacy,
            "reason": "branch_fallback",
        }
    if town.endswith("街道"):
        leaf = street
    elif town.endswith(("乡", "镇")):
        leaf = town[:-1]
    else:
        leaf = town
    return {
        "qualified_code": f"{branch}.{leaf}",
        "legacy": legacy,
        "reason": "mapped",
    }


def resolve_dialect(qualified_code):
    if not qualified_code:
        return None
    parent = None
    for code in qualified_code.split("."):
        parent = Dialect.objects.filter(parent=parent, code=code).first()
        if parent is None:
            return None
    return parent


def row_fingerprint(row):
    payload = {key: row[key] for key in row.keys()}
    encoded = json.dumps(payload, ensure_ascii=False, sort_keys=True, default=str)
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def parse_legacy_datetime(value):
    if isinstance(value, datetime):
        parsed = value
    else:
        parsed = parse_datetime(str(value or ""))
    if parsed is not None and timezone.is_naive(parsed):
        parsed = timezone.make_aware(parsed, timezone.get_default_timezone())
    return parsed


def account_priority(*, is_staff, is_superuser, last_login):
    parsed_login = parse_legacy_datetime(last_login)
    return (
        bool(is_staff or is_superuser),
        parsed_login.timestamp() if parsed_login else float("-inf"),
    )


def invalidate_user_sessions(user_id):
    for session in Session.objects.filter(expire_date__gt=timezone.now()):
        try:
            session_user_id = session.get_decoded().get(SESSION_KEY)
        except Exception:
            continue
        if str(session_user_id) == str(user_id):
            session.delete()


def validate_source_schema(connection):
    integrity = connection.execute("PRAGMA integrity_check").fetchone()[0]
    if integrity != "ok":
        raise ValueError(f"源数据库完整性检查失败: {integrity}")
    failures = []
    for table, required in REQUIRED_SOURCE_COLUMNS.items():
        columns = {
            row["name"]
            for row in connection.execute(f'PRAGMA table_info("{table}")').fetchall()
        }
        missing = sorted(required - columns)
        if missing:
            failures.append(f"{table}: {', '.join(missing)}")
    if failures:
        raise ValueError("源数据库缺少必要列: " + "; ".join(failures))


class HinghwaImporter:
    def __init__(self, connection, *, apply=False, limit=None):
        self.connection = connection
        self.apply = apply
        self.limit = limit
        self.user_map = {}
        self.word_map = {}
        self.report = {
            "mode": "apply" if apply else "dry-run",
            "source": SOURCE_SYSTEM,
            "source_counts": {},
            "created": defaultdict(int),
            "skipped": defaultdict(int),
            "merged": [],
            "normalized": defaultdict(int),
            "conflicts": [],
            "unknown_locations": defaultdict(int),
            "failed": [],
        }
        validate_source_schema(connection)
        self.users = self._load_users()
        self.user_by_id = {row["id"]: row for row in self.users}
        self.duplicate_emails = self._duplicate_emails()
        self.user_groups = self._build_user_groups()

    def _load_users(self):
        return self.connection.execute("""
            SELECT u.*, i.wechat, i.qq, i.nickname, i.birthday, i.telephone,
                   i.avatar, i.county, i.town, i.points_now, i.points_sum
            FROM auth_user u
            JOIN user_userinfo i ON i.user_id = u.id
            ORDER BY u.id
            """).fetchall()

    def _duplicate_emails(self):
        grouped = defaultdict(list)
        for row in self.users:
            email = normalize_email(row["email"])
            if email:
                grouped[email].append(row["id"])
        return {email for email, ids in grouped.items() if len(ids) > 1}

    def _source_priority(self, row):
        return account_priority(
            is_staff=bool(row["is_staff"]),
            is_superuser=bool(row["is_superuser"]),
            last_login=row["last_login"],
        )

    def _source_survivor_key(self, row):
        return (
            *self._source_priority(row),
            bool(str(row["wechat"] or "").strip()),
            -int(row["id"]),
        )

    def _source_wins_target(self, row, target_user):
        target_priority = account_priority(
            is_staff=target_user.is_staff,
            is_superuser=target_user.is_superuser,
            last_login=target_user.last_login,
        )
        return self._source_priority(row) > target_priority

    def _build_user_groups(self):
        by_phone = defaultdict(list)
        singles = []
        for row in self.users:
            phone = normalize_phone(row["telephone"])
            if phone:
                by_phone[phone].append(row)
            else:
                singles.append([row])
        groups = list(singles)
        for phone, rows in by_phone.items():
            if len(rows) == 1:
                groups.append(rows)
                continue
            survivor = max(rows, key=self._source_survivor_key)
            groups.append(
                [survivor, *[row for row in rows if row["id"] != survivor["id"]]]
            )
        return sorted(groups, key=lambda rows: rows[0]["id"])

    def _source_count(self, table):
        return self.connection.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0]

    def analyze(self):
        for table in REQUIRED_SOURCE_COLUMNS:
            self.report["source_counts"][table] = self._source_count(table)
        self.report["normalized"]["duplicate_email_accounts"] = sum(
            1
            for row in self.users
            if normalize_email(row["email"]) in self.duplicate_emails
        )
        self.report["normalized"]["internal_phone_merge_groups"] = sum(
            1 for rows in self.user_groups if len(rows) > 1
        )
        target_infos_by_phone = {
            normalize_phone(info.telephone): info
            for info in UserInfo.objects.select_related("user").exclude(telephone="")
        }
        target_phones = set(target_infos_by_phone)
        pending_groups = [
            rows
            for rows in self.user_groups
            if not all(self._ledger("auth_user", row["id"]) for row in rows)
        ]
        completed_target_merges = (
            LegacyImportRecord.objects.filter(
                source_system=SOURCE_SYSTEM,
                source_table="auth_user",
                action="merged_target_phone",
            )
            .values("target_id")
            .distinct()
            .count()
        )
        self.report["normalized"]["target_phone_merges"] = (
            completed_target_merges
            + sum(
                1
                for rows in pending_groups
                if normalize_phone(rows[0]["telephone"]) in target_phones
            )
        )
        target_usernames = set(User.objects.values_list("username", flat=True))
        target_emails = {
            normalize_email(value)
            for value in User.objects.exclude(email="").values_list("email", flat=True)
        }
        target_wechats = set(
            UserInfo.objects.exclude(wechat="").values_list("wechat", flat=True)
        )
        for rows in pending_groups:
            survivor = rows[0]
            target_info = target_infos_by_phone.get(
                normalize_phone(survivor["telephone"])
            )
            if target_info:
                if self._source_wins_target(survivor, target_info.user):
                    self.report["normalized"]["source_identity_wins"] += 1
                    conflict = self._identity_conflict(survivor, target_info.user)
                    if conflict:
                        self._add_conflict(rows, conflict)
                continue
            email = normalize_email(survivor["email"])
            if email in self.duplicate_emails:
                email = ""
            reason = None
            if survivor["username"] in target_usernames:
                reason = "username"
            elif str(survivor["wechat"] or "").strip() in target_wechats:
                reason = "wechat"
            elif email and email in target_emails:
                reason = "email"
            if reason:
                self._add_conflict(rows, reason)
        for row in self.users:
            mapping = normalize_legacy_location(
                row["county"], row["town"], for_user=True
            )
            if mapping["reason"] == "unrecognized_location":
                key = f"{row['county']}|{row['town']}"
                self.report["unknown_locations"][key] += 1
        pronunciation_locations = self.connection.execute(
            "SELECT county, town, COUNT(*) AS count FROM word_pronunciation "
            "GROUP BY county, town"
        ).fetchall()
        for row in pronunciation_locations:
            mapping = normalize_legacy_location(row["county"], row["town"])
            if mapping["reason"] != "mapped":
                key = f"{row['county']}|{row['town']}->{mapping['qualified_code']}"
                self.report["unknown_locations"][key] += row["count"]
            if resolve_dialect(mapping["qualified_code"]) is None:
                self.report["failed"].append(
                    {
                        "table": "word_pronunciation",
                        "location": f"{row['county']}|{row['town']}",
                        "reason": "dialect_unmapped",
                        "affected": row["count"],
                    }
                )
        return self.final_report()

    def _add_conflict(self, rows, reason):
        item = {"source_ids": [row["id"] for row in rows], "reason": reason}
        if item not in self.report["conflicts"]:
            self.report["conflicts"].append(item)

    def _ledger(self, table, source_id):
        return LegacyImportRecord.objects.filter(
            source_system=SOURCE_SYSTEM,
            source_table=table,
            source_id=str(source_id),
        ).first()

    def _record_ledger(
        self,
        table,
        row,
        target,
        *,
        action="created",
        metadata=None,
    ):
        return LegacyImportRecord.objects.create(
            source_system=SOURCE_SYSTEM,
            source_table=table,
            source_id=str(row["id"]),
            target_model=target._meta.label,
            target_id=target.pk,
            fingerprint=row_fingerprint(row),
            action=action,
            metadata=metadata or {},
        )

    def _existing_user_mapping(self, source_id):
        ledger = self._ledger("auth_user", source_id)
        if ledger:
            self.user_map[source_id] = ledger.target_id
            return ledger.target_id
        return None

    def _source_email(self, row):
        email = normalize_email(row["email"])
        return "" if email in self.duplicate_emails else email

    def _identity_conflict(self, row, target_user):
        if User.objects.exclude(pk=target_user.pk).filter(username=row["username"]):
            return "username"
        email = self._source_email(row)
        if email and User.objects.exclude(pk=target_user.pk).filter(
            email__iexact=email
        ):
            return "email"
        wechat = str(row["wechat"] or "").strip()
        if wechat and UserInfo.objects.exclude(user=target_user).filter(wechat=wechat):
            return "wechat"
        qq = str(row["qq"] or "").strip()
        if qq and UserInfo.objects.exclude(user=target_user).filter(qq=qq):
            return "qq"
        return None

    def _adopt_source_identity(self, target_info, row):
        user = target_info.user
        invalidate_user_sessions(user.pk)
        user.password = row["password"]
        user.last_login = parse_legacy_datetime(row["last_login"])
        user.is_superuser = bool(row["is_superuser"])
        user.username = row["username"]
        user.first_name = row["first_name"]
        user.last_name = row["last_name"]
        user.email = self._source_email(row)
        user.is_staff = bool(row["is_staff"])
        user.is_active = bool(row["is_active"])
        user.date_joined = (
            parse_legacy_datetime(row["date_joined"])
            or user.date_joined
            or timezone.now()
        )
        user.save(
            update_fields=[
                "password",
                "last_login",
                "is_superuser",
                "username",
                "first_name",
                "last_name",
                "email",
                "is_staff",
                "is_active",
                "date_joined",
            ]
        )
        user.groups.clear()
        user.user_permissions.clear()

        location = normalize_legacy_location(row["county"], row["town"], for_user=True)
        primary_dialect = resolve_dialect(location["qualified_code"])
        birthday_text = str(row["birthday"] or "").strip()
        avatar = str(row["avatar"] or "").strip()
        target_info.wechat = str(row["wechat"] or "").strip()
        target_info.qq = str(row["qq"] or "").strip()
        target_info.nickname = row["nickname"] or row["username"]
        target_info.birthday = (
            None if birthday_text == "1970-01-01" else parse_date(birthday_text)
        )
        target_info.avatar = "" if "默认头像" in avatar else avatar
        target_info.primary_dialect = primary_dialect
        target_info.legacy_location = location["legacy"]
        target_info.save(
            update_fields=[
                "wechat",
                "qq",
                "nickname",
                "birthday",
                "avatar",
                "primary_dialect",
                "legacy_location",
                "updated_at",
            ]
        )
        if primary_dialect:
            target_info.followed_dialects.add(primary_dialect)

    def _repair_completed_user_group(self, rows):
        ledgers = [self._ledger("auth_user", row["id"]) for row in rows]
        if not ledgers or any(ledger is None for ledger in ledgers):
            return False
        if any(
            ledger.fingerprint != row_fingerprint(row)
            for ledger, row in zip(ledgers, rows, strict=True)
        ):
            self._add_conflict(rows, "source_changed_after_import")
            return False
        target_ids = {ledger.target_id for ledger in ledgers}
        if len(target_ids) != 1:
            return False
        target_info = (
            UserInfo.objects.select_related("user")
            .filter(user_id=target_ids.pop())
            .first()
        )
        if target_info is None:
            self._add_conflict(rows, "mapped_target_missing")
            return False
        survivor = rows[0]
        if target_info.user.username == survivor["username"]:
            return False
        if not self._source_wins_target(survivor, target_info.user):
            return False
        conflict = self._identity_conflict(survivor, target_info.user)
        if conflict:
            self._add_conflict(rows, conflict)
            return False
        with transaction.atomic():
            self._adopt_source_identity(target_info, survivor)
            for ledger in ledgers:
                metadata = dict(ledger.metadata or {})
                metadata.update(
                    {
                        "identity_winner": "source",
                        "privileges_inherited": True,
                        "repair_applied": True,
                    }
                )
                ledger.metadata = metadata
                ledger.save(update_fields=["metadata", "updated_at"])
        self.report["normalized"]["account_identity_repairs"] += 1
        return True

    def import_users(self):
        groups = self.user_groups[: self.limit] if self.limit else self.user_groups
        for rows in groups:
            if all(self._existing_user_mapping(row["id"]) for row in rows):
                self._repair_completed_user_group(rows)
                for row in rows:
                    ledger = self._ledger("auth_user", row["id"])
                    metadata = dict(ledger.metadata or {})
                    email_cleared = (
                        normalize_email(row["email"]) in self.duplicate_emails
                    )
                    if metadata.get("email_cleared") != email_cleared:
                        metadata["email_cleared"] = email_cleared
                        ledger.metadata = metadata
                        ledger.save(update_fields=["metadata", "updated_at"])
                self.report["skipped"]["users"] += len(rows)
                continue
            survivor = rows[0]
            phone = normalize_phone(survivor["telephone"])
            target_info = (
                UserInfo.objects.select_related("user").filter(telephone=phone).first()
                if phone
                else None
            )
            if target_info:
                source_wins = self._source_wins_target(survivor, target_info.user)
                if source_wins:
                    conflict = self._identity_conflict(survivor, target_info.user)
                    if conflict:
                        self._add_conflict(rows, conflict)
                        continue
                with transaction.atomic():
                    points_now = sum(int(row["points_now"] or 0) for row in rows)
                    points_sum = sum(int(row["points_sum"] or 0) for row in rows)
                    target_info.points_now += points_now
                    target_info.points_sum += points_sum
                    target_info.save(
                        update_fields=["points_now", "points_sum", "updated_at"]
                    )
                    for row in rows:
                        self._record_ledger(
                            "auth_user",
                            row,
                            target_info.user,
                            action="merged_target_phone",
                            metadata={
                                "identity_winner": (
                                    "source" if source_wins else "target"
                                ),
                                "privileges_inherited": source_wins,
                                "email_cleared": normalize_email(row["email"])
                                in self.duplicate_emails,
                                "retired_login": (
                                    source_wins and row["id"] != survivor["id"]
                                ),
                            },
                        )
                        self.user_map[row["id"]] = target_info.user_id
                    if source_wins:
                        self._adopt_source_identity(target_info, survivor)
                self.report["merged"].append(
                    {
                        "source_ids": [row["id"] for row in rows],
                        "target_id": target_info.user_id,
                        "reason": "target_phone_match",
                        "identity_winner": "source" if source_wins else "target",
                    }
                )
                continue

            username_conflict = User.objects.filter(
                username=survivor["username"]
            ).first()
            wechat = str(survivor["wechat"] or "").strip()
            wechat_conflict = (
                UserInfo.objects.filter(wechat=wechat).first() if wechat else None
            )
            email = normalize_email(survivor["email"])
            if email in self.duplicate_emails:
                email = ""
                self.report["normalized"]["emails_cleared"] += 1
            email_conflict = (
                User.objects.filter(email__iexact=email).first() if email else None
            )
            if username_conflict or wechat_conflict or email_conflict:
                self._add_conflict(
                    rows,
                    (
                        "username"
                        if username_conflict
                        else "wechat" if wechat_conflict else "email"
                    ),
                )
                continue

            location = normalize_legacy_location(
                survivor["county"], survivor["town"], for_user=True
            )
            primary_dialect = resolve_dialect(location["qualified_code"])
            birthday_text = str(survivor["birthday"] or "").strip()
            birthday = (
                None if birthday_text == "1970-01-01" else parse_date(birthday_text)
            )
            avatar = str(survivor["avatar"] or "").strip()
            if "默认头像" in avatar:
                avatar = ""
            with transaction.atomic():
                user = User.objects.create(
                    password=survivor["password"],
                    last_login=parse_legacy_datetime(survivor["last_login"]),
                    is_superuser=bool(survivor["is_superuser"]),
                    username=survivor["username"],
                    first_name=survivor["first_name"],
                    last_name=survivor["last_name"],
                    email=email,
                    is_staff=bool(survivor["is_staff"]),
                    is_active=bool(survivor["is_active"]),
                    date_joined=parse_legacy_datetime(survivor["date_joined"])
                    or timezone.now(),
                )
                info = UserInfo.objects.create(
                    user=user,
                    wechat=wechat,
                    qq=str(survivor["qq"] or "").strip(),
                    nickname=survivor["nickname"] or survivor["username"],
                    birthday=birthday,
                    telephone=phone,
                    avatar=avatar,
                    primary_dialect=primary_dialect,
                    legacy_location=location["legacy"],
                    points_now=sum(int(row["points_now"] or 0) for row in rows),
                    points_sum=sum(int(row["points_sum"] or 0) for row in rows),
                )
                if primary_dialect:
                    info.followed_dialects.add(primary_dialect)
                for index, row in enumerate(rows):
                    action = "created" if index == 0 else "merged_source_phone"
                    self._record_ledger(
                        "auth_user",
                        row,
                        user,
                        action=action,
                        metadata={
                            "email_cleared": normalize_email(row["email"])
                            in self.duplicate_emails,
                            "retired_login": index > 0,
                        },
                    )
                    self.user_map[row["id"]] = user.id
            self.report["created"]["users"] += 1
            if len(rows) > 1:
                self.report["merged"].append(
                    {
                        "source_ids": [row["id"] for row in rows],
                        "target_id": user.id,
                        "reason": "source_phone_duplicate",
                    }
                )

    def _user(self, source_id):
        if source_id is None:
            return None
        target_id = self.user_map.get(source_id) or self._existing_user_mapping(
            source_id
        )
        return User.objects.filter(pk=target_id).first() if target_id else None

    def _existing_word_mapping(self, source_id):
        ledger = self._ledger("word_word", source_id)
        if ledger:
            self.word_map[source_id] = ledger.target_id
            return ledger.target_id
        return None

    def import_words(self):
        query = "SELECT * FROM word_word ORDER BY id"
        params = []
        if self.limit:
            query += " LIMIT ?"
            params.append(self.limit)
        rows = self.connection.execute(query, params).fetchall()
        city_dialect = resolve_dialect("闽.莆仙.莆田.城里")
        if city_dialect is None:
            raise RuntimeError("缺少方言节点: 闽.莆仙.莆田.城里")
        for row in rows:
            if self._existing_word_mapping(row["id"]):
                self.report["skipped"]["words"] += 1
                continue
            creator = self._user(row["contributor_id"])
            if creator is None:
                self.report["failed"].append(
                    {
                        "table": "word_word",
                        "source_id": row["id"],
                        "reason": "user_unmapped",
                    }
                )
                continue
            with transaction.atomic():
                package, package_created = Package.objects.get_or_create(
                    text=row["word"],
                    package_type=Package.PackageType.UNCERTAIN,
                    defaults={"metadata": {"legacy_hinghwa_word_ids": [row["id"]]}},
                )
                if not package_created:
                    metadata = dict(package.metadata or {})
                    ids = list(metadata.get("legacy_hinghwa_word_ids", []))
                    if row["id"] not in ids:
                        ids.append(row["id"])
                        metadata["legacy_hinghwa_word_ids"] = ids
                        package.metadata = metadata
                        package.save(update_fields=["metadata", "updated_at"])
                flavor = Flavor.objects.create(
                    name=row["word"],
                    definition=row["definition"],
                    mandarin=safe_legacy_list(row["mandarin"]),
                    tags=safe_legacy_list(row["tags"]),
                    created_by=creator,
                    visibility=bool(row["visibility"]),
                    metadata={
                        "legacy": {
                            "system": SOURCE_SYSTEM,
                            "table": "word_word",
                            "id": row["id"],
                            "annotation": row["annotation"],
                            "standard_ipa": row["standard_ipa"],
                            "standard_pinyin": row["standard_pinyin"],
                        }
                    },
                )
                FlavorPackage.objects.create(
                    flavor=flavor,
                    package=package,
                    mapping_type=FlavorPackage.MappingType.PRIMARY,
                    note="兴化语记旧库字头",
                )
                standard_pronunciation = None
                if str(row["standard_ipa"] or "").strip():
                    standard_pronunciation = Pronunciation.objects.create(
                        flavor=flavor,
                        package=package,
                        dialect=city_dialect,
                        ipa=str(row["standard_ipa"]).strip(),
                        surface_romanization=str(row["standard_pinyin"] or "").strip(),
                        usage_note=str(row["annotation"] or "").strip(),
                        reading_type=Pronunciation.ReadingType.GENERAL,
                        is_canonical=True,
                        status=(
                            Pronunciation.Status.VERIFIED
                            if row["visibility"]
                            else Pronunciation.Status.DRAFT
                        ),
                        source_citation=f"{SOURCE_SYSTEM}:word_word:{row['id']}",
                        created_by=creator,
                    )
                self._record_ledger(
                    "word_word",
                    row,
                    flavor,
                    metadata={
                        "package_id": package.id,
                        "standard_pronunciation_id": (
                            standard_pronunciation.id
                            if standard_pronunciation
                            else None
                        ),
                    },
                )
                self.word_map[row["id"]] = flavor.id
            self.report["created"]["words"] += 1
            self.report["created"]["packages"] += int(package_created)
            self.report["created"]["standard_pronunciations"] += int(
                standard_pronunciation is not None
            )

    def import_recordings(self):
        query = "SELECT * FROM word_pronunciation ORDER BY id"
        params = []
        if self.limit:
            query += " LIMIT ?"
            params.append(self.limit)
        rows = self.connection.execute(query, params).fetchall()
        for row in rows:
            ledger = self._ledger("word_pronunciation", row["id"])
            if ledger:
                self.report["skipped"]["recordings"] += 1
                continue
            word_ledger = self._ledger("word_word", row["word_id"])
            if word_ledger is None:
                self.report["failed"].append(
                    {
                        "table": "word_pronunciation",
                        "source_id": row["id"],
                        "reason": "word_unmapped",
                    }
                )
                continue
            flavor = Flavor.objects.get(pk=word_ledger.target_id)
            package_id = word_ledger.metadata["package_id"]
            package = Package.objects.get(pk=package_id)
            recorder = self._user(row["contributor_id"])
            verifier = self._user(row["verifier_id"])
            if recorder is None:
                self.report["failed"].append(
                    {
                        "table": "word_pronunciation",
                        "source_id": row["id"],
                        "reason": "recorder_unmapped",
                    }
                )
                continue
            location = normalize_legacy_location(row["county"], row["town"])
            dialect = resolve_dialect(location["qualified_code"])
            if dialect is None:
                self.report["failed"].append(
                    {
                        "table": "word_pronunciation",
                        "source_id": row["id"],
                        "reason": "dialect_unmapped",
                    }
                )
                continue
            ipa = str(row["ipa"] or "").strip()
            romanization = str(row["pinyin"] or "").strip()
            with transaction.atomic():
                pronunciation = Pronunciation.objects.filter(
                    flavor=flavor,
                    package=package,
                    dialect=dialect,
                    ipa=ipa,
                    surface_romanization=romanization,
                    reading_type=Pronunciation.ReadingType.GENERAL,
                ).first()
                pronunciation_created = pronunciation is None
                if pronunciation is None:
                    pronunciation = Pronunciation.objects.create(
                        flavor=flavor,
                        package=package,
                        dialect=dialect,
                        ipa=ipa,
                        surface_romanization=romanization,
                        reading_type=Pronunciation.ReadingType.GENERAL,
                        is_canonical=False,
                        status=(
                            Pronunciation.Status.VERIFIED
                            if row["verifier_id"]
                            else Pronunciation.Status.DRAFT
                        ),
                        source_citation=(
                            f"{SOURCE_SYSTEM}:word_pronunciation:{row['id']}"
                        ),
                        created_by=recorder,
                    )
                concept = (flavor.mandarin or [flavor.name])[0]
                can = Can.objects.create(
                    audio_url=row["source"],
                    recorder=recorder,
                    submitted_dialect=dialect,
                    concept_text=str(concept)[:200],
                    source_note=f"兴化语记旧库录音 #{row['id']}",
                    status=(
                        Can.Status.VERIFIED
                        if row["verifier_id"]
                        else Can.Status.PENDING
                    ),
                    visibility=bool(row["visibility"]),
                    verifier=verifier,
                    views=max(0, int(row["views"] or 0)),
                    metadata={
                        "legacy": {
                            "system": SOURCE_SYSTEM,
                            "table": "word_pronunciation",
                            "id": row["id"],
                            "word_id": row["word_id"],
                        },
                        "legacy_location": location["legacy"],
                        "location_mapping": location["reason"],
                    },
                )
                Nameplate.objects.create(
                    can=can,
                    flavor=flavor,
                    package=package,
                    dialect=dialect,
                    pronunciation=pronunciation,
                    creator=recorder,
                    text_content=package.text,
                    definition=flavor.definition,
                    pronunciation_text=romanization or ipa,
                    evidence_level=(
                        Nameplate.EvidenceLevel.COMMUNITY
                        if row["verifier_id"]
                        else Nameplate.EvidenceLevel.MEMORY
                    ),
                    source={
                        "type": Nameplate.SourceType.ARCHIVE,
                        "system": SOURCE_SYSTEM,
                        "legacy_pronunciation_id": row["id"],
                    },
                    status=Nameplate.Status.ACTIVE,
                    weight=100 if row["verifier_id"] else 0,
                    is_primary=True,
                )
                upload_time = parse_legacy_datetime(row["upload_time"])
                if upload_time:
                    Can.objects.filter(pk=can.pk).update(
                        created_at=upload_time, updated_at=upload_time
                    )
                self._record_ledger(
                    "word_pronunciation",
                    row,
                    can,
                    metadata={"pronunciation_id": pronunciation.id},
                )
            self.report["created"]["recordings"] += 1
            self.report["created"]["recorded_pronunciations"] += int(
                pronunciation_created
            )

    def run(self):
        self.analyze()
        if not self.apply:
            return self.final_report()
        self.import_users()
        self.import_words()
        self.import_recordings()
        return self.final_report()

    def final_report(self):
        report = dict(self.report)
        for key in ("created", "skipped", "normalized", "unknown_locations"):
            report[key] = dict(report[key])
        ledger_actions = defaultdict(lambda: defaultdict(int))
        for item in (
            LegacyImportRecord.objects.filter(source_system=SOURCE_SYSTEM)
            .values("source_table", "action")
            .annotate(count=models.Count("id"))
        ):
            ledger_actions[item["source_table"]][item["action"]] = item["count"]
        report["ledger_actions"] = {
            table: dict(actions) for table, actions in ledger_actions.items()
        }
        report["database_counts"] = {
            "users": User.objects.count(),
            "packages": Package.objects.count(),
            "flavors": Flavor.objects.count(),
            "pronunciations": Pronunciation.objects.count(),
            "cans": Can.objects.count(),
            "nameplates": Nameplate.objects.count(),
            "legacy_import_records": LegacyImportRecord.objects.filter(
                source_system=SOURCE_SYSTEM
            ).count(),
        }
        return report


def export_demo_fixture():
    """Export five public recordings without database or identity keys."""
    selected = []
    for qualified_code in DEMO_DIALECT_CODES:
        dialect = resolve_dialect(qualified_code)
        if dialect is None:
            raise ValueError(f"缺少方言节点: {qualified_code}")
        can = (
            Can.objects.filter(
                visibility=True,
                submitted_dialect=dialect,
                nameplates__is_primary=True,
                nameplates__status=Nameplate.Status.ACTIVE,
            )
            .select_related("recorder", "verifier", "submitted_dialect")
            .distinct()
            .order_by("id")
            .first()
        )
        if can is None or can.primary_nameplate is None:
            raise ValueError(f"没有可导出的公开录音: {qualified_code}")
        selected.append((qualified_code, can, can.primary_nameplate))

    user_ids = sorted(
        {
            user_id
            for _, can, nameplate in selected
            for user_id in (can.recorder_id, can.verifier_id, nameplate.creator_id)
            if user_id
        }
    )
    actor_keys = {
        user_id: f"actor_{index}" for index, user_id in enumerate(user_ids, 1)
    }
    actors = [
        {"key": key, "display_name": f"示例贡献者{index}", "role": "contributor"}
        for index, key in enumerate(actor_keys.values(), 1)
    ]
    entries = []
    for index, (qualified_code, can, nameplate) in enumerate(selected, 1):
        pronunciation = nameplate.pronunciation
        entries.append(
            {
                "key": f"entry_{index}",
                "dialect": qualified_code,
                "package": {
                    "text": nameplate.package.text,
                    "package_type": nameplate.package.package_type,
                },
                "flavor": {
                    "name": nameplate.flavor.name,
                    "definition": nameplate.flavor.definition,
                    "mandarin": list(nameplate.flavor.mandarin or []),
                    "tags": list(nameplate.flavor.tags or []),
                    "visibility": bool(nameplate.flavor.visibility),
                },
                "pronunciation": {
                    "ipa": pronunciation.ipa if pronunciation else "",
                    "surface_romanization": (
                        pronunciation.surface_romanization if pronunciation else ""
                    ),
                    "reading_type": (
                        pronunciation.reading_type
                        if pronunciation
                        else Pronunciation.ReadingType.GENERAL
                    ),
                    "status": (
                        pronunciation.status
                        if pronunciation
                        else Pronunciation.Status.DRAFT
                    ),
                },
                "can": {
                    "audio_url": can.audio_url,
                    "concept_text": can.concept_text,
                    "status": can.status,
                    "visibility": bool(can.visibility),
                    "recorder": actor_keys.get(can.recorder_id),
                    "verifier": actor_keys.get(can.verifier_id),
                },
                "nameplate": {
                    "creator": actor_keys.get(nameplate.creator_id),
                    "text_content": nameplate.text_content,
                    "definition": nameplate.definition,
                    "pronunciation_text": nameplate.pronunciation_text,
                    "evidence_level": nameplate.evidence_level,
                    "weight": nameplate.weight,
                },
            }
        )
    return {
        "schema_version": 1,
        "format": "guantou-logical-key-demo",
        "actors": actors,
        "entries": entries,
    }


def _validate_demo_fixture(payload):
    if (
        payload.get("schema_version") != 1
        or payload.get("format") != "guantou-logical-key-demo"
    ):
        raise ValueError("不支持的 demo fixture 格式")
    actors = payload.get("actors")
    entries = payload.get("entries")
    if not isinstance(actors, list) or not isinstance(entries, list):
        raise ValueError("demo fixture 缺少 actors 或 entries")
    actor_keys = {actor.get("key") for actor in actors if isinstance(actor, dict)}
    if None in actor_keys or len(actor_keys) != len(actors):
        raise ValueError("demo fixture actor key 无效或重复")
    entry_keys = set()
    for entry in entries:
        if not isinstance(entry, dict) or not entry.get("key"):
            raise ValueError("demo fixture entry key 无效")
        if entry["key"] in entry_keys:
            raise ValueError("demo fixture entry key 重复")
        entry_keys.add(entry["key"])
        if resolve_dialect(entry.get("dialect")) is None:
            raise ValueError(f"demo fixture 方言不存在: {entry.get('dialect')}")
        for field in ("package", "flavor", "pronunciation", "can", "nameplate"):
            if not isinstance(entry.get(field), dict):
                raise ValueError(f"demo fixture 条目缺少 {field}")
        for actor_field in (
            entry["can"].get("recorder"),
            entry["can"].get("verifier"),
            entry["nameplate"].get("creator"),
        ):
            if actor_field is not None and actor_field not in actor_keys:
                raise ValueError(f"demo fixture 引用了未知 actor: {actor_field}")
    return actors, entries


def import_demo_fixture(payload, *, apply=False):
    """Validate or idempotently load the sanitized logical-key fixture."""
    actors, entries = _validate_demo_fixture(payload)
    report = {
        "mode": "apply" if apply else "dry-run",
        "format": payload["format"],
        "source_counts": {"actors": len(actors), "entries": len(entries)},
        "created": defaultdict(int),
        "skipped": defaultdict(int),
    }
    if not apply:
        return {**report, "created": {}, "skipped": {}}

    actor_map = {}
    with transaction.atomic():
        for actor in actors:
            username = f"hinghwa_demo_{actor['key']}"
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    "first_name": "",
                    "last_name": "",
                    "email": "",
                    "is_staff": False,
                    "is_superuser": False,
                    "is_active": True,
                },
            )
            if created:
                user.set_unusable_password()
                user.save(update_fields=["password"])
                UserInfo.objects.create(
                    user=user,
                    nickname=str(actor.get("display_name") or actor["key"])[:100],
                )
                report["created"]["actors"] += 1
            else:
                UserInfo.objects.get_or_create(user=user)
                report["skipped"]["actors"] += 1
            actor_map[actor["key"]] = user

        for entry in entries:
            entry_key = entry["key"]
            existing = Can.objects.filter(metadata__demo_fixture_key=entry_key).first()
            if existing:
                report["skipped"]["entries"] += 1
                continue
            dialect = resolve_dialect(entry["dialect"])
            package_data = entry["package"]
            package, package_created = Package.objects.get_or_create(
                text=package_data["text"],
                package_type=package_data["package_type"],
                defaults={"metadata": {"demo_fixture_keys": [entry_key]}},
            )
            if not package_created:
                metadata = dict(package.metadata or {})
                keys = list(metadata.get("demo_fixture_keys", []))
                if entry_key not in keys:
                    keys.append(entry_key)
                    metadata["demo_fixture_keys"] = keys
                    package.metadata = metadata
                    package.save(update_fields=["metadata", "updated_at"])
            flavor_data = entry["flavor"]
            flavor = Flavor.objects.create(
                name=flavor_data["name"],
                definition=flavor_data["definition"],
                mandarin=list(flavor_data.get("mandarin") or []),
                tags=list(flavor_data.get("tags") or []),
                metadata={"demo_fixture_key": entry_key},
                visibility=bool(flavor_data.get("visibility", True)),
                created_by=actor_map.get(entry["can"].get("recorder")),
            )
            FlavorPackage.objects.create(
                flavor=flavor,
                package=package,
                mapping_type=FlavorPackage.MappingType.PRIMARY,
                note="脱敏 demo fixture",
            )
            pronunciation_data = entry["pronunciation"]
            pronunciation = Pronunciation.objects.create(
                flavor=flavor,
                package=package,
                dialect=dialect,
                ipa=str(pronunciation_data.get("ipa") or ""),
                surface_romanization=str(
                    pronunciation_data.get("surface_romanization") or ""
                ),
                reading_type=pronunciation_data.get("reading_type")
                or Pronunciation.ReadingType.GENERAL,
                status=pronunciation_data.get("status") or Pronunciation.Status.DRAFT,
                source_citation=f"demo-fixture:{entry_key}",
                created_by=actor_map.get(entry["can"].get("recorder")),
            )
            can_data = entry["can"]
            can = Can.objects.create(
                audio_url=can_data["audio_url"],
                recorder=actor_map.get(can_data.get("recorder")),
                submitted_dialect=dialect,
                concept_text=str(can_data.get("concept_text") or "")[:200],
                source_note="脱敏逻辑键 demo fixture",
                status=can_data.get("status") or Can.Status.PENDING,
                visibility=bool(can_data.get("visibility", True)),
                verifier=actor_map.get(can_data.get("verifier")),
                metadata={"demo_fixture_key": entry_key},
            )
            nameplate_data = entry["nameplate"]
            Nameplate.objects.create(
                can=can,
                flavor=flavor,
                package=package,
                dialect=dialect,
                pronunciation=pronunciation,
                creator=actor_map.get(nameplate_data.get("creator")),
                text_content=nameplate_data.get("text_content") or package.text,
                definition=nameplate_data.get("definition") or flavor.definition,
                pronunciation_text=nameplate_data.get("pronunciation_text") or "",
                evidence_level=nameplate_data.get("evidence_level")
                or Nameplate.EvidenceLevel.COMMUNITY,
                source={"type": Nameplate.SourceType.ARCHIVE, "fixture": entry_key},
                status=Nameplate.Status.ACTIVE,
                weight=max(0, int(nameplate_data.get("weight") or 0)),
                is_primary=True,
            )
            report["created"]["entries"] += 1
            report["created"]["packages"] += int(package_created)
    report["created"] = dict(report["created"])
    report["skipped"] = dict(report["skipped"])
    return report
