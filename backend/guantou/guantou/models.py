from django.contrib.auth.models import User
from django.db import models


class Dialect(models.Model):
    """方言点；对应旧系统中的 county/town，但支持跨方言树。"""

    class RegionLevel(models.TextChoices):
        FAMILY = "family", "方言族"
        DIALECT = "dialect", "方言"
        AREA = "area", "片区"
        COUNTY = "county", "县区"
        TOWN = "town", "乡镇"
        COMMUNITY = "community", "社区"

    name = models.CharField(max_length=120, verbose_name="名称")
    code = models.SlugField(max_length=120, unique=True, verbose_name="代码")
    parent = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        related_name="children",
        null=True,
        blank=True,
        verbose_name="父级方言点",
    )
    region_level = models.CharField(
        max_length=20,
        choices=RegionLevel.choices,
        default=RegionLevel.DIALECT,
        verbose_name="层级",
    )
    province = models.CharField(max_length=80, blank=True, verbose_name="省")
    city = models.CharField(max_length=80, blank=True, verbose_name="市")
    county = models.CharField(max_length=80, blank=True, verbose_name="县区")
    town = models.CharField(max_length=80, blank=True, verbose_name="乡镇")
    description = models.TextField(blank=True, verbose_name="描述")
    metadata = models.JSONField(default=dict, blank=True, verbose_name="扩展信息")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    def __str__(self):
        return self.name

    def descendant_ids(self, include_self=True):
        ids = [self.id] if include_self else []
        queue = list(self.children.all())
        while queue:
            node = queue.pop(0)
            ids.append(node.id)
            queue.extend(list(node.children.all()))
        return ids

    class Meta:
        ordering = ["code"]
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
    geo_scope = models.CharField(max_length=160, blank=True, verbose_name="地理范围")
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


class FlavorPackage(models.Model):
    class MappingType(models.TextChoices):
        PRIMARY = "primary", "主写法"
        SYNONYM = "synonym", "同义写法"
        BORROWED = "borrowed", "假借"
        DISPUTED = "disputed", "争议"

    flavor = models.ForeignKey(Flavor, on_delete=models.CASCADE)
    package = models.ForeignKey(Package, on_delete=models.CASCADE)
    mapping_type = models.CharField(
        max_length=20,
        choices=MappingType.choices,
        default=MappingType.PRIMARY,
        verbose_name="映射类型",
    )
    note = models.CharField(max_length=240, blank=True, verbose_name="说明")

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["flavor", "package"], name="unique_flavor_package"
            )
        ]
        verbose_name = "风味包装关系"
        verbose_name_plural = "风味包装关系"


class FlavorVariant(models.Model):
    """味觉变体；同一风味在某个方言点下的实际读音。"""

    class Status(models.TextChoices):
        DRAFT = "draft", "草稿"
        VERIFIED = "verified", "已认证"
        REJECTED = "rejected", "已驳回"
        DISPUTED = "disputed", "争议"

    class AudioSource(models.TextChoices):
        USER = "user", "用户上传"
        TTS = "tts", "TTS"
        IMPORT = "import", "导入"
        NONE = "none", "无"

    flavor = models.ForeignKey(
        Flavor, on_delete=models.CASCADE, related_name="variants", verbose_name="风味"
    )
    dialect = models.ForeignKey(
        Dialect,
        on_delete=models.SET_NULL,
        related_name="flavor_variants",
        null=True,
        blank=True,
        verbose_name="方言点",
    )
    ipa = models.CharField(max_length=120, blank=True, verbose_name="IPA")
    romanization = models.CharField(
        max_length=120, blank=True, verbose_name="拼音/罗马字"
    )
    tone_value = models.CharField(max_length=40, blank=True, verbose_name="调值")
    reading_type = models.CharField(max_length=40, blank=True, verbose_name="读音类型")
    sandhi_info = models.JSONField(default=dict, blank=True, verbose_name="变调信息")
    is_canonical = models.BooleanField(default=False, verbose_name="是否认证主变体")
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.DRAFT, verbose_name="状态"
    )
    audio_url = models.URLField(blank=True, verbose_name="音频")
    audio_source = models.CharField(
        max_length=20,
        choices=AudioSource.choices,
        default=AudioSource.NONE,
        verbose_name="音频来源",
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_flavor_variants",
        verbose_name="创建者",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    def __str__(self):
        return f"{self.flavor} / {self.romanization or self.ipa or '未标音'}"

    class Meta:
        ordering = ["flavor_id", "-is_canonical", "id"]
        verbose_name = "味觉变体"
        verbose_name_plural = "味觉变体"


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
        on_delete=models.CASCADE,
        related_name="cans",
        verbose_name="录制者",
    )
    dialect = models.ForeignKey(
        Dialect,
        on_delete=models.SET_NULL,
        related_name="cans",
        null=True,
        blank=True,
        verbose_name="方言点",
    )
    flavor_variant = models.ForeignKey(
        FlavorVariant,
        on_delete=models.SET_NULL,
        related_name="cans",
        null=True,
        blank=True,
        verbose_name="味觉变体",
    )
    concept_text = models.CharField(
        max_length=200, blank=True, verbose_name="普通话概念"
    )
    source_note = models.CharField(max_length=300, blank=True, verbose_name="来源说明")
    province = models.CharField(max_length=80, blank=True, verbose_name="省")
    city = models.CharField(max_length=80, blank=True, verbose_name="市")
    county = models.CharField(max_length=80, blank=True, verbose_name="县区")
    town = models.CharField(max_length=80, blank=True, verbose_name="乡镇")
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
        return self.nameplates.filter(is_primary=True).order_by("-weight", "id").first()

    class Meta:
        ordering = ["-created_at", "-id"]
        verbose_name = "罐头"
        verbose_name_plural = "罐头"


class Nameplate(models.Model):
    """铭牌；用户对某个罐头的写法、释义、风味归属主张。"""

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
    creator = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="nameplates",
        verbose_name="贴牌者",
    )
    text_content = models.CharField(max_length=160, verbose_name="牌面文字")
    definition = models.TextField(blank=True, verbose_name="释义")
    evidence_level = models.PositiveSmallIntegerField(
        choices=EvidenceLevel.choices,
        default=EvidenceLevel.MEMORY,
        verbose_name="证据等级",
    )
    source_citation = models.CharField(
        max_length=300, blank=True, verbose_name="证据来源"
    )
    weight = models.IntegerField(default=0, verbose_name="权重")
    is_primary = models.BooleanField(default=False, verbose_name="是否主铭牌")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    def __str__(self):
        return self.text_content

    def promote_to_primary(self):
        Nameplate.objects.filter(can=self.can).exclude(id=self.id).update(
            is_primary=False
        )
        self.is_primary = True
        self.save(update_fields=["is_primary", "updated_at"])

    class Meta:
        ordering = ["can_id", "-is_primary", "-weight", "id"]
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
    flavors = models.ManyToManyField(Flavor, related_name="shelves", blank=True)
    cans = models.ManyToManyField(Can, related_name="shelves", blank=True)
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    def __str__(self):
        return self.title

    class Meta:
        ordering = ["title"]
        verbose_name = "货架"
        verbose_name_plural = "货架"
