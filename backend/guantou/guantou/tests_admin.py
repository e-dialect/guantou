from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse

from .models import Dialect


class DialectAdminTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(
            username="dialect-admin",
            email="dialect-admin@example.test",
            password="admin-test-password",
        )
        self.client.force_login(self.admin)
        self.parent = Dialect.objects.get(code="莆仙", parent__code="闽")

    def test_changelist_displays_qualified_code(self):
        response = self.client.get(reverse("admin:guantou_dialect_changelist"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "闽.莆仙.莆田.城里")

    def test_admin_can_create_edit_and_delete_dialect(self):
        create_response = self.client.post(
            reverse("admin:guantou_dialect_add"),
            {
                "name": "后台测试方言",
                "code": "后台测试",
                "parent": self.parent.id,
                "sort_order": 500,
                "aliases": "[]",
                "description": "由后台动态维护",
                "external_refs": "{}",
                "_save": "保存",
            },
        )
        self.assertEqual(create_response.status_code, 302)
        dialect = Dialect.objects.get(parent=self.parent, code="后台测试")

        change_response = self.client.post(
            reverse("admin:guantou_dialect_change", args=[dialect.id]),
            {
                "name": "后台修改后的方言",
                "code": "后台测试",
                "parent": self.parent.id,
                "sort_order": 510,
                "aliases": '["历史限定码"]',
                "description": "人工修改不会被种子迁移覆盖",
                "external_refs": "{}",
                "_save": "保存",
            },
        )
        self.assertEqual(change_response.status_code, 302)
        dialect.refresh_from_db()
        self.assertEqual(dialect.name, "后台修改后的方言")
        self.assertEqual(dialect.aliases, ["历史限定码"])

        delete_response = self.client.post(
            reverse("admin:guantou_dialect_delete", args=[dialect.id]),
            {"post": "yes"},
        )
        self.assertEqual(delete_response.status_code, 302)
        self.assertFalse(Dialect.objects.filter(pk=dialect.id).exists())
