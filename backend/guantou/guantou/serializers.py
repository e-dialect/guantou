from django.db import transaction
from django.db.models import Count, Exists, OuterRef
from rest_framework import serializers
from user.models import UserFollow
from utils.exceptions.payload import field_error
from utils.exceptions.types.conflict import ConflictException

from .models import (
    Can,
    CanComment,
    CanCommentLike,
    CanLike,
    CanPost,
    Dialect,
    DialectCircle,
    Flavor,
    FlavorPackage,
    Nameplate,
    Package,
    Pronunciation,
    RecordingChallenge,
    Shelf,
    ShelfCan,
    ShelfFlavor,
)
from .services import clean_text, create_can_submission, normalize_transition_log


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

    class Meta:
        model = Dialect
        fields = ["id", "name", "code", "qualified_code", "sort_order"]


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


class DialectCircleSerializer(serializers.ModelSerializer):
    dialect = DialectRefSerializer(read_only=True)
    member_count = serializers.IntegerField(read_only=True)
    can_count = serializers.SerializerMethodField()
    is_member = serializers.BooleanField(read_only=True)

    class Meta:
        model = DialectCircle
        fields = [
            "id",
            "name",
            "description",
            "dialect",
            "member_count",
            "can_count",
            "is_member",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_can_count(self, obj):
        return Can.objects.filter(
            visibility=True,
            submitted_dialect_id__in=obj.dialect.descendant_ids(),
        ).count()


class RecordingChallengeSerializer(serializers.ModelSerializer):
    flavor = serializers.SerializerMethodField()
    dialect = DialectRefSerializer(read_only=True)

    class Meta:
        model = RecordingChallenge
        fields = ["id", "title", "prompt", "flavor", "dialect"]
        read_only_fields = fields

    def get_flavor(self, obj):
        return FlavorRefSerializer(obj.flavor).data if obj.flavor_id else None


class PackageRefSerializer(serializers.ModelSerializer):
    class Meta:
        model = Package
        fields = ["id", "text", "package_type"]


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
            "updated_at",
        ]
        read_only_fields = ["id", "flavors", "created_at", "updated_at"]

    def get_flavors(self, obj):
        return FlavorRefSerializer(obj.flavors.all(), many=True).data


class FlavorRefSerializer(serializers.ModelSerializer):
    class Meta:
        model = Flavor
        fields = ["id", "name", "definition", "mandarin"]


class FlavorPackageSerializer(serializers.ModelSerializer):
    package = PackageRefSerializer(read_only=True)
    package_id = serializers.PrimaryKeyRelatedField(
        source="package", queryset=Package.objects.all(), write_only=True
    )

    class Meta:
        model = FlavorPackage
        fields = ["id", "package", "package_id", "mapping_type", "note"]
        read_only_fields = ["id"]


class PronunciationRefSerializer(serializers.ModelSerializer):
    class Meta:
        model = Pronunciation
        fields = [
            "id",
            "ipa",
            "base_romanization",
            "surface_romanization",
            "reading_type",
            "status",
            "is_canonical",
        ]


class PronunciationCardSerializer(PronunciationRefSerializer):
    package = PackageRefSerializer(read_only=True)
    flavor = FlavorRefSerializer(read_only=True)
    dialect = DialectRefSerializer(read_only=True)
    evidence_count = serializers.SerializerMethodField()

    class Meta(PronunciationRefSerializer.Meta):
        fields = PronunciationRefSerializer.Meta.fields + [
            "package",
            "flavor",
            "dialect",
            "evidence_count",
        ]

    def get_evidence_count(self, obj):
        queryset = obj.attestations.filter(status=Nameplate.Status.ACTIVE)
        request = self.context.get("request")
        if request:
            from .services import visible_cans_for_user

            queryset = queryset.filter(can__in=visible_cans_for_user(request.user))
        return queryset.count()


