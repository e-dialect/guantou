from django.db import transaction
from rest_framework import serializers

from .models import Dialect


class UserLiteSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    username = serializers.CharField()
    nickname = serializers.SerializerMethodField()
    avatar = serializers.SerializerMethodField()

    def get_nickname(self, obj):
        try:
            return obj.user_info.nickname or obj.username
        except Exception:
            return obj.username

    def get_avatar(self, obj):
        try:
            return obj.user_info.avatar or ""
        except Exception:
            return ""


class DialectRefSerializer(serializers.ModelSerializer):
    qualified_code = serializers.CharField(read_only=True)
    path_names = serializers.SerializerMethodField()

    class Meta:
        model = Dialect
        fields = [
            "id",
            "name",
            "code",
            "qualified_code",
            "path_names",
            "sort_order",
        ]

    def get_path_names(self, obj):
        names = []
        node = obj
        visited = set()
        while node is not None and node.pk not in visited:
            visited.add(node.pk)
            names.append(node.name)
            node = node.parent
        return list(reversed(names))


class DialectSerializer(DialectRefSerializer):
    parent = DialectRefSerializer(read_only=True)
    parent_id = serializers.PrimaryKeyRelatedField(
        source="parent",
        queryset=Dialect.objects.all(),
        required=False,
        allow_null=True,
        write_only=True,
    )
    ancestors = serializers.SerializerMethodField()
    children = serializers.SerializerMethodField()
    children_count = serializers.IntegerField(source="children.count", read_only=True)

    class Meta(DialectRefSerializer.Meta):
        fields = DialectRefSerializer.Meta.fields + [
            "parent",
            "parent_id",
            "ancestors",
            "children",
            "aliases",
            "children_count",
            "description",
            "external_refs",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "qualified_code", "created_at", "updated_at"]

    def _expansions(self):
        request = self.context.get("request")
        value = request.query_params.get("expand", "") if request else ""
        return {item.strip() for item in value.split(",") if item.strip()}

    def get_ancestors(self, obj):
        if "ancestors" not in self._expansions():
            return []
        ancestors = []
        node = obj.parent
        while node is not None:
            ancestors.append(node)
            node = node.parent
        return DialectRefSerializer(reversed(ancestors), many=True).data

    def get_children(self, obj):
        if "children" not in self._expansions():
            return []
        return DialectRefSerializer(obj.children.all(), many=True).data

    def validate_code(self, value):
        if any(character in value for character in (".", "/")) or any(
            character.isspace() for character in value
        ):
            raise serializers.ValidationError("短码不得包含点、斜杠或空白")
        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)
        parent = attrs.get("parent", getattr(self.instance, "parent", None))
        if self.instance and parent:
            if parent.pk == self.instance.pk:
                raise serializers.ValidationError({"parent_id": "节点不能以自身为父级"})
            if parent.pk in self.instance.descendant_ids():
                raise serializers.ValidationError({"parent_id": "父级不能是节点的后代"})
        return attrs

    @transaction.atomic
    def update(self, instance, validated_data):
        subtree = Dialect.objects.filter(
            id__in=instance.descendant_ids()
        ).select_related("parent")
        old_qualified_codes = {node.pk: node.qualified_code for node in subtree}
        updated = super().update(instance, validated_data)
        for node in Dialect.objects.filter(id__in=old_qualified_codes).select_related(
            "parent"
        ):
            old_qualified_code = old_qualified_codes[node.pk]
            if node.qualified_code == old_qualified_code:
                continue
            aliases = list(node.aliases or [])
            if old_qualified_code not in aliases:
                aliases.append(old_qualified_code)
                node.aliases = aliases
                node.save(update_fields=["aliases", "updated_at"])
        return updated
