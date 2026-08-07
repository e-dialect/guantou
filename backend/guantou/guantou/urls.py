from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AggregateSearchView,
    CanViewSet,
    DialectViewSet,
    FlavorViewSet,
    NameplateViewSet,
    PackageViewSet,
    PronunciationViewSet,
    ShelfViewSet,
    SuggestSearchView,
)

router = DefaultRouter()
router.register("dialects", DialectViewSet, basename="dialect")
router.register("packages", PackageViewSet, basename="package")
router.register("flavors", FlavorViewSet, basename="flavor")
router.register("pronunciations", PronunciationViewSet, basename="pronunciation")
router.register("cans", CanViewSet, basename="can")
router.register("nameplates", NameplateViewSet, basename="nameplate")
router.register("shelves", ShelfViewSet, basename="shelf")

urlpatterns = [
    path("search/", AggregateSearchView.as_view(), name="search"),
    path("search/suggest/", SuggestSearchView.as_view(), name="search-suggest"),
    path("", include(router.urls)),
]
