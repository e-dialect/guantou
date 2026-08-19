from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone


class Dialect(models.Model):
    """按需展开的方言关系树节点，不等同于行政区划。"""

    name = models.CharField(max_length=120, verbose_name="名称")
    code = models.CharField(max_length=32, verbose_name="同级短码")
    parent = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        related_name="children",
        null=True,
        blank=True,
        verbose_name="父级方言点",
    )
    sort_order = models.IntegerField(default=0, verbose_name="同级排序")
    aliases = models.JSONField(default=list, blank=True, verbose_name="历史限定码")
    description = models.TextField(blank=True, verbose_name="描述")
    external_refs = models.JSONField(default=dict, blank=True, verbose_name="外部引用")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    def __str__(self):
        return self.qualified_code

    @property
    def qualified_code(self):
        codes = []
        node = self
        visited = set()
        while node is not None and node.pk not in visited:
            if node.pk is not None:
                visited.add(node.pk)
            codes.append(node.code)
            node = node.parent
        return ".".join(reversed(codes))

    def clean(self):
        super().clean()
        if any(character in self.code for character in (".", "/")) or any(
            character.isspace() for character in self.code
        ):
            raise ValidationError({"code": "短码不得包含点、斜杠或空白"})
        if self.parent_id and self.pk:
            if self.parent_id == self.pk or self.parent_id in self.descendant_ids():
                raise ValidationError({"parent": "父节点不能是当前节点或其后代"})

    def descendant_ids(self, include_self=True):
        ids = [self.id] if include_self else []
        visited = set(ids)
        queue = list(self.children.all())
        while queue:
            node = queue.pop(0)
            if node.id in visited:
                continue
            visited.add(node.id)
            ids.append(node.id)
            queue.extend(list(node.children.all()))
        return ids

    class Meta:
        ordering = ["sort_order", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["parent", "code"], name="unique_dialect_sibling_code"
            ),
            models.UniqueConstraint(
                fields=["code"],
                condition=models.Q(parent__isnull=True),
                name="unique_root_dialect_code",
            ),
        ]
        verbose_name = "方言点"
        verbose_name_plural = "方言点"


class Package(models.Model):
    """包装；文字检索入口，对应旧系统中的字头/写法。"""

    class PackageType(models.TextChoices):
        ORTHODOX = "orthodox", "正字"
        LOAN = "loan", "借字"
        POPULAR = "popular", "俗写"
        PHONETIC = "phonetic", "拟音"
        ROMANIZATION = "romanization", "罗马字"
        UNCERTAIN = "uncertain", "不确定"

    text = models.CharField(max_length=120, verbose_name="牌面文字")
    package_type = models.CharField(
        max_length=20,
        choices=PackageType.choices,
        default=PackageType.UNCERTAIN,
        verbose_name="包装类型",
    )
    unicode = models.CharField(max_length=80, blank=True, verbose_name="Unicode")
    metadata = models.JSONField(default=dict, blank=True, verbose_name="扩展信息")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    def __str__(self):
        return self.text

    class Meta:
        ordering = ["text", "package_type"]
        constraints = [
            models.UniqueConstraint(
                fields=["text", "package_type"], name="unique_package_text_type"
            )
        ]
        verbose_name = "包装"
        verbose_name_plural = "包装"


class Flavor(models.Model):
    """风味；语义核心，对应旧系统中拆分后的义项/概念。"""

    name = models.CharField(max_length=160, verbose_name="风味名")
    definition = models.TextField(verbose_name="释义")
    mandarin = models.JSONField(default=list, blank=True, verbose_name="普通话概念")
    tags = models.JSONField(default=list, blank=True, verbose_name="标签")
    metadata = models.JSONField(default=dict, blank=True, verbose_name="扩展信息")
    geo_scope = models.CharField(max_length=160, blank=True, verbose_name="地理范围")
    concepticon_id = models.CharField(
        max_length=80, null=True, blank=True, verbose_name="Concepticon 编号"
    )
    packages = models.ManyToManyField(
        Package,
        related_name="flavors",
        through="FlavorPackage",
        blank=True,
        verbose_name="包装",
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_flavors",
        verbose_name="创建者",
    )
    visibility = models.BooleanField(default=True, verbose_name="是否可见")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    def __str__(self):
        return self.name

    class Meta:
        ordering = ["name", "id"]
        verbose_name = "风味"
        verbose_name_plural = "风味"


