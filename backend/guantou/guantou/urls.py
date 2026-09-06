from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .v2_views import (
    ConceptViewSet,
    CurationActionViewSet,
    CurationTaskView,
    CurationView,
    CuratorApplicationViewSet,
    CuratorGrantViewSet,
    DialectCircleViewSet,
    DialectViewSet,
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

from .restoration import CollectionViewSet, RecordingCommentViewSet, EntryCommentViewSet

router = DefaultRouter()
router.register("entry-comments", EntryCommentViewSet, basename="entry-comment")
router.register("collections", CollectionViewSet, basename="collection")
router.register(
    "recording-comments", RecordingCommentViewSet, basename="recording-comment"
)
router.register("dialects", DialectViewSet, basename="dialect")
router.register("circles", DialectCircleViewSet, basename="circle")
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
    path("curation/", CurationView.as_view(), name="curation"),
    path("curation/tasks/", CurationTaskView.as_view(), name="curation-tasks"),
    path(
        "contributions/me/",
        MyContributionHistoryView.as_view(),
        name="my-contribution-history",
    ),
    path("", include(router.urls)),
]
