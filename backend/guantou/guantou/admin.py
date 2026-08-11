from django.contrib import admin

from .models import (
    Can,
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


class NameplateInline(admin.TabularInline):
    model = Nameplate
    extra = 0
    raw_id_fields = (
        "flavor",
        "package",
        "dialect",
        "pronunciation",
        "creator",
        "supersedes",
    )


class FlavorPackageInline(admin.TabularInline):
    model = FlavorPackage
    extra = 0
    raw_id_fields = ("package",)


class PronunciationInline(admin.TabularInline):
    model = Pronunciation
    extra = 0
    raw_id_fields = ("package", "dialect", "created_by")


class ShelfFlavorInline(admin.TabularInline):
    model = ShelfFlavor
    extra = 0
    ordering = ("sort_order", "id")
    raw_id_fields = ("flavor", "added_by")


class ShelfCanInline(admin.TabularInline):
    model = ShelfCan
    extra = 0
    ordering = ("sort_order", "id")
    raw_id_fields = ("can", "added_by")


@admin.register(CanPost)
class CanPostAdmin(admin.ModelAdmin):
    list_display = ("id", "author", "can", "visibility", "created_at")
    list_filter = ("visibility",)
    search_fields = ("text", "author__username", "can__concept_text")
    raw_id_fields = ("author", "can")


@admin.register(Dialect)
class DialectAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "code", "parent", "sort_order")
    search_fields = ("name", "code")
    raw_id_fields = ("parent",)


@admin.register(DialectCircle)
class DialectCircleAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "dialect", "is_active")
    list_filter = ("is_active",)
    search_fields = ("name", "description", "dialect__name")
    raw_id_fields = ("dialect",)


@admin.register(RecordingChallenge)
class RecordingChallengeAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "flavor", "dialect", "is_active", "sort_order")
    list_filter = ("is_active",)
    search_fields = ("title", "prompt")
    raw_id_fields = ("flavor", "dialect")


@admin.register(Package)
class PackageAdmin(admin.ModelAdmin):
    list_display = ("id", "text", "package_type", "unicode", "created_at")
    list_filter = ("package_type",)
    search_fields = ("text", "unicode")


@admin.register(Flavor)
class FlavorAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "geo_scope", "visibility", "created_by")
    list_filter = ("visibility", "geo_scope")
    search_fields = ("name", "definition")
    raw_id_fields = ("created_by",)
    inlines = (FlavorPackageInline, PronunciationInline)


@admin.register(Pronunciation)
class PronunciationAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "package",
        "flavor",
        "dialect",
        "base_romanization",
        "surface_romanization",
        "ipa",
        "is_canonical",
        "status",
    )
    list_filter = ("status", "is_canonical", "reading_type")
    search_fields = (
        "flavor__name",
        "base_romanization",
        "surface_romanization",
        "ipa",
        "dialect__name",
    )
    raw_id_fields = ("package", "flavor", "dialect", "created_by")


@admin.register(Can)
class CanAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "concept_text",
        "recorder",
        "submitted_dialect",
        "status",
        "visibility",
        "verifier",
        "created_at",
    )
    list_filter = ("status", "visibility")
    search_fields = ("concept_text", "source_note", "nameplates__text_content")
    raw_id_fields = ("recorder", "submitted_dialect", "verifier")
    inlines = (NameplateInline,)


@admin.register(Nameplate)
class NameplateAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "can",
        "text_content",
        "flavor",
        "package",
        "dialect",
        "pronunciation",
        "creator",
        "weight",
        "is_primary",
    )
    list_filter = ("status", "is_primary", "evidence_level")
    search_fields = ("text_content", "definition", "pronunciation_text")
    raw_id_fields = (
        "can",
        "flavor",
        "package",
        "dialect",
        "pronunciation",
        "creator",
        "supersedes",
    )


@admin.register(Shelf)
class ShelfAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "slug", "shelf_type", "creator")
    list_filter = ("shelf_type",)
    search_fields = ("title", "description")
    raw_id_fields = ("creator",)
    inlines = (ShelfFlavorInline, ShelfCanInline)