class LegacyImportRecord(models.Model):
    """Idempotency and provenance ledger for external legacy imports."""

    source_system = models.CharField(max_length=80)
    source_table = models.CharField(max_length=80)
    source_id = models.CharField(max_length=120)
    target_model = models.CharField(max_length=120)
    target_id = models.PositiveBigIntegerField()
    fingerprint = models.CharField(max_length=64, blank=True)
    action = models.CharField(max_length=32, default="created")
    metadata = models.JSONField(default=dict, blank=True)
    imported_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["source_system", "source_table", "source_id"],
                name="unique_legacy_import_source",
            )
        ]
        indexes = [
            models.Index(
                fields=["target_model", "target_id"],
                name="legacy_target_idx",
            )
        ]
        ordering = ["source_system", "source_table", "source_id"]
        verbose_name = "旧数据导入记录"
        verbose_name_plural = "旧数据导入记录"


class FlavorPackage(models.Model):
    class MappingType(models.TextChoices):
        PRIMARY = "primary", "主写法"
        SYNONYM = "synonym", "同义写法"
        BORROWED = "borrowed", "假借"
        DISPUTED = "disputed", "争议"

    flavor = models.ForeignKey(Flavor, on_delete=models.CASCADE, verbose_name="风味")
    package = models.ForeignKey(Package, on_delete=models.CASCADE, verbose_name="包装")
    mapping_type = models.CharField(
        max_length=20,
        choices=MappingType.choices,
        default=MappingType.PRIMARY,
        verbose_name="映射类型",
    )
    note = models.CharField(max_length=240, blank=True, verbose_name="说明")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["flavor", "package"], name="unique_flavor_package"
            )
        ]
        verbose_name = "风味包装关系"
        verbose_name_plural = "风味包装关系"


class Pronunciation(models.Model):
    """某写法表达某义项时，在某方言节点下的一种规范化读音。"""

    class Status(models.TextChoices):
        DRAFT = "draft", "草稿"
        VERIFIED = "verified", "已认证"
        REJECTED = "rejected", "已驳回"
        DISPUTED = "disputed", "争议"

    class ReadingType(models.TextChoices):
        GENERAL = "general", "通用"
        LITERARY = "literary", "文读"
        COLLOQUIAL = "colloquial", "白读"
        OTHER = "other", "其他"

    flavor = models.ForeignKey(
        Flavor,
        on_delete=models.PROTECT,
        related_name="pronunciations",
        verbose_name="义项",
    )
    package = models.ForeignKey(
        Package,
        on_delete=models.PROTECT,
        related_name="pronunciations",
        verbose_name="写法",
    )
    dialect = models.ForeignKey(
        Dialect,
        on_delete=models.PROTECT,
        related_name="pronunciations",
        verbose_name="方言点",
    )
    ipa = models.CharField(max_length=120, verbose_name="IPA")
    base_romanization = models.CharField(
        max_length=120, blank=True, verbose_name="变调前罗马字"
    )
    surface_romanization = models.CharField(
        max_length=120, blank=True, verbose_name="变调后罗马字"
    )
    reading_type = models.CharField(
        max_length=20,
        choices=ReadingType.choices,
        default=ReadingType.GENERAL,
        verbose_name="读音类型",
    )
    usage_note = models.TextField(blank=True, verbose_name="用法说明")
    sandhi_info = models.JSONField(default=dict, blank=True, verbose_name="变调信息")
    is_canonical = models.BooleanField(default=False, verbose_name="是否认证主变体")
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.DRAFT, verbose_name="状态"
    )
    source_citation = models.CharField(
        max_length=300, blank=True, verbose_name="来源说明"
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_pronunciations",
        verbose_name="创建者",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    def __str__(self):
        return (
            f"{self.package} / {self.flavor} / {self.dialect}: "
            f"{self.surface_romanization or self.base_romanization or self.ipa or '未标音'}"
        )

    def clean(self):
        super().clean()
        if self.package_id and self.flavor_id:
            linked = FlavorPackage.objects.filter(
                flavor_id=self.flavor_id, package_id=self.package_id
            ).exists()
            if not linked:
                raise ValidationError(
                    {"package": "该写法尚未与所选义项建立 FlavorPackage 关联"}
                )
        if self.sandhi_info and not (
            self.base_romanization and self.surface_romanization
        ):
            raise ValidationError(
                {"sandhi_info": "填写变调信息时必须同时提供变调前和变调后罗马字"}
            )

    class Meta:
        ordering = ["flavor_id", "dialect_id", "-is_canonical", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["package", "flavor", "dialect", "reading_type"],
                condition=models.Q(is_canonical=True),
                name="unique_canonical_pronunciation",
            )
        ]
        verbose_name = "读音"
        verbose_name_plural = "读音"


