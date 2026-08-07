from django.contrib import admin

from .models import (
    Can,
    Dialect,
    Flavor,
    FlavorPackage,
    Nameplate,
    Package,
    Pronunciation,
    Shelf,
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


@admin.register(Dialect)
class DialectAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "code", "parent", "kind", "sort_order")
    list_filter = ("kind",)
    search_fields = ("name", "code")
    raw_id_fields = ("parent",)


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
        "romanization",
        "ipa",
        "is_canonical",
        "status",
    )
    list_filter = ("status", "is_canonical", "reading_type")
    search_fields = ("flavor__name", "romanization", "ipa", "dialect__name")
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
    filter_horizontal = ("flavors", "cans")
