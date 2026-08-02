from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AggregateSearchView,
    CanViewSet,
    DialectViewSet,
    FlavorVariantViewSet,
    FlavorViewSet,
    NameplateViewSet,
    PackageViewSet,
    ShelfViewSet,
)

router = DefaultRouter()
router.register("dialects", DialectViewSet, basename="dialect")
router.register("packages", PackageViewSet, basename="package")
router.register("flavors", FlavorViewSet, basename="flavor")
router.register("flavor-variants", FlavorVariantViewSet, basename="flavor-variant")
router.register("cans", CanViewSet, basename="can")
router.register("nameplates", NameplateViewSet, basename="nameplate")
router.register("shelves", ShelfViewSet, basename="shelf")

urlpatterns = [
    path("search/", AggregateSearchView.as_view(), name="search"),
    path("", include(router.urls)),
]