class Can(models.Model):
    """罐头；一段具体方言录音。"""

    class Status(models.TextChoices):
        UNLABELED = "unlabeled", "无标"
        PENDING = "pending", "待校验"
        TENTATIVE = "tentative", "社区暂定"
        VERIFIED = "verified", "正品认证"
        DISPUTED = "disputed", "争议"
        REJECTED = "rejected", "已驳回"

    audio_url = models.URLField(verbose_name="音频")
    recorder = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="cans",
        null=True,
        blank=True,
        verbose_name="录制者",
    )
    submitted_dialect = models.ForeignKey(
        Dialect,
        on_delete=models.SET_NULL,
        related_name="submitted_cans",
        null=True,
        blank=True,
        verbose_name="装罐时方言提示",
    )
    # 写法和释义以铭牌为权威；该字段只服务旧数据兼容与搜索兜底。
    concept_text = models.CharField(
        max_length=200, blank=True, verbose_name="普通话概念"
    )
    source_note = models.CharField(max_length=300, blank=True, verbose_name="来源说明")
    duration_ms = models.PositiveIntegerField(default=0, verbose_name="时长毫秒")
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.UNLABELED,
        verbose_name="状态",
    )
    visibility = models.BooleanField(default=False, verbose_name="是否可见")
    verifier = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="verified_cans",
        null=True,
        blank=True,
        verbose_name="审核人",
    )
    transition_log = models.JSONField(
        default=list, blank=True, verbose_name="状态转换日志"
    )
    metadata = models.JSONField(default=dict, blank=True, verbose_name="扩展信息")
    views = models.PositiveIntegerField(default=0, verbose_name="访问量")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    def __str__(self):
        label = (
            self.primary_nameplate.text_content
            if self.primary_nameplate
            else self.concept_text
        )
        return label or f"罐头 {self.id}"

    @property
    def primary_nameplate(self):
        prefetched = getattr(self, "_prefetched_objects_cache", {}).get("nameplates")
        if prefetched is not None:
            # 列表响应必须复用批量预取，不能为每个罐头再查询一次主铭牌。
            candidates = [
                plate
                for plate in prefetched
                if plate.is_primary
                and plate.status == Nameplate.Status.ACTIVE
                and plate.package_id
                and plate.flavor_id
                and plate.dialect_id
            ]
            return (
                sorted(candidates, key=lambda plate: (-plate.weight, plate.id))[0]
                if candidates
                else None
            )
        return (
            self.nameplates.filter(
                is_primary=True,
                status=Nameplate.Status.ACTIVE,
                package__isnull=False,
                flavor__isnull=False,
                dialect__isnull=False,
            )
            .order_by("-weight", "id")
            .first()
        )

    class Meta:
        ordering = ["-created_at", "-id"]
        verbose_name = "罐头"
        verbose_name_plural = "罐头"


