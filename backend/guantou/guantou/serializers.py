from rest_framework import serializers

from .models import (
    Can,
    Dialect,
    Flavor,
    FlavorPackage,
    FlavorVariant,
    Nameplate,
    NameplateSupport,
    Package,
    Shelf,
)
from .services import create_can_submission


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


class DialectSerializer(serializers.ModelSerializer):
    parent_id = serializers.PrimaryKeyRelatedField(
        source="parent",
        queryset=Dialect.objects.all(),
        required=False,
        allow_null=True,
        write_only=True,
    )
    children_count = serializers.SerializerMethodField()

    def get_children_count(self, obj):
        return obj.children.count()

    class Meta:
        model = Dialect
        fields = [
            "id",
            "name",
            "code",
            "parent",
            "parent_id",
            "children_count",
            "region_level",
            "province",
            "city",
            "county",
            "town",
            "description",
            "metadata",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "parent", "created_at", "updated_at"]


class PackageSerializer(serializers.ModelSerializer):
    flavors = serializers.SerializerMethodField()

    class Meta:
        model = Package
        fields = [
            "id",
            "text",
            "package_type",
            "unicode",
            "metadata",
            "flavors",
            "created_at",
        ]
        read_only_fields = ["id", "flavors", "created_at"]

    def get_flavors(self, obj):
        return [
            {
                "id": flavor.id,
                "name": flavor.name,
                "definition": flavor.definition,
                "mandarin": flavor.mandarin,
            }
            for flavor in obj.flavors.all()
        ]


class FlavorPackageSerializer(serializers.ModelSerializer):
    package = PackageSerializer(read_only=True)
    package_id = serializers.PrimaryKeyRelatedField(
        source="package", queryset=Package.objects.all(), write_only=True
    )

    class Meta:
        model = FlavorPackage
        fields = ["id", "package", "package_id", "mapping_type", "note"]
        read_only_fields = ["id"]


class FlavorVariantSerializer(serializers.ModelSerializer):
    dialect_detail = DialectSerializer(source="dialect", read_only=True)
    created_by = UserLiteSerializer(read_only=True)

    class Meta:
        model = FlavorVariant
        fields = [
            "id",
            "flavor",
            "dialect",
            "dialect_detail",
            "ipa",
            "romanization",
            "tone_value",
            "reading_type",
            "sandhi_info",
            "is_canonical",
            "status",
            "audio_url",
            "audio_source",
            "created_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_by", "created_at", "updated_at"]

    def create(self, validated_data):
        request = self.context.get("request")
        if request and request.user and request.user.is_authenticated:
            validated_data["created_by"] = request.user
        return super().create(validated_data)