class PronunciationSerializer(serializers.ModelSerializer):
    ipa = serializers.CharField(max_length=120, required=True, allow_blank=False)
    package = PackageRefSerializer(read_only=True)
    flavor = FlavorRefSerializer(read_only=True)
    dialect = DialectRefSerializer(read_only=True)
    package_id = serializers.PrimaryKeyRelatedField(
        source="package", queryset=Package.objects.all(), write_only=True
    )
    flavor_id = serializers.PrimaryKeyRelatedField(
        source="flavor", queryset=Flavor.objects.all(), write_only=True
    )
    dialect_id = serializers.PrimaryKeyRelatedField(
        source="dialect", queryset=Dialect.objects.all(), write_only=True
    )
    created_by = UserLiteSerializer(read_only=True)
    evidence_count = serializers.SerializerMethodField()
    attestations = serializers.SerializerMethodField()

    class Meta:
        model = Pronunciation
        fields = [
            "id",
            "package",
            "package_id",
            "flavor",
            "flavor_id",
            "dialect",
            "dialect_id",
            "ipa",
            "base_romanization",
            "surface_romanization",
            "reading_type",
            "usage_note",
            "sandhi_info",
            "is_canonical",
            "status",
            "source_citation",
            "evidence_count",
            "attestations",
            "created_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "is_canonical",
            "status",
            "evidence_count",
            "attestations",
            "created_by",
            "created_at",
            "updated_at",
        ]

    def get_attestations(self, obj):
        queryset = obj.attestations.filter(status=Nameplate.Status.ACTIVE)
        request = self.context.get("request")
        if request:
            from .services import visible_cans_for_user

            queryset = queryset.filter(can__in=visible_cans_for_user(request.user))
        return NameplateCardSerializer(queryset, many=True, context=self.context).data

    def get_evidence_count(self, obj):
        queryset = obj.attestations.filter(status=Nameplate.Status.ACTIVE)
        request = self.context.get("request")
        if request:
            from .services import visible_cans_for_user

            queryset = queryset.filter(can__in=visible_cans_for_user(request.user))
        return queryset.count()

    def validate(self, attrs):
        attrs = super().validate(attrs)
        package = attrs.get("package", getattr(self.instance, "package", None))
        flavor = attrs.get("flavor", getattr(self.instance, "flavor", None))
        if (
            package
            and flavor
            and not FlavorPackage.objects.filter(
                package=package, flavor=flavor
            ).exists()
        ):
            raise serializers.ValidationError(
                {"package_id": "该写法尚未与所选义项建立关联"}
            )
        sandhi_info = attrs.get(
            "sandhi_info", getattr(self.instance, "sandhi_info", {})
        )
        base = attrs.get(
            "base_romanization",
            getattr(self.instance, "base_romanization", ""),
        )
        surface = attrs.get(
            "surface_romanization",
            getattr(self.instance, "surface_romanization", ""),
        )
        if sandhi_info and not (base and surface):
            raise serializers.ValidationError(
                {"sandhi_info": "填写变调信息时必须同时提供变调前和变调后罗马字"}
            )
        return attrs

    def create(self, validated_data):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            validated_data["created_by"] = request.user
        return super().create(validated_data)


class FlavorSerializer(serializers.ModelSerializer):
    created_by = UserLiteSerializer(read_only=True)
    package_links = FlavorPackageSerializer(
        source="flavorpackage_set", many=True, required=False
    )
    pronunciations = PronunciationCardSerializer(many=True, read_only=True)

    class Meta:
        model = Flavor
        fields = [
            "id",
            "name",
            "definition",
            "mandarin",
            "tags",
            "metadata",
            "geo_scope",
            "concepticon_id",
            "visibility",
            "created_by",
            "package_links",
            "pronunciations",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_by",
            "pronunciations",
            "created_at",
            "updated_at",
        ]

    def _replace_package_links(self, flavor, links):
        seen = set()
        FlavorPackage.objects.filter(flavor=flavor).delete()
        for link in links:
            package = link["package"]
            if package.pk in seen:
                raise serializers.ValidationError(
                    {"package_links": "同一 package_id 不得重复"}
                )
            seen.add(package.pk)
            FlavorPackage.objects.create(flavor=flavor, **link)

    @transaction.atomic
    def create(self, validated_data):
        links = validated_data.pop("flavorpackage_set", [])
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            validated_data["created_by"] = request.user
        flavor = super().create(validated_data)
        self._replace_package_links(flavor, links)
        return flavor

    @transaction.atomic
    def update(self, instance, validated_data):
        links = validated_data.pop("flavorpackage_set", None)
        flavor = super().update(instance, validated_data)
        if links is not None:
            self._replace_package_links(flavor, links)
        return flavor


class CanRefSerializer(serializers.ModelSerializer):
    class Meta:
        model = Can
        fields = ["id", "audio_url", "concept_text"]


