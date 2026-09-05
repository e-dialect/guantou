from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AggregateSearchView,
    CanPostViewSet,
    CanViewSet,
    CanCommentViewSet,
    DialectCircleViewSet,
    DialectViewSet,
    DiscoveryView,
    FlavorViewSet,
    HotSearchView,
    NameplateViewSet,
    PackageViewSet,
    PronunciationViewSet,
    ShelfViewSet,
    SuggestSearchView,
)
from .v2_views import (
    ConceptViewSet,
    CurationActionViewSet,
    CurationTaskView,
    CurationView,
    CuratorApplicationViewSet,
    CuratorGrantViewSet,
    EntrySenseViewSet,
    EntryViewSet,
    EvidenceRecordViewSet,
    LegacyReviewCandidateViewSet,
    MyContributionHistoryView,
    PronunciationVariantViewSet,
    RecordingEntryLinkViewSet,
    RecordingViewSet,
    UsageAttestationViewSet,
    WritingFormViewSet,
)

router = DefaultRouter()
router.register("dialects", DialectViewSet, basename="dialect")
router.register("circles", DialectCircleViewSet, basename="circle")
router.register("packages", PackageViewSet, basename="package")
router.register("flavors", FlavorViewSet, basename="flavor")
router.register("pronunciations", PronunciationViewSet, basename="pronunciation")
router.register("cans", CanViewSet, basename="can")
router.register("posts", CanPostViewSet, basename="post")
router.register("comments", CanCommentViewSet, basename="comment")
router.register("nameplates", NameplateViewSet, basename="nameplate")
router.register("shelves", ShelfViewSet, basename="shelf")
router.register("entries", EntryViewSet, basename="entry")
router.register("entry-senses", EntrySenseViewSet, basename="entry-sense")
router.register("writing-forms", WritingFormViewSet, basename="writing-form")
router.register("concepts", ConceptViewSet, basename="concept")
router.register(
    "pronunciation-variants",
    PronunciationVariantViewSet,
    basename="pronunciation-variant",
)
router.register("recordings", RecordingViewSet, basename="recording")
router.register(
    "recording-entry-links",
    RecordingEntryLinkViewSet,
    basename="recording-entry-link",
)
router.register(
    "usage-attestations",
    UsageAttestationViewSet,
    basename="usage-attestation",
)
router.register("evidence-records", EvidenceRecordViewSet, basename="evidence-record")
router.register("curator-grants", CuratorGrantViewSet, basename="curator-grant")
router.register(
    "curator-applications",
    CuratorApplicationViewSet,
    basename="curator-application",
)
router.register(
    "curation/actions",
    CurationActionViewSet,
    basename="curation-action",
)
router.register(
    "curation/legacy-candidates",
    LegacyReviewCandidateViewSet,
    basename="legacy-review-candidate",
)

urlpatterns = [
    path("discovery/", DiscoveryView.as_view(), name="discovery"),
    path("search/", AggregateSearchView.as_view(), name="search"),
    path("search/hot/", HotSearchView.as_view(), name="search-hot"),
    path("search/suggest/", SuggestSearchView.as_view(), name="search-suggest"),
    path("curation/", CurationView.as_view(), name="curation"),
    path("curation/tasks/", CurationTaskView.as_view(), name="curation-tasks"),
    path(
        "contributions/me/",
        MyContributionHistoryView.as_view(),
        name="my-contribution-history",
    ),
    path("", include(router.urls)),
]
