from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from inbox.models import Notification
from user.models import UserFollow, UserInfo

from .models import (
    Can,
    CanComment,
    CanCommentLike,
    CanLike,
    CanPost,
    Dialect,
    Nameplate,
)


class CanSocialApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.root = Dialect.objects.create(name="西南官话", code="西南")
        self.child = Dialect.objects.create(
            name="四川话", code="四川", parent=self.root
        )
        self.other_dialect = Dialect.objects.create(name="客家话", code="客家")
        self.viewer = self.create_user("viewer", self.root)
        self.same_author = self.create_user("same", self.child)
        self.other_author = self.create_user("other", self.other_dialect)
        self.staff = self.create_user("staff", self.other_dialect, is_staff=True)
        self.viewer.user_info.followed_dialects.add(self.root)
        self.client.force_authenticate(self.viewer)

        self.same_can = self.make_can(self.same_author, self.child, "同方言")
        self.other_can = self.make_can(
            self.other_author, self.other_dialect, "其他方言", views=20
        )
        self.private_can = self.make_can(
            self.same_author, self.child, "私密", visibility=False
        )

    @staticmethod
    def create_user(username, dialect, **kwargs):
        user = User.objects.create_user(username=username, password="pw", **kwargs)
        UserInfo.objects.create(
            user=user,
            nickname=username.title(),
            primary_dialect=dialect,
        )
        return user

    @staticmethod
    def make_can(author, dialect, concept, **kwargs):
        values = {
            "audio_url": f"https://example.com/{concept}.mp3",
            "recorder": author,
            "submitted_dialect": dialect,
            "concept_text": concept,
            "visibility": True,
        }
        values.update(kwargs)
        return Can.objects.create(**values)

    def ids(self, response):
        self.assertEqual(response.status_code, 200)
        return [item["id"] for item in response.data["results"]]

    def test_dialect_and_following_feeds_are_public_and_deduplicated(self):
        dialect_ids = self.ids(self.client.get("/cans/", {"feed": "dialect"}))
        self.assertEqual(dialect_ids, [self.same_can.id])

        UserFollow.objects.create(
            follower=self.viewer,
            followed=self.other_author,
        )
        following = self.client.get("/cans/", {"feed": "following"})
        following_ids = self.ids(following)
        self.assertEqual(set(following_ids), {self.same_can.id, self.other_can.id})
        self.assertEqual(len(following_ids), len(set(following_ids)))
        self.assertNotIn(self.private_can.id, following_ids)

    def test_recommended_prioritizes_subscriptions_then_engagement(self):
        CanLike.objects.create(can=self.other_can, user=self.viewer)
        CanLike.objects.create(can=self.other_can, user=self.staff)

        response = self.client.get("/cans/", {"feed": "recommended"})
        results = response.data["results"]

        self.assertEqual(
            [item["id"] for item in results[:2]],
            [
                self.same_can.id,
                self.other_can.id,
            ],
        )
        other = next(item for item in results if item["id"] == self.other_can.id)
        self.assertEqual(other["like_count"], 2)
        self.assertTrue(other["liked_by_me"])
        self.assertEqual(other["recorder"]["id"], self.other_author.id)
        self.assertNotIn(self.private_can.id, [item["id"] for item in results])

        self.client.force_authenticate(None)
        guest = self.client.get("/cans/", {"feed": "recommended"})
        self.assertEqual(guest.status_code, 200)
        self.assertNotIn(self.private_can.id, self.ids(guest))

    def test_like_is_idempotent(self):
        url = f"/cans/{self.same_can.id}/like/"
        first = self.client.put(url)
        repeated = self.client.put(url)

        self.assertTrue(first.data["changed"])
        self.assertFalse(repeated.data["changed"])
        self.assertEqual(CanLike.objects.filter(can=self.same_can).count(), 1)

        removed = self.client.delete(url)
        repeated_remove = self.client.delete(url)
        self.assertTrue(removed.data["changed"])
        self.assertFalse(repeated_remove.data["changed"])
        self.assertEqual(repeated_remove.data["like_count"], 0)

    def test_liked_library_only_returns_the_current_users_cans(self):
        CanLike.objects.create(can=self.same_can, user=self.viewer)
        CanLike.objects.create(can=self.other_can, user=self.staff)

        self.assertEqual(
            self.ids(self.client.get("/cans/", {"liked": "true"})), [self.same_can.id]
        )

        self.client.force_authenticate(None)
        self.assertEqual(self.ids(self.client.get("/cans/", {"liked": "true"})), [])

    def test_like_and_comment_create_actionable_owner_notifications(self):
        self.client.put(f"/cans/{self.same_can.id}/like/")
        created = self.client.post(
            "/comments/",
            {"can_id": self.same_can.id, "content": "真好听"},
            format="json",
        )

        notifications = Notification.objects.filter(recipient=self.same_author)
        self.assertEqual(
            set(notifications.values_list("verb", flat=True)),
            {Notification.Verb.CAN_LIKE, Notification.Verb.CAN_COMMENT},
        )
        comment_notice = notifications.get(verb=Notification.Verb.CAN_COMMENT)
        self.assertEqual(comment_notice.metadata["target_id"], self.same_can.id)
        self.assertEqual(
            comment_notice.metadata["target_url"],
            f"/pages/cans/details?id={self.same_can.id}",
        )
        self.assertEqual(created.status_code, 201)

        self.client.force_authenticate(self.same_author)
        self.client.put(f"/cans/{self.same_can.id}/like/")
        self.assertEqual(
            Notification.objects.filter(
                recipient=self.same_author, verb=Notification.Verb.CAN_LIKE
            ).count(),
            1,
        )

    def test_comment_likes_are_idempotent_and_notify_the_author(self):
        comment = CanComment.objects.create(
            can=self.same_can,
            author=self.same_author,
            content="值得收藏",
        )
        url = f"/comments/{comment.id}/like/"

        first = self.client.put(url)
        repeated = self.client.put(url)
        self.assertTrue(first.data["changed"])
        self.assertFalse(repeated.data["changed"])
        self.assertEqual(CanCommentLike.objects.filter(comment=comment).count(), 1)
        notice = Notification.objects.get(
            recipient=self.same_author,
            verb=Notification.Verb.COMMENT_LIKE,
        )
        self.assertEqual(notice.metadata["target_id"], self.same_can.id)

        removed = self.client.delete(url)
        self.assertTrue(removed.data["changed"])
        self.assertEqual(removed.data["like_count"], 0)

    def test_can_detail_only_embeds_the_three_latest_comments(self):
        comments = [
            CanComment.objects.create(
                can=self.same_can,
                author=self.viewer,
                content=f"评论 {index}",
            )
            for index in range(4)
        ]

        response = self.client.get(f"/cans/{self.same_can.id}/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [item["id"] for item in response.data["recent_comments"]],
            [comment.id for comment in reversed(comments[1:])],
        )

    def test_comment_validation_visibility_and_delete_permissions(self):
        created = self.client.post(
            "/comments/",
            {"can_id": self.same_can.id, "content": "  真好听  "},
            format="json",
        )
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.data["content"], "真好听")
        comment_id = created.data["id"]

        listed = self.client.get("/comments/", {"can_id": self.same_can.id})
        self.assertEqual([item["id"] for item in listed.data["results"]], [comment_id])

        blank = self.client.post(
            "/comments/",
            {"can_id": self.same_can.id, "content": "   "},
            format="json",
        )
        self.assertEqual(blank.status_code, 400)
        too_long = self.client.post(
            "/comments/",
            {"can_id": self.same_can.id, "content": "好" * 501},
            format="json",
        )
        self.assertEqual(too_long.status_code, 400)
        private = self.client.post(
            "/comments/",
            {"can_id": self.private_can.id, "content": "看不见"},
            format="json",
        )
        self.assertEqual(private.status_code, 400)

        self.client.force_authenticate(self.other_author)
        forbidden = self.client.delete(f"/comments/{comment_id}/")
        self.assertEqual(forbidden.status_code, 403)
        self.assertTrue(CanComment.objects.filter(id=comment_id).exists())

        self.client.force_authenticate(self.viewer)
        deleted = self.client.delete(f"/comments/{comment_id}/")
        self.assertEqual(deleted.status_code, 204)

        second = CanComment.objects.create(
            can=self.same_can,
            author=self.viewer,
            content="由管理员处理",
        )
        self.client.force_authenticate(self.staff)
        admin_deleted = self.client.delete(f"/comments/{second.id}/")
        self.assertEqual(admin_deleted.status_code, 204)

    def test_anonymous_guests_can_browse_public_comments(self):
        # 评论属于可浏览内容：游客可 GET 公开罐头的评论列表（发布/回复仍需登录，见 #202）。
        comment = CanComment.objects.create(
            can=self.same_can,
            author=self.viewer,
            content="游客可见的评论",
        )

        self.client.force_authenticate(None)
        response = self.client.get("/comments/", {"can_id": self.same_can.id})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [item["id"] for item in response.data["results"]], [comment.id]
        )
        # 游客态 liked_by_me 恒为假，前端不得依赖其为真值。
        self.assertFalse(response.data["results"][0]["liked_by_me"])

    def test_nameplate_comments_are_targeted_and_separate_from_can_comments(self):
        plate = Nameplate.objects.create(
            can=self.same_can,
            creator=self.same_author,
            text_content="巴适",
            source={"type": Nameplate.SourceType.CREATOR},
        )
        can_comment = CanComment.objects.create(
            can=self.same_can,
            author=self.viewer,
            content="录音很清楚",
        )

        created = self.client.post(
            "/comments/",
            {"nameplate_id": plate.id, "content": "这个写法我也见过"},
            format="json",
        )

        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.data["can_id"], self.same_can.id)
        self.assertEqual(created.data["nameplate_id"], plate.id)
        invalid_target = self.client.post(
            "/comments/",
            {
                "can_id": self.same_can.id,
                "nameplate_id": plate.id,
                "content": "不能同时挂两个目标",
            },
            format="json",
        )
        self.assertEqual(invalid_target.status_code, 400)
        moved = self.client.put(
            f"/comments/{created.data['id']}/",
            {"can_id": self.same_can.id, "content": "试图移动评论"},
            format="json",
        )
        self.assertEqual(moved.status_code, 400)
        self.assertEqual(
            [
                item["id"]
                for item in self.client.get(
                    "/comments/", {"can_id": self.same_can.id}
                ).data["results"]
            ],
            [can_comment.id],
        )
        self.assertEqual(
            [
                item["id"]
                for item in self.client.get(
                    "/comments/", {"nameplate_id": plate.id}
                ).data["results"]
            ],
            [created.data["id"]],
        )
        notice = Notification.objects.get(
            recipient=self.same_author,
            verb=Notification.Verb.CAN_COMMENT,
            related_object_id=str(created.data["id"]),
        )
        self.assertEqual(notice.metadata["target_type"], "nameplate")
        self.assertEqual(
            notice.metadata["target_url"],
            f"/pages/nameplates/comments?id={plate.id}",
        )

    def test_replies_are_two_level_and_do_not_notify_the_recorder(self):
        top = self.client.post(
            "/comments/",
            {"can_id": self.same_can.id, "content": "一级评论"},
            format="json",
        )
        self.assertEqual(top.status_code, 201)
        self.assertIsNone(top.data["parent_id"])
        self.assertIsNone(top.data["reply_to"])

        reply = self.client.post(
            "/comments/",
            {"reply_to_id": top.data["id"], "content": "回复一级评论"},
            format="json",
        )
        self.assertEqual(reply.status_code, 201)
        # 回复顶层评论：parent=该顶层评论、reply_to=null。
        self.assertEqual(reply.data["parent_id"], top.data["id"])
        self.assertIsNone(reply.data["reply_to"])
        self.assertEqual(reply.data["can_id"], self.same_can.id)

        reply_to_reply = self.client.post(
            "/comments/",
            {"reply_to_id": reply.data["id"], "content": "回复那条回复"},
            format="json",
        )
        self.assertEqual(reply_to_reply.status_code, 201)
        # 回复某条回复：parent=其顶层评论、reply_to=该回复，二层平铺。
        self.assertEqual(reply_to_reply.data["parent_id"], top.data["id"])
        self.assertEqual(
            reply_to_reply.data["reply_to"]["id"], reply.data["author"]["id"]
        )
        self.assertIsNotNone(reply_to_reply.data["reply_to"]["nickname"])

        # 顶层列表只返回一级评论，并带回复数。
        top_list = self.client.get("/comments/", {"can_id": self.same_can.id})
        self.assertEqual(
            [item["id"] for item in top_list.data["results"]], [top.data["id"]]
        )
        self.assertEqual(top_list.data["results"][0]["reply_count"], 2)

        # 按 parent_id 返回该一级评论下的回复（二层平铺，时间正序）。
        replies = self.client.get("/comments/", {"parent_id": top.data["id"]})
        self.assertEqual(
            [item["id"] for item in replies.data["results"]],
            [reply.data["id"], reply_to_reply.data["id"]],
        )

        # 回复不触发「罐头有新评论」通知（仅顶层评论通知）。
        self.assertEqual(
            Notification.objects.filter(
                recipient=self.same_author, verb=Notification.Verb.CAN_COMMENT
            ).count(),
            1,
        )

    def test_reply_target_must_be_visible_and_cannot_be_reassigned(self):
        top = CanComment.objects.create(
            can=self.same_can,
            author=self.viewer,
            content="顶层",
        )
        private_can_comment = CanComment.objects.create(
            can=self.private_can,
            author=self.same_author,
            content="私密罐里的评论",
        )
        # 回复私密罐的评论应被 can 可见性过滤挡住（目标查不到 → 400）。
        invalid = self.client.post(
            "/comments/",
            {"reply_to_id": private_can_comment.id, "content": "不能回复"},
            format="json",
        )
        self.assertEqual(invalid.status_code, 400)

        reply = self.client.post(
            "/comments/",
            {"reply_to_id": top.id, "content": "正常回复"},
            format="json",
        )
        # 已创建的回复不可改挂到别处。
        moved = self.client.put(
            f"/comments/{reply.data['id']}/",
            {"reply_to_id": top.id, "content": "试图改目标"},
            format="json",
        )
        self.assertEqual(moved.status_code, 400)

    def test_use_same_requires_a_visible_can_and_never_creates_text_only_posts(self):
        missing = self.client.post(
            "/posts/", {"text": "没有语音的纯文字"}, format="json"
        )
        private = self.client.post(
            "/posts/",
            {"can_id": self.private_can.id, "text": "看不见的来源"},
            format="json",
        )

        self.assertEqual(missing.status_code, 400)
        self.assertEqual(private.status_code, 400)
        self.assertEqual(CanPost.objects.count(), 0)

    def test_use_same_creates_post_count_reference_and_owner_notification(self):
        created = self.client.post(
            "/posts/",
            {
                "can_id": self.same_can.id,
                "text": "  我家也这样说  ",
                "visibility": "public",
            },
            format="json",
        )

        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.data["can_id"], self.same_can.id)
        self.assertEqual(created.data["text"], "我家也这样说")
        self.assertEqual(created.data["source"]["recorder"]["id"], self.same_author.id)
        detail = self.client.get(f"/cans/{self.same_can.id}/")
        self.assertEqual(detail.data["use_count"], 1)
        self.assertEqual(detail.data["recent_posts"][0]["id"], created.data["id"])

        notice = Notification.objects.get(
            recipient=self.same_author,
            verb=Notification.Verb.CAN_REUSE,
        )
        self.assertEqual(notice.metadata["target_type"], "can_post")
        self.assertEqual(
            notice.metadata["target_url"],
            f"/pages/posts/details?id={created.data['id']}",
        )

    def test_private_post_visibility_and_delete_permissions(self):
        post = CanPost.objects.create(
            can=self.same_can,
            author=self.viewer,
            text="只给自己",
            visibility=CanPost.Visibility.PRIVATE,
            source_snapshot={"can_id": self.same_can.id},
        )

        self.client.force_authenticate(self.other_author)
        self.assertEqual(self.client.get(f"/posts/{post.id}/").status_code, 404)
        self.assertEqual(self.client.delete(f"/posts/{post.id}/").status_code, 404)

        self.client.force_authenticate(self.viewer)
        mine = self.client.get("/posts/", {"mine": "true"})
        self.assertEqual([item["id"] for item in mine.data["results"]], [post.id])
        self.assertEqual(self.client.delete(f"/posts/{post.id}/").status_code, 204)

    def test_post_survives_deleted_source_with_a_safe_snapshot(self):
        created = self.client.post(
            "/posts/",
            {"can_id": self.other_can.id, "text": "保留这条表达"},
            format="json",
        )
        post_id = created.data["id"]

        self.other_can.delete()
        detail = self.client.get(f"/posts/{post_id}/")

        self.assertEqual(detail.status_code, 200)
        self.assertIsNone(detail.data["can_id"])
        self.assertTrue(detail.data["source"]["source_unavailable"])
        self.assertTrue(detail.data["can"]["source_unavailable"])
        self.assertEqual(detail.data["can"]["concept_text"], "其他方言")

    def test_reusing_own_can_does_not_create_a_self_notification(self):
        self.client.force_authenticate(self.same_author)
        response = self.client.post(
            "/posts/",
            {"can_id": self.same_can.id, "text": "自己的补充"},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertFalse(
            Notification.objects.filter(
                recipient=self.same_author,
                verb=Notification.Verb.CAN_REUSE,
            ).exists()
        )