class NameplateSourceSerializer(serializers.Serializer):
    type = serializers.ChoiceField(choices=Nameplate.SourceType.choices)
    title = serializers.CharField(max_length=240, required=False, allow_blank=True)
    attributed_to = serializers.CharField(
        max_length=200, required=False, allow_blank=True
    )
    locator = serializers.CharField(max_length=160, required=False, allow_blank=True)
    url = serializers.URLField(required=False, allow_blank=True)
    note = serializers.CharField(max_length=300, required=False, allow_blank=True)

    def to_representation(self, instance):
        return dict(instance or {})


class NameplateRefSerializer(serializers.ModelSerializer):
    display_text = serializers.CharField(read_only=True)
    is_complete = serializers.BooleanField(read_only=True)

    class Meta:
        model = Nameplate
        fields = [
            "id",
            "display_text",
            "status",
            "weight",
            "is_primary",
            "is_complete",
        ]


class NameplateCardSerializer(NameplateRefSerializer):
    can = CanRefSerializer(read_only=True)
    package = PackageRefSerializer(read_only=True)
    flavor = FlavorRefSerializer(read_only=True)
    dialect = DialectRefSerializer(read_only=True)
    pronunciation = PronunciationRefSerializer(read_only=True)
    source_type = serializers.SerializerMethodField()
    support_count = serializers.SerializerMethodField()
    comment_count = serializers.SerializerMethodField()
    supported_by_current_user = serializers.SerializerMethodField()

    class Meta(NameplateRefSerializer.Meta):
        fields = NameplateRefSerializer.Meta.fields + [
            "can",
            "package",
            "flavor",
            "dialect",
            "pronunciation",
            "source_type",
            "text_content",
            "definition",
            "pronunciation_text",
            "source",
            "evidence_level",
            "support_count",
            "comment_count",
            "supported_by_current_user",
            "created_at",
        ]

    def get_source_type(self, obj):
        return (obj.source or {}).get("type", Nameplate.SourceType.OTHER)

    def get_support_count(self, obj):
        annotated = getattr(obj, "support_count", None)
        if annotated is not None:
            return annotated
        return obj.supports.count()

    def get_comment_count(self, obj):
        annotated = getattr(obj, "comment_count", None)
        if annotated is not None:
            return annotated
        return obj.comments.count()

    def get_supported_by_current_user(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not (user and user.is_authenticated):
            return False
        prefetched = getattr(obj, "_prefetched_objects_cache", {}).get("supports")
        if prefetched is not None:
            return any(support.user_id == user.id for support in prefetched)
        return obj.supports.filter(user=user).exists()


class NameplateSerializer(NameplateCardSerializer):
    can_id = serializers.PrimaryKeyRelatedField(
        source="can", queryset=Can.objects.all(), write_only=True
    )
    package_id = serializers.PrimaryKeyRelatedField(
        source="package",
        queryset=Package.objects.all(),
        write_only=True,
        required=False,
        allow_null=True,
    )
    flavor_id = serializers.PrimaryKeyRelatedField(
        source="flavor",
        queryset=Flavor.objects.all(),
        write_only=True,
        required=False,
        allow_null=True,
    )
    dialect_id = serializers.PrimaryKeyRelatedField(
        source="dialect",
        queryset=Dialect.objects.all(),
        write_only=True,
        required=False,
        allow_null=True,
    )
    pronunciation_id = serializers.PrimaryKeyRelatedField(
        source="pronunciation",
        queryset=Pronunciation.objects.all(),
        write_only=True,
        required=False,
        allow_null=True,
    )
    supersedes = NameplateRefSerializer(read_only=True)
    supersedes_id = serializers.PrimaryKeyRelatedField(
        source="supersedes",
        queryset=Nameplate.objects.all(),
        write_only=True,
        required=False,
        allow_null=True,
    )
    source = NameplateSourceSerializer()
    creator = UserLiteSerializer(read_only=True)

    class Meta(NameplateCardSerializer.Meta):
        fields = NameplateCardSerializer.Meta.fields + [
            "can_id",
            "package_id",
            "flavor_id",
            "dialect_id",
            "pronunciation_id",
            "creator",
            "supersedes",
            "supersedes_id",
            "updated_at",
        ]
        # CardSerializer 也负责展示语义字段，但创建/修订时这些字段必须保持可写。
        read_only_fields = [
            "id",
            "display_text",
            "status",
            "weight",
            "is_primary",
            "is_complete",
            "can",
            "package",
            "flavor",
            "dialect",
            "pronunciation",
            "source_type",
            "support_count",
            "comment_count",
            "creator",
            "supported_by_current_user",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):
        attrs = super().validate(attrs)
        instance = self.instance
        can = attrs.get("can", getattr(instance, "can", None))
        package = attrs.get("package", getattr(instance, "package", None))
        flavor = attrs.get("flavor", getattr(instance, "flavor", None))
        dialect = attrs.get("dialect", getattr(instance, "dialect", None))
        pronunciation = attrs.get(
            "pronunciation", getattr(instance, "pronunciation", None)
        )
        supersedes = attrs.get("supersedes", getattr(instance, "supersedes", None))

        if pronunciation:
            conflicts = {}
            if package and package.pk != pronunciation.package_id:
                conflicts["package_id"] = "与 pronunciation_id 的写法不一致"
            if flavor and flavor.pk != pronunciation.flavor_id:
                conflicts["flavor_id"] = "与 pronunciation_id 的义项不一致"
            if dialect and dialect.pk != pronunciation.dialect_id:
                conflicts["dialect_id"] = "与 pronunciation_id 的方言点不一致"
            if conflicts:
                raise ConflictException(
                    "铭牌外键与 pronunciation_id 不一致",
                    data={
                        field: field_error(message, "relation_conflict")
                        for field, message in conflicts.items()
                    },
                )
            attrs.setdefault("package", pronunciation.package)
            attrs.setdefault("flavor", pronunciation.flavor)
            attrs.setdefault("dialect", pronunciation.dialect)

        claim_values = [
            attrs.get("package", getattr(instance, "package", None)),
            attrs.get("flavor", getattr(instance, "flavor", None)),
            attrs.get("dialect", getattr(instance, "dialect", None)),
            attrs.get("pronunciation", getattr(instance, "pronunciation", None)),
            attrs.get("text_content", getattr(instance, "text_content", "")),
            attrs.get(
                "pronunciation_text", getattr(instance, "pronunciation_text", "")
            ),
        ]
        if not any(claim_values):
            raise serializers.ValidationError(
                "至少提交一个规范外键、原样写法或原样读音"
            )
        if supersedes and can and supersedes.can_id != can.pk:
            raise serializers.ValidationError(
                {"supersedes_id": "修订记录必须属于同一罐头"}
            )
        if supersedes and (
            supersedes.status != Nameplate.Status.ACTIVE
            or hasattr(supersedes, "superseded_by")
        ):
            raise ConflictException("该铭牌已经撤回或被其他修订取代")
        if supersedes and self.instance:
            ancestor = supersedes
            while ancestor is not None:
                if ancestor.pk == self.instance.pk:
                    raise serializers.ValidationError(
                        {"supersedes_id": "修订链不得形成环"}
                    )
                ancestor = ancestor.supersedes
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        request = self.context.get("request")
        user = request.user if request else None
        validated_data["creator"] = user
        if not validated_data.get("package"):
            raw_writing = clean_text(validated_data.get("text_content"))
            if raw_writing:
                validated_data["package"], _ = Package.objects.get_or_create(
                    text=raw_writing,
                    package_type=Package.PackageType.UNCERTAIN,
                    defaults={"metadata": {}},
                )
        if validated_data.get("package") and validated_data.get("flavor"):
            FlavorPackage.objects.get_or_create(
                package=validated_data["package"],
                flavor=validated_data["flavor"],
            )
        supersedes = validated_data.get("supersedes")
        old_was_primary = False
        if supersedes:
            supersedes = Nameplate.objects.select_for_update().get(pk=supersedes.pk)
            if not (user.is_staff or supersedes.creator_id == user.id):
                raise serializers.ValidationError(
                    {"supersedes_id": "只能修订本人创建的铭牌"}
                )
            old_was_primary = supersedes.is_primary
            supersedes.status = Nameplate.Status.SUPERSEDED
            supersedes.is_primary = False
            supersedes.save(update_fields=["status", "is_primary", "updated_at"])
        nameplate = super().create(validated_data)
        if old_was_primary or not nameplate.can.primary_nameplate:
            nameplate.promote_to_primary()
        if nameplate.can.status == Can.Status.UNLABELED:
            nameplate.can.status = Can.Status.PENDING
            nameplate.can.save(update_fields=["status", "updated_at"])
        return nameplate

    def update(self, instance, validated_data):
        semantic_fields = {
            "package",
            "flavor",
            "dialect",
            "pronunciation",
            "text_content",
            "definition",
            "pronunciation_text",
            "evidence_level",
            "source",
        }
        if semantic_fields.intersection(validated_data) and (
            instance.is_primary
            or instance.supports.exists()
            or hasattr(instance, "superseded_by")
        ):
            raise ConflictException(
                "该铭牌已有引用，请新建修订记录",
                data={
                    "supersedes_id": field_error(
                        "使用 supersedes_id 创建新的修订记录", "immutable_claim"
                    )
                },
            )
        return super().update(instance, validated_data)


class InitialNameplateSerializer(serializers.Serializer):
    package_id = serializers.IntegerField(min_value=1, required=False)
    flavor_id = serializers.IntegerField(min_value=1, required=False)
    dialect_id = serializers.IntegerField(min_value=1, required=False)
    pronunciation_id = serializers.IntegerField(min_value=1, required=False)
    text_content = serializers.CharField(
        max_length=160, required=False, allow_blank=True
    )
    definition = serializers.CharField(required=False, allow_blank=True)
    pronunciation_text = serializers.CharField(
        max_length=160, required=False, allow_blank=True
    )
    package_type = serializers.ChoiceField(
        choices=Package.PackageType.choices, required=False
    )
    evidence_level = serializers.ChoiceField(
        choices=Nameplate.EvidenceLevel.choices, required=False
    )
    source = NameplateSourceSerializer()

    def validate(self, attrs):
        claims = (
            "package_id",
            "flavor_id",
            "dialect_id",
            "pronunciation_id",
            "text_content",
            "pronunciation_text",
        )
        if not any(attrs.get(field) for field in claims):
            raise serializers.ValidationError(
                "至少提供一个规范外键、原样写法或原样读音"
            )
        return attrs


class CanCardSerializer(serializers.ModelSerializer):
    recorder = UserLiteSerializer(read_only=True)
    submitted_dialect = DialectRefSerializer(read_only=True)
    primary_nameplate = NameplateRefSerializer(read_only=True)
    nameplate_count = serializers.SerializerMethodField()
    nameplate_total = serializers.SerializerMethodField()
    nameplate_previews = serializers.SerializerMethodField()
    like_count = serializers.SerializerMethodField()
    comment_count = serializers.SerializerMethodField()
    use_count = serializers.SerializerMethodField()
    liked_by_me = serializers.SerializerMethodField()
    recorder_followed_by_me = serializers.SerializerMethodField()

    class Meta:
        model = Can
        fields = [
            "id",
            "audio_url",
            "concept_text",
            "recorder",
            "submitted_dialect",
            "primary_nameplate",
            "status",
            "visibility",
            "views",
            "nameplate_count",
            "nameplate_total",
            "nameplate_previews",
            "like_count",
            "comment_count",
            "use_count",
            "liked_by_me",
            "recorder_followed_by_me",
            "duration_ms",
            "created_at",
        ]

    def get_nameplate_count(self, obj):
        annotated = getattr(obj, "nameplate_count", None)
        if annotated is not None:
            return annotated
        return obj.nameplates.filter(status=Nameplate.Status.ACTIVE).count()

    def get_nameplate_total(self, obj):
        # 与 nameplate_count 同源：统计该罐 active 铭牌总数。
        annotated = getattr(obj, "nameplate_count", None)
        if annotated is not None:
            return annotated
        return obj.nameplates.filter(status=Nameplate.Status.ACTIVE).count()

    def get_nameplate_previews(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        user_id = user.pk if user and user.is_authenticated else None
        # 首页列表契约必须自包含，卡片组件不能再按罐逐一补请求。
        active = [
            plate
            for plate in obj.nameplates.all()
            if plate.status == Nameplate.Status.ACTIVE
        ]
        top = sorted(
            active,
            key=lambda plate: (not plate.is_primary, -plate.weight, plate.id),
        )[:3]
        previews = []
        for plate in top:
            supports = list(plate.supports.all())
            plate_comment_count = getattr(plate, "comment_count", None)
            if plate_comment_count is None:
                plate_comment_count = plate.comments.count()
            previews.append(
                {
                    "id": plate.id,
                    "is_primary": plate.is_primary,
                    "display_text": plate.display_text,
                    "text_content": plate.text_content,
                    "definition": plate.definition,
                    "pronunciation_text": plate.pronunciation_text,
                    "package": (
                        PackageRefSerializer(plate.package).data
                        if plate.package_id
                        else None
                    ),
                    "flavor": (
                        FlavorRefSerializer(plate.flavor).data
                        if plate.flavor_id
                        else None
                    ),
                    "dialect": (
                        DialectRefSerializer(plate.dialect).data
                        if plate.dialect_id
                        else None
                    ),
                    "pronunciation": (
                        PronunciationRefSerializer(plate.pronunciation).data
                        if plate.pronunciation_id
                        else None
                    ),
                    "source": plate.source,
                    "source_type": (plate.source or {}).get(
                        "type", Nameplate.SourceType.OTHER
                    ),
                    "evidence_level": plate.evidence_level,
                    "weight": plate.weight,
                    "support_count": len(supports),
                    "comment_count": plate_comment_count,
                    "supported_by_current_user": bool(
                        user_id is not None
                        and any(support.user_id == user_id for support in supports)
                    ),
                }
            )
        return previews

    def get_like_count(self, obj):
        annotated = getattr(obj, "like_count", None)
        return annotated if annotated is not None else obj.likes.count()

    def get_comment_count(self, obj):
        annotated = getattr(obj, "comment_count", None)
        return annotated if annotated is not None else obj.comments.count()

    def get_use_count(self, obj):
        annotated = getattr(obj, "use_count", None)
        if annotated is not None:
            return annotated
        return obj.posts.filter(visibility=CanPost.Visibility.PUBLIC).count()

    def get_liked_by_me(self, obj):
        annotated = getattr(obj, "liked_by_me", None)
        if annotated is not None:
            return bool(annotated)
        request = self.context.get("request")
        user = request.user if request else None
        return bool(
            user
            and user.is_authenticated
            and CanLike.objects.filter(can=obj, user=user).exists()
        )

    def get_recorder_followed_by_me(self, obj):
        annotated = getattr(obj, "recorder_followed_by_me", None)
        if annotated is not None:
            return bool(annotated)
        request = self.context.get("request")
        user = request.user if request else None
        if not (user and user.is_authenticated) or not obj.recorder_id:
            return False
        return UserFollow.objects.filter(
            follower=user, followed_id=obj.recorder_id
        ).exists()


class CanCommentSerializer(serializers.ModelSerializer):
    can_id = serializers.PrimaryKeyRelatedField(
        source="can",
        queryset=Can.objects.filter(visibility=True),
        required=False,
    )
    nameplate_id = serializers.PrimaryKeyRelatedField(
        source="nameplate",
        queryset=Nameplate.objects.filter(can__visibility=True),
        required=False,
        allow_null=True,
    )
    author = UserLiteSerializer(read_only=True)
    like_count = serializers.SerializerMethodField()
    liked_by_me = serializers.SerializerMethodField()

    class Meta:
        model = CanComment
        fields = [
            "id",
            "can_id",
            "nameplate_id",
            "author",
            "content",
            "like_count",
            "liked_by_me",
            "created_at",
        ]
        read_only_fields = ["id", "author", "created_at"]

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if self.instance:
            if "can" in attrs or "nameplate" in attrs:
                raise serializers.ValidationError("评论目标创建后不可修改")
            return attrs
        can = attrs.get("can")
        nameplate = attrs.get("nameplate")
        if bool(can) == bool(nameplate):
            raise serializers.ValidationError(
                "can_id 与 nameplate_id 必须且只能提供一个"
            )
        if nameplate:
            attrs["can"] = nameplate.can
        return attrs

    def validate_content(self, value):
        content = str(value or "").strip()
        if not content:
            raise serializers.ValidationError("评论不能为空")
        return content

    def get_like_count(self, obj):
        annotated = getattr(obj, "like_count", None)
        return annotated if annotated is not None else obj.likes.count()

    def get_liked_by_me(self, obj):
        annotated = getattr(obj, "liked_by_me", None)
        if annotated is not None:
            return bool(annotated)
        request = self.context.get("request")
        user = request.user if request else None
        return bool(
            user
            and user.is_authenticated
            and CanCommentLike.objects.filter(comment=obj, user=user).exists()
        )


class CanSerializer(CanCardSerializer):
    audio_url = serializers.URLField(required=True)
    concept_text = serializers.CharField(
        max_length=200, required=False, allow_blank=True
    )
    submitted_dialect_id = serializers.PrimaryKeyRelatedField(
        source="submitted_dialect",
        queryset=Dialect.objects.all(),
        write_only=True,
        required=True,
        allow_null=True,
    )
    nameplates = NameplateSerializer(many=True, read_only=True)
    initial_nameplate = InitialNameplateSerializer(write_only=True, required=False)
    recent_comments = serializers.SerializerMethodField()
    recent_posts = serializers.SerializerMethodField()
    transition_log = serializers.SerializerMethodField()

    class Meta(CanCardSerializer.Meta):
        fields = CanCardSerializer.Meta.fields + [
            "submitted_dialect_id",
            "source_note",
            "nameplates",
            "verifier",
            "transition_log",
            "metadata",
            "recent_comments",
            "recent_posts",
            "initial_nameplate",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "recorder",
            "visibility",
            "status",
            "verifier",
            "transition_log",
            "views",
            "nameplates",
            "primary_nameplate",
            "nameplate_count",
            "created_at",
            "updated_at",
        ]

    def get_recent_comments(self, obj):
        request = self.context.get("request")
        user = request.user if request else None
        # nameplate=NULL 是罐头公共评论与具体铭牌讨论的隔离边界。
        queryset = (
            obj.comments.filter(nameplate__isnull=True)
            .select_related("author", "author__user_info")
            .annotate(like_count=Count("likes", distinct=True))
        )
        if user and user.is_authenticated:
            queryset = queryset.annotate(
                liked_by_me=Exists(
                    CanCommentLike.objects.filter(
                        comment_id=OuterRef("pk"),
                        user=user,
                    )
                )
            )
        return CanCommentSerializer(
            queryset.order_by("-created_at", "-id")[:3],
            many=True,
            context=self.context,
        ).data

    def get_recent_posts(self, obj):
        queryset = obj.posts.filter(
            visibility=CanPost.Visibility.PUBLIC
        ).select_related("author", "author__user_info", "can", "can__recorder")[:5]
        return CanPostSerializer(queryset, many=True, context=self.context).data

    def get_transition_log(self, obj):
        return normalize_transition_log(obj.transition_log)

    def validate(self, attrs):
        if not self.instance:
            if attrs.get("submitted_dialect") is None:
                raise serializers.ValidationError(
                    {"submitted_dialect_id": "创建罐头时必须提供方言提示"}
                )
            attrs = self._apply_supplement_backfill(attrs)
        if self.instance:
            immutable = {"audio_url", "duration_ms"}.intersection(attrs)
            if immutable:
                raise serializers.ValidationError(
                    {field: "创建后不可通过 Can API 修改" for field in immutable}
                )
        return super().validate(attrs)

    def _apply_supplement_backfill(self, attrs):
        # 补录音模式（#29/#150）：concept_text 可省略，按 initial_nameplate.flavor_id
        # 对应义项名称回填；两者均缺失时拒绝创建。
        concept_text = clean_text(attrs.get("concept_text"))
        if concept_text:
            attrs["concept_text"] = concept_text
            return attrs
        flavor_id = (attrs.get("initial_nameplate") or {}).get("flavor_id")
        if not flavor_id:
            raise serializers.ValidationError(
                {
                    "concept_text": (
                        "请提供普通话概念，"
                        "或通过 initial_nameplate.flavor_id 指定已有义项"
                    )
                }
            )
        flavor = Flavor.objects.filter(id=flavor_id).first()
        if flavor is None:
            raise serializers.ValidationError(
                {"initial_nameplate": {"flavor_id": ["义项不存在"]}}
            )
        attrs["concept_text"] = flavor.name
        return attrs

    def create(self, validated_data):
        initial_nameplate = validated_data.pop("initial_nameplate", None)
        request = self.context.get("request")
        return create_can_submission(
            user=request.user if request else None,
            can_data=validated_data,
            initial_nameplate=initial_nameplate,
        )


class CanPostSerializer(serializers.ModelSerializer):
    can_id = serializers.PrimaryKeyRelatedField(
        source="can",
        queryset=Can.objects.filter(visibility=True),
    )
    author = UserLiteSerializer(read_only=True)
    can = serializers.SerializerMethodField()
    source = serializers.SerializerMethodField()
    is_owner = serializers.SerializerMethodField()

    class Meta:
        model = CanPost
        fields = [
            "id",
            "can_id",
            "can",
            "author",
            "text",
            "visibility",
            "source",
            "is_owner",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "can",
            "author",
            "source",
            "is_owner",
            "created_at",
            "updated_at",
        ]

    def validate_text(self, value):
        return str(value or "").strip()

    def get_can(self, obj):
        if obj.can_id and obj.can and obj.can.visibility:
            preview = dict(CanCardSerializer(obj.can, context=self.context).data)
            primary = obj.can.primary_nameplate
            if primary:
                nameplate = dict(
                    NameplateCardSerializer(primary, context=self.context).data
                )
                nameplate["definition"] = primary.definition
                preview["primary_nameplate"] = nameplate
            else:
                preview["primary_nameplate"] = None
            return preview
        snapshot = obj.source_snapshot or {}
        if not snapshot:
            return None
        return {
            "id": snapshot.get("can_id"),
            "audio_url": snapshot.get("audio_url", ""),
            "concept_text": snapshot.get("concept_text", ""),
            "duration_ms": snapshot.get("duration_ms", 0),
            "submitted_dialect": snapshot.get("submitted_dialect"),
            "primary_nameplate": snapshot.get("primary_nameplate"),
            "recorder": snapshot.get("recorder"),
            "source_unavailable": True,
        }

    def get_source(self, obj):
        snapshot = obj.source_snapshot or {}
        return {
            "can_id": obj.can_id or snapshot.get("can_id"),
            "recorder": snapshot.get("recorder"),
            "source_unavailable": not bool(
                obj.can_id and obj.can and obj.can.visibility
            ),
        }

    def get_is_owner(self, obj):
        request = self.context.get("request")
        user = request.user if request else None
        return bool(user and user.is_authenticated and user.id == obj.author_id)


class ShelfSerializer(serializers.ModelSerializer):
    creator = UserLiteSerializer(read_only=True)
    flavors = serializers.SerializerMethodField()
    cans = serializers.SerializerMethodField()
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

    def get_flavors(self, obj):
        items = [link.flavor for link in obj.flavor_links.all()]
        return FlavorRefSerializer(items, many=True, context=self.context).data

    def get_cans(self, obj):
        items = [link.can for link in obj.can_links.all()]
        return CanCardSerializer(items, many=True, context=self.context).data

    def validate(self, attrs):
        attrs = super().validate(attrs)
        for field in ("flavors", "cans"):
            items = attrs.get(field)
            if items is not None and len(items) != len({item.pk for item in items}):
                raise serializers.ValidationError({field: "同一内容不能重复添加"})
        return attrs

    def _replace_links(self, shelf, items, link_model, item_field):
        link_model.objects.filter(shelf=shelf).delete()
        request = self.context.get("request")
        user = request.user if request and request.user.is_authenticated else None
        link_model.objects.bulk_create(
            [
                link_model(
                    shelf=shelf,
                    **{item_field: item},
                    sort_order=index,
                    added_by=user,
                )
                for index, item in enumerate(items)
            ]
        )

    def create(self, validated_data):
        flavors = validated_data.pop("flavors", [])
        cans = validated_data.pop("cans", [])
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            validated_data["creator"] = request.user
            if not request.user.is_staff:
                validated_data["shelf_type"] = Shelf.ShelfType.USER
        shelf = super().create(validated_data)
        self._replace_links(shelf, flavors, ShelfFlavor, "flavor")
        self._replace_links(shelf, cans, ShelfCan, "can")
        return shelf

    def update(self, instance, validated_data):
        flavors = validated_data.pop("flavors", None)
        cans = validated_data.pop("cans", None)
        request = self.context.get("request")
        if request and request.user.is_authenticated and not request.user.is_staff:
            validated_data["shelf_type"] = Shelf.ShelfType.USER
        shelf = super().update(instance, validated_data)
        if flavors is not None:
            self._replace_links(shelf, flavors, ShelfFlavor, "flavor")
        if cans is not None:
            self._replace_links(shelf, cans, ShelfCan, "can")
        return shelf