class DailyCanSelection(models.Model):
    """Persisted per-day choice for the homepage "today can" source."""

    date = models.DateField(unique=True, verbose_name="日期")
    can = models.ForeignKey(
        Can,
        on_delete=models.CASCADE,
        related_name="daily_selections",
        verbose_name="当日罐头",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="选择时间")

    class Meta:
        ordering = ["-date"]
        verbose_name = "今日罐选择"
        verbose_name_plural = "今日罐选择"
class CanTransition(models.Model):
    """Append-only domain audit row for Can status transitions.

    Kept alongside Can.transition_log while the JSON field remains the v1 API
    compatibility source; migration to the relational table does not rewrite it.
    """

    can = models.ForeignKey(
        Can,
        on_delete=models.CASCADE,
        related_name="transitions",
        verbose_name="罐头",
    )
    from_status = models.CharField(
        max_length=20, choices=Can.Status.choices, verbose_name="转换前状态"
    )
    to_status = models.CharField(
        max_length=20, choices=Can.Status.choices, verbose_name="转换后状态"
    )
    action = models.CharField(max_length=20, verbose_name="操作")
    actor = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="can_transitions",
        verbose_name="操作者",
    )
    reason = models.CharField(max_length=300, blank=True, verbose_name="原因")
    created_at = models.DateTimeField(default=timezone.now, verbose_name="发生时间")

    def __str__(self):
        return f"{self.can_id} {self.from_status} -> {self.to_status}"

    class Meta:
        ordering = ["created_at", "id"]
        indexes = [
            models.Index(
                fields=["can", "created_at"], name="can_transition_can_at_idx"
            ),
            models.Index(
                fields=["actor", "created_at"], name="can_transition_actor_at_idx"
            ),
            models.Index(
                fields=["from_status", "to_status", "created_at"],
                name="can_transition_status_at_idx",
            ),
        ]
        verbose_name = "罐头状态转换"
        verbose_name_plural = "罐头状态转换"


class CanLike(models.Model):
    can = models.ForeignKey(
        Can,
        on_delete=models.CASCADE,
        related_name="likes",
        verbose_name="罐头",
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="can_likes",
        verbose_name="用户",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.UniqueConstraint(fields=["can", "user"], name="unique_can_like_user")
        ]
        verbose_name = "罐头点赞"
        verbose_name_plural = "罐头点赞"


class CanComment(models.Model):
    can = models.ForeignKey(
        Can,
        on_delete=models.CASCADE,
        related_name="comments",
        verbose_name="罐头",
    )
    nameplate = models.ForeignKey(
        "Nameplate",
        on_delete=models.CASCADE,
        related_name="comments",
        null=True,
        blank=True,
        verbose_name="铭牌",
    )
    author = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="can_comments",
        verbose_name="作者",
    )
    content = models.CharField(max_length=500, verbose_name="内容")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")

    class Meta:
        ordering = ["created_at", "id"]
        indexes = [models.Index(fields=["nameplate", "created_at"])]
        verbose_name = "罐头评论"
        verbose_name_plural = "罐头评论"


class CanCommentLike(models.Model):
    comment = models.ForeignKey(
        CanComment,
        on_delete=models.CASCADE,
        related_name="likes",
        verbose_name="评论",
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="can_comment_likes",
        verbose_name="用户",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["comment", "user"],
                name="unique_can_comment_like_user",
            )
        ]
        verbose_name = "评论点赞"
        verbose_name_plural = "评论点赞"


