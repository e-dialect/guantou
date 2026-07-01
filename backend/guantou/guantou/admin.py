from django.contrib import admin

from .models import (
    Can,
    Dialect,
    Flavor,
    FlavorPackage,
    FlavorVariant,
    Nameplate,
    Package,
    Shelf,
)


class NameplateInline(admin.TabularInline):
    model = Nameplate
    extra = 0
    raw_id_fields = ("flavor", "package", "creator")


class FlavorPackageInline(admin.TabularInline):
    model = FlavorPackage
    extra = 0
    raw_id_fields = ("package",)


class FlavorVariantInline(admin.TabularInline):
    model = FlavorVariant
    extra = 0
    raw_id_fields = ("dialect", "created_by")


@admin.register(Dialect)
class DialectAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "code", "parent", "region_level", "county", "town")
    list_filter = ("region_level", "province", "city", "county")
    search_fields = ("name", "code", "province", "city", "county", "town")
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
    inlines = (FlavorPackageInline, FlavorVariantInline)


@admin.register(FlavorVariant)
class FlavorVariantAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "flavor",
        "dialect",
        "romanization",
        "ipa",
        "is_canonical",
        "status",
    )
    list_filter = ("status", "is_canonical", "audio_source")
    search_fields = ("flavor__name", "romanization", "ipa", "dialect__name")
    raw_id_fields = ("flavor", "dialect", "created_by")


@admin.register(Can)
class CanAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "concept_text",
        "recorder",
        "dialect",
        "status",
        "visibility",
        "verifier",
        "created_at",
    )
    list_filter = ("status", "visibility", "county", "town")
    search_fields = ("concept_text", "source_note", "nameplates__text_content")
    raw_id_fields = ("recorder", "dialect", "flavor_variant", "verifier")
    inlines = (NameplateInline,)


@admin.register(Nameplate)
class NameplateAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "can",
        "text_content",
        "flavor",
        "package",
        "creator",
        "weight",
        "is_primary",
    )
    list_filter = ("is_primary", "evidence_level")
    search_fields = ("text_content", "definition", "source_citation")
    raw_id_fields = ("can", "flavor", "package", "creator")


@admin.register(Shelf)
class ShelfAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "slug", "shelf_type", "creator")
    list_filter = ("shelf_type",)
    search_fields = ("title", "description")
    raw_id_fields = ("creator",)
    filter_horizontal = ("flavors", "cans")
