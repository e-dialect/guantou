import json

from django.contrib.auth.models import User
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.test import Client, TestCase

from user.models import UserInfo
from user.tokens import generate_token

from .catalog import seed_catalog
from .models import (
    CatalogVersion,
    ComponentType,
    DecorationItem,
    ItemStatus,
    ItemType,
    ThemeItem,
    UserThemeEntitlement,
    UserThemeMix,
)


def bearer(user):
    return f"Bearer {generate_token(user)}"


class ThemeApiTests(TestCase):
    def setUp(self):
        cache.clear()
        seed_catalog()
        self.user = User.objects.create_user(
            username="theme-user", password="pw", email="theme@example.com"
        )
        UserInfo.objects.create(user=self.user, nickname="乡音")
        self.client = Client()

    def auth(self):
        return {"HTTP_AUTHORIZATION": bearer(self.user)}

    def test_guest_can_read_catalog_with_version_and_without_list_style(self):
        response = self.client.get("/themes/", {"page_size": 200})
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn("catalog_version", payload)
        self.assertGreaterEqual(payload["count"], 1)
        self.assertTrue(payload["results"])
        first = payload["results"][0]
        self.assertNotIn("style_json", first)
        ids = [row["theme_id"] for row in payload["results"]]
        self.assertIn("default", ids)

        detail = self.client.get("/themes/default/")
        self.assertEqual(detail.status_code, 200)
        self.assertIn("style_json", detail.json())

        decorations = self.client.get("/decorations/?page_size=50")
        self.assertEqual(decorations.status_code, 200)
        deco_ids = [row["decoration_id"] for row in decorations.json()["results"]]
        self.assertIn("cards-plain", deco_ids)
        self.assertNotIn("style_json", decorations.json()["results"][0])

    def test_c_end_payloads_follow_data_contract(self):
        forbidden = (
            "sort_weight",
            "is_recommended",
            "heat_score",
            "exposure_count",
            "config_version",
            "user_id",
            "user",
            "extra",
            "source",
            "submitter_id",
            "is_ugc",
            "creator_level",
            "price",
            "geo_region",
            "dialect_exclusive",
            "is_public",
        )
        required_theme = (
            "theme_id",
            "name",
            "desc",
            "cover_img",
            "detail_img",
            "poster_img",
            "privilege_type",
            "status",
            "support_terminal",
            "like_count",
            "collect_count",
            "share_count",
            "create_time",
        )
        listed = self.client.get("/themes/")
        first = listed.json()["results"][0]
        for key in required_theme:
            self.assertIn(key, first)
        for key in forbidden:
            self.assertNotIn(key, first)
        self.assertNotIn("style_json", first)

        detail = self.client.get("/themes/default/").json()
        self.assertIn("style_json", detail)
        for key in forbidden:
            self.assertNotIn(key, detail)

        deco = self.client.get("/decorations/?page_size=50").json()["results"][0]
        self.assertIn("decoration_id", deco)
        self.assertIn("component_type", deco)
        self.assertIn("group", deco)
        self.assertNotIn("style_json", deco)
        for key in forbidden:
            self.assertNotIn(key, deco)

        config = self.client.get("/users/theme/config/", **self.auth()).json()
        self.assertEqual(
            set(config),
            {
                "global_theme_id",
                "decoration_map",
                "is_cover_local_decoration",
                "recent_use_list",
            },
        )

        rights = self.client.get("/users/theme/entitlement/", **self.auth()).json()
        self.assertEqual(set(rights), {"is_member", "creator_unlocked", "activity_ids"})

        collect = self.client.post(
            "/users/theme/collects/",
            data={"item_type": "theme", "item_id": "default"},
            content_type="application/json",
            **self.auth(),
        )
        self.assertEqual(collect.status_code, 201)
        collect_row = collect.json()
        self.assertEqual(set(collect_row), {"item_id", "item_type", "collect_time"})
        for key in ("snapshot", "name", "cover_img", "collect_status"):
            self.assertNotIn(key, collect_row)

        mix = self.client.post(
            "/users/theme/mixes/",
            data={
                "mix_id": "mix-contract",
                "mix_name": "契约搭配",
                "global_theme_id": "default",
                "decoration_map": {"card": "cards-plain"},
            },
            content_type="application/json",
            **self.auth(),
        )
        self.assertEqual(mix.status_code, 201)
        mix_row = mix.json()
        self.assertEqual(
            set(mix_row),
            {
                "mix_id",
                "mix_name",
                "global_theme_id",
                "decoration_ids",
                "decoration_map",
                "is_cover_local_decoration",
                "create_time",
            },
        )
        for key in (
            "remark",
            "sort_index",
            "invalid_ids",
            "last_apply_time",
            "style_json",
            "is_public",
            "copy_count",
        ):
            self.assertNotIn(key, mix_row)

        missing = self.client.get("/users/theme/submissions/", **self.auth())
        self.assertEqual(missing.status_code, 404)
        guest_post = self.client.post(
            "/users/theme/submissions/",
            data={"name": "巷口"},
            content_type="application/json",
        )
        self.assertEqual(guest_post.status_code, 404)
        self.assertNotIn("can_submit", rights)
        self.assertNotIn("paid_item_ids", rights)
        for path in (
            "/users/theme/credits/",
            "/users/theme/fragments/",
            "/users/theme/ranks/",
        ):
            self.assertEqual(self.client.get(path, **self.auth()).status_code, 404)
            self.assertEqual(
                self.client.post(
                    path,
                    data={},
                    content_type="application/json",
                ).status_code,
                404,
            )

        coming_fav = self.client.post(
            "/users/theme/collects/",
            data={"item_type": "theme", "item_id": "chuankiang"},
            content_type="application/json",
            **self.auth(),
        )
        self.assertEqual(coming_fav.status_code, 409)
        self.assertEqual(coming_fav.json()["data"]["reason"], "coming")
        ended_fav = self.client.post(
            "/users/theme/collects/",
            data={"item_type": "theme", "item_id": "event-spring"},
            content_type="application/json",
            **self.auth(),
        )
        self.assertEqual(ended_fav.status_code, 201)

    def test_guest_cannot_write_config(self):
        response = self.client.put(
            "/users/theme/config/",
            data={"global_theme_id": "default"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 401)

    def test_apply_default_theme_and_ignore_client_style(self):
        apply = self.client.post(
            "/users/theme/apply/",
            data={"item_type": "theme", "item_id": "default", "platform": "h5"},
            content_type="application/json",
            **self.auth(),
        )
        self.assertEqual(apply.status_code, 200)
        self.assertEqual(apply.json()["global_theme_id"], "default")

        cache.clear()
        paper = self.client.post(
            "/users/theme/apply/",
            data={"item_type": "theme", "item_id": "paper", "platform": "h5"},
            content_type="application/json",
            **self.auth(),
        )
        self.assertEqual(paper.status_code, 200)
        self.assertEqual(paper.json()["global_theme_id"], "paper")

        cache.clear()
        ferry = self.client.post(
            "/users/theme/apply/",
            data={"item_type": "theme", "item_id": "nightferry", "platform": "h5"},
            content_type="application/json",
            **self.auth(),
        )
        self.assertEqual(ferry.status_code, 200)
        self.assertEqual(ferry.json()["global_theme_id"], "nightferry")

        cache.clear()
        put = self.client.put(
            "/users/theme/config/",
            data={
                "global_theme_id": "default",
                "is_cover_local_decoration": True,
                "style_json": {"accent": "hack"},
                "like_count": 99,
                "is_member": True,
            },
            content_type="application/json",
            **self.auth(),
        )
        self.assertEqual(put.status_code, 200)
        self.assertEqual(put.json()["global_theme_id"], "default")
        self.assertNotIn("style_json", put.json())
        self.assertFalse(
            UserThemeEntitlement.objects.filter(user=self.user, is_member=True).exists()
        )

    def test_apply_rejects_coming_deprecated_privilege_and_terminal(self):
        coming = self.client.post(
            "/users/theme/apply/",
            data={"item_type": "theme", "item_id": "chuankiang", "platform": "h5"},
            content_type="application/json",
            **self.auth(),
        )
        self.assertEqual(coming.status_code, 409)
        self.assertEqual(coming.json()["data"]["reason"], "coming")

        cache.clear()
        ended = self.client.post(
            "/users/theme/apply/",
            data={"item_type": "theme", "item_id": "event-spring", "platform": "h5"},
            content_type="application/json",
            **self.auth(),
        )
        self.assertEqual(ended.status_code, 409)
        self.assertEqual(ended.json()["data"]["reason"], "deprecated")

        cache.clear()
        member = self.client.post(
            "/users/theme/apply/",
            data={"item_type": "theme", "item_id": "member-pine", "platform": "h5"},
            content_type="application/json",
            **self.auth(),
        )
        self.assertEqual(member.status_code, 403)
        self.assertEqual(member.json()["data"]["reason"], "privilege")

        cache.clear()
        live = self.client.post(
            "/users/theme/apply/",
            data={
                "item_type": "decoration",
                "item_id": "cards-plain",
                "platform": "h5",
            },
            content_type="application/json",
            **self.auth(),
        )
        self.assertEqual(live.status_code, 200)
        self.assertEqual(live.json()["decoration_map"]["card"], "cards-plain")

        cache.clear()
        terminal = self.client.post(
            "/users/theme/apply/",
            data={
                "item_type": "decoration",
                "item_id": "navbar-plain",
                "platform": "miniprogram",
            },
            content_type="application/json",
            **self.auth(),
        )
        self.assertEqual(terminal.status_code, 403)
        self.assertEqual(terminal.json()["data"]["reason"], "terminal")

    def test_member_can_apply_member_theme(self):
        UserThemeEntitlement.objects.update_or_create(
            user=self.user, defaults={"is_member": True}
        )
        response = self.client.post(
            "/users/theme/apply/",
            data={"item_type": "theme", "item_id": "member-pine", "platform": "h5"},
            content_type="application/json",
            **self.auth(),
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["global_theme_id"], "member-pine")

    def test_collect_mix_and_events(self):
        collect = self.client.post(
            "/users/theme/collects/",
            data={"item_type": "theme", "item_id": "default"},
            content_type="application/json",
            **self.auth(),
        )
        self.assertEqual(collect.status_code, 201)
        listed = self.client.get("/users/theme/collects/", **self.auth())
        self.assertEqual(listed.status_code, 200)
        self.assertEqual(listed.json()["collect_list"][0]["item_id"], "default")
        ThemeItem.objects.get(theme_id="default").refresh_from_db()
        self.assertEqual(ThemeItem.objects.get(theme_id="default").collect_count, 1)

        deleted = self.client.delete(
            "/users/theme/collects/default/?item_type=theme",
            **self.auth(),
        )
        self.assertEqual(deleted.status_code, 204)

        mix = self.client.post(
            "/users/theme/mixes/",
            data={
                "mix_id": "mix-home",
                "mix_name": "<b>巷口搭配</b>",
                "global_theme_id": "default",
                "decoration_map": {"card": "cards-plain"},
            },
            content_type="application/json",
            **self.auth(),
        )
        self.assertEqual(mix.status_code, 201)
        self.assertEqual(mix.json()["mix_name"], "巷口搭配")

        renamed = self.client.patch(
            "/users/theme/mixes/mix-home/",
            data={"mix_name": "晚风搭配"},
            content_type="application/json",
            **self.auth(),
        )
        self.assertEqual(renamed.status_code, 200)
        self.assertEqual(renamed.json()["mix_name"], "晚风搭配")

        event = self.client.post(
            "/users/theme/events/",
            data={"event": "theme_center_enter", "item_id": "default"},
            content_type="application/json",
        )
        self.assertEqual(event.status_code, 202)
        before = ThemeItem.objects.get(theme_id="default").like_count
        self.assertEqual(before, 0)

    def test_mix_overlay_and_duplicate(self):
        created = self.client.post(
            "/users/theme/mixes/",
            data={
                "mix_id": "mix-overlay",
                "mix_name": "关开关的巷口",
                "global_theme_id": "default",
                "decoration_map": {"card": "cards-plain"},
                "is_cover_local_decoration": False,
            },
            content_type="application/json",
            **self.auth(),
        )
        self.assertEqual(created.status_code, 201)
        self.assertFalse(created.json()["is_cover_local_decoration"])

        listed = self.client.get("/users/theme/mixes/", **self.auth())
        self.assertEqual(listed.status_code, 200)
        self.assertEqual(listed.json()[0]["mix_id"], "mix-overlay")

        duplicate = self.client.post(
            "/users/theme/mixes/",
            data={
                "mix_id": "mix-overlay-2",
                "mix_name": "再存一次",
                "global_theme_id": "default",
                "decoration_map": {"card": "cards-plain"},
                "is_cover_local_decoration": False,
            },
            content_type="application/json",
            **self.auth(),
        )
        self.assertEqual(duplicate.status_code, 409)
        self.assertEqual(duplicate.json()["data"]["reason"], "mix_dup")

        different_overlay = self.client.post(
            "/users/theme/mixes/",
            data={
                "mix_id": "mix-overlay-on",
                "mix_name": "开开关的巷口",
                "global_theme_id": "default",
                "decoration_map": {"card": "cards-plain"},
                "is_cover_local_decoration": True,
            },
            content_type="application/json",
            **self.auth(),
        )
        self.assertEqual(different_overlay.status_code, 201)
        self.assertTrue(different_overlay.json()["is_cover_local_decoration"])

        collide = self.client.post(
            "/users/theme/mixes/",
            data={
                "mix_id": "mix-overlay",
                "mix_name": "同名不同装",
                "global_theme_id": "default",
                "decoration_map": {"avatar": "avatar-plain"},
            },
            content_type="application/json",
            **self.auth(),
        )
        self.assertEqual(collide.status_code, 409)
        self.assertEqual(collide.json()["data"]["reason"], "mix_dup")

    def test_put_keeps_locked_layers_in_map(self):
        stripped = self.client.put(
            "/users/theme/config/",
            data={
                "global_theme_id": "default",
                "is_cover_local_decoration": False,
                "decoration_map": {
                    "card": "cards-member",
                    "home_bg": "profile-plain",
                },
            },
            content_type="application/json",
            **self.auth(),
        )
        self.assertEqual(stripped.status_code, 200)
        mapping = stripped.json()["decoration_map"]
        self.assertNotIn("card", mapping)
        self.assertEqual(mapping.get("home_bg"), "profile-plain")

        UserThemeEntitlement.objects.update_or_create(
            user=self.user, defaults={"is_member": True}
        )
        cache.clear()
        owned = self.client.put(
            "/users/theme/config/",
            data={
                "global_theme_id": "default",
                "is_cover_local_decoration": False,
                "decoration_map": {
                    "card": "cards-member",
                    "home_bg": "profile-plain",
                },
            },
            content_type="application/json",
            **self.auth(),
        )
        self.assertEqual(owned.json()["decoration_map"]["card"], "cards-member")

        UserThemeEntitlement.objects.filter(user=self.user).update(is_member=False)
        cache.clear()
        keep = self.client.put(
            "/users/theme/config/",
            data={
                "global_theme_id": "default",
                "is_cover_local_decoration": False,
                "decoration_map": {
                    "card": "cards-member",
                    "home_bg": "profile-plain",
                },
            },
            content_type="application/json",
            **self.auth(),
        )
        mapping = keep.json()["decoration_map"]
        self.assertEqual(mapping.get("card"), "cards-member")
        self.assertEqual(mapping.get("home_bg"), "profile-plain")

    def test_put_keeps_decoration_map_when_overlay_on(self):
        response = self.client.put(
            "/users/theme/config/",
            data={
                "global_theme_id": "default",
                "is_cover_local_decoration": True,
                "decoration_map": {"card": "cards-plain"},
            },
            content_type="application/json",
            **self.auth(),
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["is_cover_local_decoration"])
        self.assertEqual(payload["decoration_map"].get("card"), "cards-plain")

    def test_apply_records_recent_use_dedupes_and_caps(self):
        first = self.client.post(
            "/users/theme/apply/",
            data={"item_type": "theme", "item_id": "default", "platform": "h5"},
            content_type="application/json",
            **self.auth(),
        )
        self.assertEqual(first.status_code, 200)
        self.assertEqual(first.json()["recent_use_list"][0]["item_id"], "default")

        cache.clear()
        paper = self.client.post(
            "/users/theme/apply/",
            data={"item_type": "theme", "item_id": "paper", "platform": "h5"},
            content_type="application/json",
            **self.auth(),
        )
        self.assertEqual(paper.status_code, 200)
        ids = [row["item_id"] for row in paper.json()["recent_use_list"]]
        self.assertEqual(ids[0], "paper")
        self.assertEqual(ids.count("paper"), 1)

        cache.clear()
        again = self.client.post(
            "/users/theme/apply/",
            data={"item_type": "theme", "item_id": "default", "platform": "h5"},
            content_type="application/json",
            **self.auth(),
        )
        self.assertEqual(again.status_code, 200)
        recent = again.json()["recent_use_list"]
        self.assertEqual(recent[0]["item_id"], "default")
        self.assertEqual(
            [row["item_id"] for row in recent].count("default"),
            1,
        )

        cache.clear()
        denied = self.client.post(
            "/users/theme/apply/",
            data={"item_type": "theme", "item_id": "member-pine", "platform": "h5"},
            content_type="application/json",
            **self.auth(),
        )
        self.assertEqual(denied.status_code, 403)
        after_denied = self.client.get("/users/theme/config/", **self.auth())
        self.assertNotIn(
            "member-pine",
            [row["item_id"] for row in after_denied.json()["recent_use_list"]],
        )

        stuffed = [
            {
                "item_id": f"old-{index}",
                "item_type": "theme",
                "use_time": 1000 - index,
                "style_json": {"accent": "hack"},
            }
            for index in range(9)
        ]
        stuffed.append({"item_id": "", "item_type": "theme", "use_time": 1})
        cache.clear()
        put = self.client.put(
            "/users/theme/config/",
            data={
                "global_theme_id": "default",
                "is_cover_local_decoration": True,
                "recent_use_list": stuffed,
            },
            content_type="application/json",
            **self.auth(),
        )
        self.assertEqual(put.status_code, 200)
        cleaned = put.json()["recent_use_list"]
        self.assertEqual(len(cleaned), 8)
        self.assertEqual(cleaned[0]["item_id"], "old-0")
        self.assertNotIn("style_json", cleaned[0])

        cache.clear()
        evicted = self.client.post(
            "/users/theme/apply/",
            data={"item_type": "theme", "item_id": "paper", "platform": "h5"},
            content_type="application/json",
            **self.auth(),
        )
        self.assertEqual(evicted.status_code, 200)
        newest = evicted.json()["recent_use_list"]
        self.assertEqual(len(newest), 8)
        self.assertEqual(newest[0]["item_id"], "paper")
        self.assertNotIn("old-7", [row["item_id"] for row in newest])

    def test_catalog_version_bumps_with_admin_save(self):
        first = CatalogVersion.current()
        CatalogVersion.bump()
        self.assertEqual(CatalogVersion.current(), first + 1)

    def test_native_decoration_cannot_enable_miniprogram(self):
        item = DecorationItem(
            decoration_id="navbar-bad",
            name="坏顶栏",
            component_type=ComponentType.NAV_BAR,
            support_terminal=["h5", "miniprogram"],
        )
        with self.assertRaises(ValidationError):
            item.full_clean()

    def test_catalog_search_filters_and_free_sort(self):
        by_desc = self.client.get("/themes/", {"keyword": "巴蜀"})
        self.assertEqual(by_desc.status_code, 200)
        ids = [row["theme_id"] for row in by_desc.json()["results"]]
        self.assertIn("chuankiang", ids)

        tagged = self.client.get(
            "/decorations/", {"keyword": "罐头卡片", "page_size": 50}
        )
        self.assertEqual(tagged.status_code, 200)
        deco_ids = [row["decoration_id"] for row in tagged.json()["results"]]
        self.assertIn("cards-plain", deco_ids)

        stripped = self.client.get("/themes/", {"keyword": "<b>川渝</b>"})
        self.assertIn(
            "chuankiang",
            [row["theme_id"] for row in stripped.json()["results"]],
        )

        dialect = self.client.get("/themes/", {"dialect_tag": "川渝"})
        self.assertEqual(dialect.status_code, 200)
        self.assertIn(
            "chuankiang",
            [row["theme_id"] for row in dialect.json()["results"]],
        )

        free_first = self.client.get("/themes/", {"sort": "free", "page_size": 50})
        self.assertEqual(free_first.status_code, 200)
        privileges = [row["privilege_type"] for row in free_first.json()["results"]]
        paid_index = next(
            (index for index, value in enumerate(privileges) if value != "free"),
            len(privileges),
        )
        self.assertTrue(all(value == "free" for value in privileges[:paid_index]))

    def test_each_style_has_nine_distinct_free_skins(self):
        tags = [
            "简约",
            "地域方言风",
            "复古",
            "赛博",
            "国风",
            "市井烟火",
            "节日限定",
            "节日风俗",
            "季节时令",
            "二次元",
            "极简暗色",
        ]
        available_free = ThemeItem.objects.filter(
            privilege_type="free",
            status=ItemStatus.AVAILABLE,
        )
        for tag in tags:
            matched = [
                item for item in available_free if tag in (item.style_tags or [])
            ]
            self.assertGreaterEqual(len(matched), 9, tag)
            looks = [
                json.dumps(item.style_json, sort_keys=True, ensure_ascii=True)
                for item in matched
            ]
            self.assertEqual(len(set(looks)), len(looks), tag)

        self.assertGreaterEqual(available_free.count(), 20)

        dress_groups = {
            "cards": [
                "cards-paper",
                "cards-brick",
                "cards-round",
                "cards-sharp",
                "cards-wide",
                "cards-thin",
                "cards-accent",
                "cards-soft",
                "cards-ridge",
            ],
            "profile": [
                "profile-mist",
                "profile-night",
                "profile-grain",
                "profile-wash",
                "profile-line",
                "profile-deep",
                "profile-glow",
                "profile-fog",
                "profile-tile",
            ],
            "avatar": [
                "avatar-frame",
                "avatar-glyph",
                "avatar-ink",
                "avatar-thin",
                "avatar-soft",
                "avatar-ridge",
                "avatar-mist",
                "avatar-seal",
                "avatar-wide",
            ],
            "comment-bubble": [
                "comment-paper",
                "comment-round",
                "comment-ink",
                "comment-pill",
                "comment-soft",
                "comment-line",
                "comment-accent",
                "comment-square",
                "comment-fog",
            ],
        }
        for group, ids in dress_groups.items():
            items = list(DecorationItem.objects.filter(decoration_id__in=ids))
            self.assertEqual(len(items), 9, group)
            looks = []
            for item in items:
                self.assertEqual(item.status, ItemStatus.AVAILABLE)
                self.assertEqual(item.privilege_type, "free")
                looks.append(
                    json.dumps(item.style_json, sort_keys=True, ensure_ascii=True)
                )
            self.assertEqual(len(set(looks)), 9, group)

    def test_live_packs_ship_surface_recipes(self):
        paper = ThemeItem.objects.get(theme_id="paper")
        self.assertEqual(paper.style_json.get("cardBorderRadius"), "4px")
        self.assertEqual(paper.style_json.get("cardBackground"), "var(--page-color)")
        self.assertEqual(paper.style_json.get("grainImage"), "var(--grain-paper)")
        self.assertEqual(paper.style_json.get("letterSpacing"), "0.06em")
        nightferry = ThemeItem.objects.get(theme_id="nightferry")
        self.assertEqual(nightferry.style_json.get("cardBorderRadius"), "6px")
        self.assertEqual(
            nightferry.style_json.get("cardBorderColor"), "var(--text-color)"
        )
        chuankiang = ThemeItem.objects.get(theme_id="chuankiang")
        self.assertEqual(chuankiang.style_json.get("cardBorderRadius"), "14px")
        self.assertEqual(
            chuankiang.style_json.get("cardBackground"), "var(--page-color)"
        )
        detail = self.client.get("/themes/paper/")
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.json()["style_json"]["cardBorderRadius"], "4px")

        tab_keys = {
            "tabBackground",
            "tabColor",
            "tabAccent",
            "tabOnAccent",
            "tabEmphasis",
            "tabBorder",
        }
        for item in ThemeItem.objects.exclude(style_json={}):
            self.assertTrue(tab_keys.issubset(item.style_json), item.theme_id)

        for theme_id, background in {
            "nightferry": "var(--page-color)",
            "midautumn": "var(--accent-subtle-color)",
        }.items():
            style = ThemeItem.objects.get(theme_id=theme_id).style_json
            self.assertEqual(style["tabBackground"], background)
            self.assertEqual(style["tabColor"], "var(--muted-color)")
            self.assertEqual(style["tabAccent"], "var(--accent-color)")
            self.assertEqual(style["tabOnAccent"], "var(--on-accent-color)")
            self.assertEqual(style["tabEmphasis"], "var(--text-color)")
            self.assertEqual(style["tabBorder"], "var(--border-color)")

        tabbar = DecorationItem.objects.get(decoration_id="tabbar-plain")
        self.assertEqual(
            tabbar.style_json,
            {
                "tabBackground": "var(--surface-color)",
                "tabColor": "var(--muted-color)",
                "tabAccent": "var(--accent-color)",
                "tabOnAccent": "var(--on-accent-color)",
                "tabEmphasis": "var(--text-color)",
                "tabBorder": "var(--border-color)",
            },
        )

        style_tags = [
            "简约",
            "地域方言风",
            "复古",
            "赛博",
            "国风",
            "市井烟火",
            "节日限定",
            "节日风俗",
            "季节时令",
            "二次元",
            "极简暗色",
        ]
        fingerprints = []
        available_free = ThemeItem.objects.filter(
            privilege_type="free",
            status=ItemStatus.AVAILABLE,
        )
        for tag in style_tags:
            matched = [
                item for item in available_free if tag in (item.style_tags or [])
            ]
            self.assertGreaterEqual(len(matched), 9, tag)
            sample = matched[0].style_json or {}
            self.assertTrue(sample.get("cardBorderRadius"), tag)
            self.assertTrue(sample.get("grainImage"), tag)
            self.assertTrue(sample.get("letterSpacing"), tag)
            fingerprints.append(
                "|".join(
                    [
                        str(sample.get("cardBorderRadius")),
                        str(sample.get("cardBorderWidth")),
                        str(sample.get("cardShadow")),
                        str(sample.get("grainOpacity")),
                        str(sample.get("grainImage")),
                        str(sample.get("letterSpacing")),
                    ]
                )
            )
        self.assertEqual(len(set(fingerprints)), len(style_tags))

        for group, ids in (
            (
                "cards",
                [
                    "cards-paper",
                    "cards-brick",
                    "cards-round",
                    "cards-sharp",
                    "cards-wide",
                    "cards-thin",
                    "cards-accent",
                    "cards-soft",
                    "cards-ridge",
                    "cards-folk",
                    "cards-season",
                ],
            ),
        ):
            labels = []
            for decoration_id in ids:
                item = DecorationItem.objects.get(decoration_id=decoration_id)
                labels.extend(item.style_tags or [])
            for tag in style_tags:
                self.assertIn(tag, labels, f"{group}:{tag}")

    def test_guest_cannot_claim_entitlement(self):
        response = self.client.post(
            "/users/theme/entitlement/",
            data={"item_type": "theme", "item_id": "event-lantern"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 401)

    def test_claim_activity_then_apply_and_reject_ended(self):
        claim = self.client.post(
            "/users/theme/entitlement/",
            data={"item_type": "theme", "item_id": "event-lantern"},
            content_type="application/json",
            **self.auth(),
        )
        self.assertEqual(claim.status_code, 200)
        self.assertIn("event-lantern", claim.json()["activity_ids"])

        cache.clear()
        apply = self.client.post(
            "/users/theme/apply/",
            data={"item_type": "theme", "item_id": "event-lantern", "platform": "h5"},
            content_type="application/json",
            **self.auth(),
        )
        self.assertEqual(apply.status_code, 200)
        self.assertEqual(apply.json()["global_theme_id"], "event-lantern")

        cache.clear()
        ended = self.client.post(
            "/users/theme/entitlement/",
            data={"item_type": "theme", "item_id": "event-spring"},
            content_type="application/json",
            **self.auth(),
        )
        self.assertEqual(ended.status_code, 409)
        self.assertEqual(ended.json()["data"]["reason"], "deprecated")

        cache.clear()
        member = self.client.post(
            "/users/theme/entitlement/",
            data={"item_type": "theme", "item_id": "member-pine"},
            content_type="application/json",
            **self.auth(),
        )
        self.assertEqual(member.status_code, 403)

    def test_claim_creator_requires_unlock_then_apply(self):
        locked = self.client.post(
            "/users/theme/entitlement/",
            data={"item_type": "decoration", "item_id": "avatar-creator"},
            content_type="application/json",
            **self.auth(),
        )
        self.assertEqual(locked.status_code, 403)

        UserThemeEntitlement.objects.update_or_create(
            user=self.user, defaults={"creator_unlocked": True}
        )
        cache.clear()
        claim = self.client.post(
            "/users/theme/entitlement/",
            data={"item_type": "decoration", "item_id": "avatar-creator"},
            content_type="application/json",
            **self.auth(),
        )
        self.assertEqual(claim.status_code, 200)
        self.assertIn("avatar-creator", claim.json()["activity_ids"])

        cache.clear()
        apply = self.client.post(
            "/users/theme/apply/",
            data={
                "item_type": "decoration",
                "item_id": "avatar-creator",
                "platform": "h5",
            },
            content_type="application/json",
            **self.auth(),
        )
        self.assertEqual(apply.status_code, 200)
        self.assertEqual(
            apply.json()["decoration_map"]["avatar_frame"], "avatar-creator"
        )

    def test_guest_cannot_write_collects(self):
        response = self.client.post(
            "/users/theme/collects/",
            data={"item_type": "theme", "item_id": "default"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 401)

    def test_collect_rejects_coming_and_unknown(self):
        coming = self.client.post(
            "/users/theme/collects/",
            data={"item_type": "theme", "item_id": "chuankiang"},
            content_type="application/json",
            **self.auth(),
        )
        self.assertEqual(coming.status_code, 409)
        self.assertEqual(coming.json()["data"]["reason"], "coming")
        missing = self.client.post(
            "/users/theme/collects/",
            data={"item_type": "theme", "item_id": "not-a-skin"},
            content_type="application/json",
            **self.auth(),
        )
        self.assertEqual(missing.status_code, 404)

    def test_share_event_bumps_count_once_per_hour(self):
        first = self.client.post(
            "/users/theme/events/",
            data={"event": "theme_share_click", "item_id": "default"},
            content_type="application/json",
            **self.auth(),
        )
        self.assertEqual(first.status_code, 202)
        ThemeItem.objects.get(theme_id="default").refresh_from_db()
        self.assertEqual(ThemeItem.objects.get(theme_id="default").share_count, 1)

        cache.clear()
        again = self.client.post(
            "/users/theme/events/",
            data={"event": "theme_share_click", "item_id": "default"},
            content_type="application/json",
            **self.auth(),
        )
        self.assertEqual(again.status_code, 202)
        ThemeItem.objects.get(theme_id="default").refresh_from_db()
        self.assertEqual(ThemeItem.objects.get(theme_id="default").share_count, 1)

    def test_apply_same_item_rate_limited(self):
        first = self.client.post(
            "/users/theme/apply/",
            data={"item_type": "theme", "item_id": "default", "platform": "h5"},
            content_type="application/json",
            **self.auth(),
        )
        self.assertEqual(first.status_code, 200)
        again = self.client.post(
            "/users/theme/apply/",
            data={"item_type": "theme", "item_id": "default", "platform": "h5"},
            content_type="application/json",
            **self.auth(),
        )
        self.assertEqual(again.status_code, 429)
        self.assertEqual(again.json()["data"]["reason"], "rate")
        self.assertEqual(again.json()["message"], "操作过于频繁，请稍后再试")
        listed = self.client.get("/users/theme/config/", **self.auth())
        self.assertEqual(listed.json()["global_theme_id"], "default")

    def test_mix_isolated_and_script_name_stripped(self):
        created = self.client.post(
            "/users/theme/mixes/",
            data={
                "mix_id": "mix-private",
                "mix_name": "<script>alert(1)</script>巷口",
                "global_theme_id": "default",
                "decoration_map": {"card": "cards-plain"},
            },
            content_type="application/json",
            **self.auth(),
        )
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.json()["mix_name"], "alert(1)巷口")
        self.assertNotIn("<", created.json()["mix_name"])
        self.assertNotIn(">", created.json()["mix_name"])

        other = User.objects.create_user(
            username="theme-other", password="pw", email="other@example.com"
        )
        UserInfo.objects.create(user=other, nickname="路人")
        stolen = self.client.patch(
            "/users/theme/mixes/mix-private/",
            data={"mix_name": "偷走"},
            content_type="application/json",
            HTTP_AUTHORIZATION=bearer(other),
        )
        self.assertEqual(stolen.status_code, 404)
        listed = self.client.get(
            "/users/theme/mixes/",
            HTTP_AUTHORIZATION=bearer(other),
        )
        self.assertEqual(listed.status_code, 200)
        self.assertEqual(listed.json(), [])

        deleted = self.client.delete(
            "/users/theme/mixes/mix-private/",
            HTTP_AUTHORIZATION=bearer(other),
        )
        self.assertEqual(deleted.status_code, 404)
        still = self.client.get("/users/theme/mixes/", **self.auth())
        self.assertEqual(still.json()[0]["mix_id"], "mix-private")

    def test_mix_canonicalizes_decoration_map_and_ids(self):
        created = self.client.post(
            "/users/theme/mixes/",
            data={
                "mix_id": "mix-canonical",
                "mix_name": "可信搭配",
                "global_theme_id": "default",
                "decoration_map": {
                    "card": "cards-plain",
                    "avatar_frame": "cards-plain",
                    "unknown_component": "avatar-plain",
                },
                "decoration_ids": ["avatar-plain", "missing-item"],
            },
            content_type="application/json",
            **self.auth(),
        )
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.json()["decoration_map"], {"card": "cards-plain"})
        self.assertEqual(created.json()["decoration_ids"], ["cards-plain"])

    def test_decoration_reference_checks_mix_map_as_source_of_truth(self):
        UserThemeMix.objects.create(
            mix_id="mix-map-only",
            user=self.user,
            mix_name="旧数据",
            global_theme_id="default",
            decoration_map={"card": "cards-plain"},
            decoration_ids=[],
        )
        from .services import item_is_referenced

        self.assertTrue(item_is_referenced(ItemType.DECORATION, "cards-plain"))

    def test_collect_delete_shares_write_rate_window(self):
        for _ in range(20):
            posted = self.client.post(
                "/users/theme/collects/",
                data={"item_type": "theme", "item_id": "default"},
                content_type="application/json",
                **self.auth(),
            )
            self.assertIn(posted.status_code, (200, 201))
        blocked = self.client.delete(
            "/users/theme/collects/default/?item_type=theme",
            **self.auth(),
        )
        self.assertEqual(blocked.status_code, 429)
        self.assertEqual(blocked.json()["data"]["reason"], "rate")
        listed = self.client.get("/users/theme/collects/", **self.auth())
        self.assertEqual(listed.json()["collect_list"][0]["item_id"], "default")

    def test_catalog_item_clean_strips_html_and_rejects_bad_tags(self):
        item = ThemeItem.objects.get(theme_id="default")
        item.name = "<b>默认方言主题</b>"
        item.style_json = {"accent": "pine;hack"}
        with self.assertRaises(ValidationError):
            item.full_clean()
        item.style_json = {"accent": "pine"}
        item.dialect_tags = ["川渝烟火"]
        with self.assertRaises(ValidationError):
            item.full_clean()
        item.dialect_tags = ["川渝"]
        item.full_clean()
        self.assertEqual(item.name, "默认方言主题")
        self.assertEqual(item.dialect_tags, ["川渝"])
        self.assertIsNone(item.activity_start_at)

    def test_activity_window_sync_expires_available_item(self):
        from datetime import timedelta

        from django.utils import timezone

        from .services import sync_activity_windows

        now = timezone.now()
        item = ThemeItem.objects.get(theme_id="event-lantern")
        with self.assertRaises(ValidationError):
            item.full_clean()
        item.activity_start_at = now - timedelta(days=2)
        item.activity_end_at = now - timedelta(days=1)
        item.status = ItemStatus.AVAILABLE
        item.save(update_fields=["activity_start_at", "activity_end_at", "status"])
        before = CatalogVersion.current()
        changed = sync_activity_windows(now=now)
        self.assertGreaterEqual(changed, 1)
        item.refresh_from_db()
        self.assertEqual(item.status, ItemStatus.DEPRECATED)
        self.assertEqual(CatalogVersion.current(), before + 1)

    def test_admin_blocks_delete_when_referenced(self):
        from django.contrib.admin.sites import AdminSite
        from django.test import RequestFactory

        from .admin import ThemeItemAdmin
        from .services import item_is_referenced

        applied = self.client.post(
            "/users/theme/apply/",
            data={"item_type": "theme", "item_id": "default", "platform": "h5"},
            content_type="application/json",
            **self.auth(),
        )
        self.assertEqual(applied.status_code, 200)
        self.assertTrue(item_is_referenced(ItemType.THEME, "default"))

        request = RequestFactory().get("/admin/themes/themeitem/")
        request.user = User.objects.create_superuser(
            username="theme-admin",
            password="pw",
            email="theme-admin@example.com",
        )
        admin = ThemeItemAdmin(ThemeItem, AdminSite())
        live = ThemeItem.objects.get(theme_id="default")
        self.assertFalse(admin.has_delete_permission(request, live))

        draft = ThemeItem(
            theme_id="draft-admin",
            name="草稿主题",
            status=ItemStatus.COMING,
            support_terminal=["h5"],
        )
        draft.save()
        self.assertTrue(admin.has_delete_permission(request, draft))

        request.user = User.objects.create_user(
            username="theme-staff",
            password="pw",
            email="theme-staff@example.com",
            is_staff=True,
        )
        self.assertFalse(admin.has_delete_permission(request, draft))