class CanPost(models.Model):
    """建立在罐头之上的轻量表达；不允许脱离语音素材独立发布。"""

    class Visibility(models.TextChoices):
        PUBLIC = "public", "公开"
        PRIVATE = "private", "仅自己"

    can = models.ForeignKey(
        Can,
        on_delete=models.SET_NULL,
        related_name="posts",
        null=True,
        verbose_name="引用罐头",
    )
    author = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="can_posts",
        verbose_name="作者",
    )
    text = models.CharField(max_length=500, blank=True, verbose_name="配文")
    visibility = models.CharField(
        max_length=16,
        choices=Visibility.choices,
        default=Visibility.PUBLIC,
        verbose_name="可见范围",
    )
    source_snapshot = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="罐头来源快照",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["can", "visibility", "created_at"]),
            models.Index(fields=["author", "created_at"]),
        ]
        verbose_name = "罐头表达"
        verbose_name_plural = "罐头表达"

    def __str__(self):
        return self.text or f"用同款 #{self.pk}"


class Nameplate(models.Model):
    """某个资料来源对一条录音提出的可查询、可追溯主张。"""

    class Status(models.TextChoices):
        ACTIVE = "active", "有效"
        WITHDRAWN = "withdrawn", "已撤回"
        SUPERSEDED = "superseded", "已修订"

    class SourceType(models.TextChoices):
        CREATOR = "creator", "创作者自述"
        ORAL = "oral", "口述"
        FIELDWORK = "fieldwork", "田野记录"
        BOOK = "book", "书籍"
        ARTICLE = "article", "论文/文章"
        ARCHIVE = "archive", "档案"
        WEB = "web", "网页"
        OTHER = "other", "其他"

    class EvidenceLevel(models.IntegerChoices):
        MEMORY = 1, "本人记忆"
        COMMUNITY = 2, "社区公认"
        DOCUMENT = 3, "文献考据"
        OFFICIAL = 4, "官方认证"

    can = models.ForeignKey(
        Can, on_delete=models.CASCADE, related_name="nameplates", verbose_name="罐头"
    )
    flavor = models.ForeignKey(
        Flavor,
        on_delete=models.SET_NULL,
        related_name="nameplates",
        null=True,
        blank=True,
        verbose_name="风味",
    )
    package = models.ForeignKey(
        Package,
        on_delete=models.SET_NULL,
        related_name="nameplates",
        null=True,
        blank=True,
        verbose_name="包装",
    )
    dialect = models.ForeignKey(
        Dialect,
        on_delete=models.SET_NULL,
        related_name="nameplates",
        null=True,
        blank=True,
        verbose_name="方言点主张",
    )
    pronunciation = models.ForeignKey(
        Pronunciation,
        on_delete=models.SET_NULL,
        related_name="attestations",
        null=True,
        blank=True,
        verbose_name="规范读音主张",
    )
    creator = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="nameplates",
        null=True,
        blank=True,
        verbose_name="贴牌者",
    )
    text_content = models.CharField(
        max_length=160, blank=True, verbose_name="来源原样写法"
    )
    definition = models.TextField(blank=True, verbose_name="释义")
    pronunciation_text = models.CharField(
        max_length=160, blank=True, verbose_name="来源原样读音"
    )
    evidence_level = models.PositiveSmallIntegerField(
        choices=EvidenceLevel.choices,
        default=EvidenceLevel.MEMORY,
        verbose_name="证据等级",
    )
    source = models.JSONField(default=dict, verbose_name="结构化来源")
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
        verbose_name="状态",
    )
    supersedes = models.OneToOneField(
        "self",
        on_delete=models.SET_NULL,
        related_name="superseded_by",
        null=True,
        blank=True,
        verbose_name="修订自",
    )
    weight = models.IntegerField(default=0, verbose_name="权重")
    is_primary = models.BooleanField(default=False, verbose_name="是否主铭牌")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    def __str__(self):
        return self.display_text

    @property
    def display_text(self):
        if self.text_content:
            return self.text_content
        if self.package_id:
            return self.package.text
        if self.pronunciation_text:
            return self.pronunciation_text
        if self.flavor_id:
            return self.flavor.name
        return f"铭牌 {self.pk}"

    @property
    def is_complete(self):
        return bool(self.package_id and self.flavor_id and self.dialect_id)

    def clean(self):
        super().clean()
        source_type = self.source.get("type") if isinstance(self.source, dict) else None
        if source_type not in self.SourceType.values:
            raise ValidationError({"source": "source.type 不是受支持的来源类型"})
        if self.pronunciation_id:
            conflicts = {}
            if self.package_id and self.package_id != self.pronunciation.package_id:
                conflicts["package"] = "与 pronunciation 的写法不一致"
            if self.flavor_id and self.flavor_id != self.pronunciation.flavor_id:
                conflicts["flavor"] = "与 pronunciation 的义项不一致"
            if self.dialect_id and self.dialect_id != self.pronunciation.dialect_id:
                conflicts["dialect"] = "与 pronunciation 的方言点不一致"
            if conflicts:
                raise ValidationError(conflicts)
        if self.supersedes_id and self.supersedes.can_id != self.can_id:
            raise ValidationError({"supersedes": "修订记录必须属于同一罐头"})

    def promote_to_primary(self):
        if self.status != self.Status.ACTIVE or not self.is_complete:
            return False
        Nameplate.objects.filter(can=self.can, is_primary=True).exclude(
            id=self.id
        ).update(is_primary=False)
        if not self.is_primary:
            self.is_primary = True
            self.save(update_fields=["is_primary", "updated_at"])
        return True

    class Meta:
        ordering = ["can_id", "-is_primary", "-weight", "id"]
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(package__isnull=False)
                    | models.Q(flavor__isnull=False)
                    | models.Q(dialect__isnull=False)
                    | models.Q(pronunciation__isnull=False)
                    | ~models.Q(text_content="")
                    | ~models.Q(pronunciation_text="")
                ),
                name="nameplate_has_claim",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(is_primary=False)
                    | (
                        models.Q(status="active")
                        & models.Q(package__isnull=False)
                        & models.Q(flavor__isnull=False)
                        & models.Q(dialect__isnull=False)
                    )
                ),
                name="primary_nameplate_is_active_complete",
            ),
            models.UniqueConstraint(
                fields=["can"],
                condition=models.Q(is_primary=True),
                name="unique_primary_nameplate_per_can",
            ),
        ]
        verbose_name = "铭牌"
        verbose_name_plural = "铭牌"


