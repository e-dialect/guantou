from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AggregateSearchView,
    CanViewSet,
    CanCommentViewSet,
    DialectViewSet,
    FlavorViewSet,
    HotSearchView,
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
router.register("comments", CanCommentViewSet, basename="comment")
router.register("nameplates", NameplateViewSet, basename="nameplate")
router.register("shelves", ShelfViewSet, basename="shelf")

urlpatterns = [
    path("search/", AggregateSearchView.as_view(), name="search"),
    path("search/hot/", HotSearchView.as_view(), name="search-hot"),
    path("search/suggest/", SuggestSearchView.as_view(), name="search-suggest"),
    path("", include(router.urls)),
]
