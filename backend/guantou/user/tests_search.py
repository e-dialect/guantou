from django.contrib.auth.models import User
from django.test import Client, TestCase

from user.models import UserInfo
from user.tokens import generate_token


class UserSearchApiTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.viewer = self.create_user("viewer", "查看者")
        self.auth = {"HTTP_AUTHORIZATION": f"Bearer {generate_token(self.viewer)}"}

    @staticmethod
    def create_user(username, nickname, **user_fields):
        user = User.objects.create_user(
            username=username,
            password="pw",
            **user_fields,
        )
        UserInfo.objects.create(user=user, nickname=nickname)
        return user

    def test_search_matches_public_identity_fields_and_ranks_exact_match_first(self):
        partial = self.create_user("lin-local", "阿林")
        exact = self.create_user("lin", "林老师")
        nickname = self.create_user("collector", "林氏方言采集者")

        response = self.client.get("/users?search=lin&limit=8", **self.auth)

        self.assertEqual(response.status_code, 200)
        users = response.json()["users"]
        self.assertEqual(users[0]["id"], exact.id)
        self.assertEqual({item["id"] for item in users}, {partial.id, exact.id})
        self.assertNotIn(nickname.id, [item["id"] for item in users])
        self.assertNotIn("email", users[0])
        self.assertNotIn("telephone", users[0])

        nickname_response = self.client.get(
            "/users?search=方言采集&limit=8", **self.auth
        )
        self.assertEqual(
            [item["id"] for item in nickname_response.json()["users"]],
            [nickname.id],
        )

    def test_search_supports_exact_id_and_excludes_non_recipients(self):
        target = self.create_user("target", "目标用户")
        admin = self.create_user("admin", "管理员", is_superuser=True)
        inactive = self.create_user("inactive", "停用用户", is_active=False)

        target_response = self.client.get(f"/users?search={target.id}", **self.auth)
        self.assertEqual(
            [item["id"] for item in target_response.json()["users"]],
            [target.id],
        )

        for user in (self.viewer, admin, inactive):
            response = self.client.get(f"/users?search={user.id}", **self.auth)
            self.assertEqual(response.json()["users"], [])

    def test_search_requires_login_and_does_not_search_private_fields(self):
        self.create_user(
            "safe-name",
            "公开昵称",
            email="private@example.com",
        )

        anonymous = self.client.get("/users?search=safe-name")
        self.assertEqual(anonymous.status_code, 401)

        private = self.client.get("/users?search=private%40example.com", **self.auth)
        self.assertEqual(private.status_code, 200)
        self.assertEqual(private.json()["users"], [])

    def test_search_handles_blank_query_and_bounds_the_result_count(self):
        for index in range(3):
            self.create_user(f"result-{index}", f"结果 {index}")

        blank = self.client.get("/users?search=%20%20", **self.auth)
        self.assertEqual(blank.status_code, 200)
        self.assertEqual(blank.json()["users"], [])

        oversized_id = self.client.get(f"/users?search={'9' * 100}", **self.auth)
        self.assertEqual(oversized_id.status_code, 200)
        self.assertEqual(oversized_id.json()["users"], [])

        limited = self.client.get("/users?search=result&limit=1", **self.auth)
        self.assertEqual(len(limited.json()["users"]), 1)

        invalid = self.client.get("/users?search=result&limit=many", **self.auth)
        self.assertEqual(invalid.status_code, 400)