class NameplateSupport(models.Model):
    """铭牌支持记录；同一用户对同一铭牌只能支持一次。"""

    nameplate = models.ForeignKey(
        Nameplate,
        on_delete=models.CASCADE,
        related_name="supports",
        verbose_name="铭牌",
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="nameplate_supports",
        verbose_name="支持者",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")

    def __str__(self):
        return f"{self.user_id} 支持 {self.nameplate_id}"

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["nameplate", "user"], name="unique_nameplate_support_user"
            )
        ]
        verbose_name = "铭牌支持"
        verbose_name_plural = "铭牌支持"


class DialectCircle(models.Model):
    """围绕一个方言树节点组织的轻量社区入口。"""

    dialect = models.OneToOneField(
        Dialect,
        on_delete=models.PROTECT,
        related_name="circle",
        verbose_name="主方言",
    )
    name = models.CharField(max_length=120, verbose_name="圈子名称")
    description = models.TextField(blank=True, verbose_name="简介")
    members = models.ManyToManyField(
        User,
        through="CircleMembership",
        related_name="dialect_circles",
        blank=True,
    )
    is_active = models.BooleanField(default=True, verbose_name="是否开放")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

    class Meta:
        ordering = ["dialect__sort_order", "id"]
        verbose_name = "方言圈"
        verbose_name_plural = "方言圈"