class FlavorSerializer(serializers.ModelSerializer):
    created_by = UserLiteSerializer(read_only=True)
    package_links = FlavorPackageSerializer(
        source="flavorpackage_set", many=True, read_only=True
    )
    variants = FlavorVariantSerializer(many=True, read_only=True)
    package_ids = serializers.PrimaryKeyRelatedField(
        queryset=Package.objects.all(), many=True, write_only=True, required=False
    )

    class Meta:
        model = Flavor
        fields = [
            "id",
            "name",
            "definition",
            "mandarin",
            "tags",
            "geo_scope",
            "visibility",
            "created_by",
            "package_links",
            "package_ids",
            "variants",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_by", "created_at", "updated_at"]

    def create(self, validated_data):
        package_ids = validated_data.pop("package_ids", [])
        request = self.context.get("request")
        if request and request.user and request.user.is_authenticated:
            validated_data["created_by"] = request.user
        flavor = super().create(validated_data)
        for package in package_ids:
            FlavorPackage.objects.get_or_create(flavor=flavor, package=package)
        return flavor

    def update(self, instance, validated_data):
        package_ids = validated_data.pop("package_ids", None)
        flavor = super().update(instance, validated_data)
        if package_ids is not None:
            FlavorPackage.objects.filter(flavor=flavor).delete()
            for package in package_ids:
                FlavorPackage.objects.get_or_create(flavor=flavor, package=package)
        return flavor


class NameplateSerializer(serializers.ModelSerializer):
    creator = UserLiteSerializer(read_only=True)
    flavor_detail = FlavorSerializer(source="flavor", read_only=True)
    package_detail = PackageSerializer(source="package", read_only=True)
    supported_by_current_user = serializers.SerializerMethodField()

    class Meta:
        model = Nameplate
        fields = [
            "id",
            "can",
            "flavor",
            "flavor_detail",
            "package",
            "package_detail",
            "creator",
            "text_content",
            "definition",
            "evidence_level",
            "source_citation",
            "weight",
            "is_primary",
            "supported_by_current_user",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "creator",
            "weight",
            "is_primary",
            "supported_by_current_user",
            "created_at",
            "updated_at",
        ]

    def get_supported_by_current_user(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False
        return NameplateSupport.objects.filter(nameplate=obj, user=user).exists()

    def create(self, validated_data):
        request = self.context.get("request")
        if request and request.user and request.user.is_authenticated:
            validated_data["creator"] = request.user
        nameplate = super().create(validated_data)
        if not nameplate.can.nameplates.exclude(id=nameplate.id).exists():
            nameplate.promote_to_primary()
            if nameplate.can.status == Can.Status.UNLABELED:
                nameplate.can.status = Can.Status.PENDING
                nameplate.can.save(update_fields=["status", "updated_at"])
        return nameplate


class CanSerializer(serializers.ModelSerializer):
    recorder = UserLiteSerializer(read_only=True)
    dialect_detail = DialectSerializer(source="dialect", read_only=True)
    flavor_variant_detail = FlavorVariantSerializer(
        source="flavor_variant", read_only=True
    )
    nameplates = NameplateSerializer(many=True, read_only=True)
    primary_nameplate = serializers.SerializerMethodField()
    initial_nameplate = serializers.DictField(write_only=True, required=False)
    flavor = serializers.PrimaryKeyRelatedField(
        queryset=Flavor.objects.all(),
        write_only=True,
        required=False,
        allow_null=True,
    )

    class Meta:
        model = Can
        fields = [
            "id",
            "audio_url",
            "recorder",
            "dialect",
            "dialect_detail",
            "flavor_variant",
            "flavor_variant_detail",
            "concept_text",
            "source_note",
            "province",
            "city",
            "county",
            "town",
            "duration_ms",
            "status",
            "visibility",
            "verifier",
            "transition_log",
            "metadata",
            "views",
            "nameplates",
            "primary_nameplate",
            "initial_nameplate",
            "flavor",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "recorder",
            "visibility",
            "verifier",
            "transition_log",
            "views",
            "nameplates",
            "primary_nameplate",
            "created_at",
            "updated_at",
        ]

    def get_primary_nameplate(self, obj):
        primary = obj.primary_nameplate
        if not primary:
            return None
        return NameplateSerializer(primary, context=self.context).data

    def create(self, validated_data):
        initial_nameplate = validated_data.pop("initial_nameplate", None)
        flavor = validated_data.pop("flavor", None)
        request = self.context.get("request")
        user = request.user if request else None
        return create_can_submission(
            user=user,
            can_data=validated_data,
            initial_nameplate=initial_nameplate,
            flavor=flavor,
        )


class ShelfSerializer(serializers.ModelSerializer):
    creator = UserLiteSerializer(read_only=True)
    flavors = FlavorSerializer(many=True, read_only=True)
    cans = CanSerializer(many=True, read_only=True)
    flavor_ids = serializers.PrimaryKeyRelatedField(
        queryset=Flavor.objects.all(),
        source="flavors",
        many=True,
        write_only=True,
        required=False,
    )
    can_ids = serializers.PrimaryKeyRelatedField(
        queryset=Can.objects.all(),
        source="cans",
        many=True,
        write_only=True,
        required=False,
    )

    class Meta:
        model = Shelf
        fields = [
            "id",
            "title",
            "slug",
            "description",
            "shelf_type",
            "creator",
            "flavors",
            "cans",
            "flavor_ids",
            "can_ids",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "creator", "created_at", "updated_at"]

    def create(self, validated_data):
        flavors = validated_data.pop("flavors", [])
        cans = validated_data.pop("cans", [])
        request = self.context.get("request")
        if request and request.user and request.user.is_authenticated:
            validated_data["creator"] = request.user
        shelf = super().create(validated_data)
        shelf.flavors.set(flavors)
        shelf.cans.set(cans)
        return shelf

    def update(self, instance, validated_data):
        flavors = validated_data.pop("flavors", None)
        cans = validated_data.pop("cans", None)
        shelf = super().update(instance, validated_data)
        if flavors is not None:
            shelf.flavors.set(flavors)
        if cans is not None:
            shelf.cans.set(cans)
        return shelf
