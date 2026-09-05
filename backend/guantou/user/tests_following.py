from django.contrib.auth.models import User
from django.test import Client, TestCase

from guantou.models import Dialect, Recording
from user.models import UserFollow, UserInfo
from user.tokens import generate_token


class UserFollowingApiTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.dialect = Dialect.objects.create(name="四川话", code="四川")
        self.viewer = self.create_user("viewer", self.dialect)
        self.author = self.create_user("author", self.dialect)
        self.other = self.create_user("other", self.dialect)
        Recording.objects.create(
            recorder=self.author,
            audio_url="https://example.com/author.mp3",
            usage_dialect=self.dialect,
            visibility=True,
        )
        Recording.objects.create(
            recorder=self.other,
            audio_url="https://example.com/other.mp3",
            usage_dialect=self.dialect,
            visibility=True,
        )
        self.auth = {"HTTP_AUTHORIZATION": f"Bearer {generate_token(self.viewer)}"}

    @staticmethod
    def create_user(username, dialect):
        user = User.objects.create_user(username=username, password="pw")
        UserInfo.objects.create(
            user=user, nickname=username.title(), primary_dialect=dialect
        )
        return user

    def test_author_follow_is_idempotent_and_rejects_self_follow(self):
        url = f"/users/{self.author.id}/follow"
        first = self.client.put(url, **self.auth)
        second = self.client.put(url, **self.auth)

        self.assertEqual(first.status_code, 200)
        self.assertTrue(first.json()["created"])
        self.assertFalse(second.json()["created"])
        self.assertEqual(UserFollow.objects.count(), 1)

        self_follow = self.client.put(f"/users/{self.viewer.id}/follow", **self.auth)
        self.assertEqual(self_follow.status_code, 400)
        self_unfollow = self.client.delete(
            f"/users/{self.viewer.id}/follow", **self.auth
        )
        self.assertEqual(self_unfollow.status_code, 400)

        deleted = self.client.delete(url, **self.auth)
        repeated = self.client.delete(url, **self.auth)
        self.assertTrue(deleted.json()["deleted"])
        self.assertFalse(repeated.json()["deleted"])

    def test_recommendations_use_real_same_dialect_authors_and_exclude_followed(self):
        UserFollow.objects.create(follower=self.viewer, followed=self.author)

        response = self.client.get(
            f"/users/recommendations?dialect_id={self.dialect.id}&limit=6",
            **self.auth,
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [item["id"] for item in response.json()["results"]], [self.other.id]
        )
        self.assertEqual(response.json()["results"][0]["public_recording_count"], 1)

    def test_dialect_follow_and_private_subscription_list(self):
        follow = self.client.put(f"/dialects/{self.dialect.id}/follow/", **self.auth)
        self.assertEqual(follow.status_code, 200)
        self.assertTrue(follow.json()["following"])

        public_profile = self.client.get(f"/users/{self.viewer.id}").json()["user"]
        self.assertNotIn("followed_dialects", public_profile)

        private_profile = self.client.get(
            f"/users/{self.viewer.id}", **self.auth
        ).json()["user"]
        self.assertEqual(private_profile["followed_dialects"][0]["id"], self.dialect.id)

        unfollow = self.client.delete(
            f"/dialects/{self.dialect.id}/follow/", **self.auth
        )
        self.assertTrue(unfollow.json()["following"])
        self.assertTrue(
            self.viewer.user_info.followed_dialects.filter(id=self.dialect.id).exists()
        )

        secondary = Dialect.objects.create(name="客家话", code="客家")
        self.client.put(f"/dialects/{secondary.id}/follow/", **self.auth)
        removed = self.client.delete(f"/dialects/{secondary.id}/follow/", **self.auth)
        self.assertFalse(removed.json()["following"])