class CircleMembership(models.Model):
    circle = models.ForeignKey(
        DialectCircle,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="circle_memberships",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["circle", "user"],
                name="unique_circle_membership",
            )
        ]


class RecordingChallenge(models.Model):
    """发现页上的录音挑战；不允许脱离罐头主线发布纯文本。"""

    title = models.CharField(max_length=120, verbose_name="标题")
    prompt = models.CharField(max_length=300, verbose_name="录音提示")
    flavor = models.ForeignKey(
        Flavor,
        on_delete=models.SET_NULL,
        related_name="recording_challenges",
        null=True,
        blank=True,
    )
    dialect = models.ForeignKey(
        Dialect,
        on_delete=models.SET_NULL,
        related_name="recording_challenges",
        null=True,
        blank=True,
    )
    is_active = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title

    class Meta:
        ordering = ["sort_order", "-created_at", "-id"]
        verbose_name = "录音挑战"
        verbose_name_plural = "录音挑战"


class Shelf(models.Model):
    """货架；主题组织容器，对应旧系统中的词单。"""

    class ShelfType(models.TextChoices):
        OFFICIAL = "official", "官方推荐"
        USER = "user", "用户自建"
        CAMPAIGN = "campaign", "征集活动"

    title = models.CharField(max_length=120, verbose_name="标题")
    slug = models.SlugField(max_length=120, unique=True, verbose_name="代码")
    description = models.TextField(blank=True, verbose_name="简介")
    shelf_type = models.CharField(
        max_length=20,
        choices=ShelfType.choices,
        default=ShelfType.USER,
        verbose_name="类型",
    )
    creator = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="shelves",
        verbose_name="创建者",
    )
    flavors = models.ManyToManyField(
        Flavor,
        through="ShelfFlavor",
        related_name="shelves",
        blank=True,
    )
    cans = models.ManyToManyField(
        Can,
        through="ShelfCan",
        related_name="shelves",
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    def __str__(self):
        return self.title

    class Meta:
        ordering = ["title"]
        verbose_name = "货架"
        verbose_name_plural = "货架"


class ShelfFlavor(models.Model):
    shelf = models.ForeignKey(
        Shelf, on_delete=models.CASCADE, related_name="flavor_links"
    )
    flavor = models.ForeignKey(
        Flavor, on_delete=models.CASCADE, related_name="shelf_links"
    )
    sort_order = models.PositiveIntegerField(default=0)
    added_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="added_shelf_flavors",
    )
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["sort_order", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["shelf", "flavor"], name="unique_shelf_flavor"
            )
        ]


class ShelfCan(models.Model):
    shelf = models.ForeignKey(Shelf, on_delete=models.CASCADE, related_name="can_links")
    can = models.ForeignKey(Can, on_delete=models.CASCADE, related_name="shelf_links")
    sort_order = models.PositiveIntegerField(default=0)
    added_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="added_shelf_cans",
    )
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["sort_order", "id"]
        constraints = [
            models.UniqueConstraint(fields=["shelf", "can"], name="unique_shelf_can")
        ]


class SearchTerm(models.Model):
    """用于 Demo 热词排行的归一化搜索词。"""

    keyword = models.CharField(max_length=20, unique=True)
    count = models.PositiveBigIntegerField(default=0)
    last_searched_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.keyword

    class Meta:
        ordering = ["-count", "-last_searched_at", "id"]


class SearchTermHit(models.Model):
    """同一登录用户或匿名 visitor 每天只为一个搜索词计数一次。"""

    term = models.ForeignKey(
        SearchTerm,
        related_name="hits",
        on_delete=models.CASCADE,
    )
    attributer = models.CharField(max_length=80)
    hit_date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.term.keyword}:{self.attributer}:{self.hit_date}"

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["term", "attributer", "hit_date"],
                name="unique_daily_search_term_hit",
            )
        ]
