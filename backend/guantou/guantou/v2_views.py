from django.db.models import Count, Exists, OuterRef, Prefetch, Q
from rest_framework import permissions, status, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView
from utils.exceptions.types.bad_request import BadRequestException

from .models import (
    Concept,
    CuratorGrant,
    Dialect,
    Entry,
    EntrySense,
    EntrySenseConcept,
    EntryWriting,
    EvidenceRecord,
    LegacyReviewCandidate,
    PronunciationVariant,
    Recording,
    RecordingEntryLink,
    UsageAttestation,
    WritingForm,
)
from .v2_permissions import (
    IsActiveCurator,
    IsLexicalCurator,
    V2ResourcePermission,
    active_curator_grants,
    can_curate_entry,
    can_curate_recording,
    is_lexical_curator,
    is_regional_curator,
    regional_curator_scope_ids,
)
from .v2_serializers import (
    ConceptSerializer,
    CuratorGrantSerializer,
    EntryCardSerializer,
    EntrySenseSerializer,
    EntrySerializer,
    EvidenceRecordSerializer,
    LegacyReviewCandidateSerializer,
    PronunciationVariantSerializer,
    RecordingEntryLinkSerializer,
    RecordingSerializer,
    UsageAttestationSerializer,
    WritingFormSerializer,
)


def parse_boolean(value, name):
    if value is None or value == "":
        return None
    normalized = str(value).strip().lower()
    if normalized in {"1", "true", "yes"}:
        return True
    if normalized in {"0", "false", "no"}:
        return False
    raise BadRequestException(f"{name} 只能是 true 或 false")


def selected_dialect_ids(request):
    value = request.query_params.get("dialect_id")
    if not value:
        return None
    dialect = Dialect.objects.filter(pk=value).first()
    if dialect is None:
        raise BadRequestException("dialect_id 对应的地区不存在")
    scope = request.query_params.get("dialect_scope", "exact")
    if scope not in {"exact", "subtree"}:
        raise BadRequestException("dialect_scope 只能是 exact 或 subtree")
    return dialect.descendant_ids() if scope == "subtree" else [dialect.id]


def visible_entries_for_user(user):
    queryset = Entry.objects.all()
    if user and user.is_authenticated:
        if user.is_staff or is_lexical_curator(user):
            return queryset
        regional_ids = regional_curator_scope_ids(user)
        scope_filter = Q()
        if regional_ids:
            scope_filter = Q(usage_dialect_id__in=regional_ids) | Q(
                recording_links__recording__usage_dialect_id__in=regional_ids
            )
        return queryset.filter(
            Q(visibility=True) | Q(created_by=user) | scope_filter
        ).distinct()
    return queryset.filter(visibility=True)


def visible_recordings_for_user(user):
    queryset = Recording.objects.all()
    if user and user.is_authenticated:
        if user.is_staff:
            return queryset
        regional_ids = regional_curator_scope_ids(user)
        scope_filter = Q(usage_dialect_id__in=regional_ids) if regional_ids else Q()
        return queryset.filter(Q(visibility=True) | Q(recorder=user) | scope_filter)
    return queryset.filter(visibility=True)


def available_recording_links_for_user(user):
    queryset = RecordingEntryLink.objects.filter(is_current=True).exclude(
        status=RecordingEntryLink.Status.REJECTED
    )
    if user and user.is_authenticated:
        if user.is_staff:
            return queryset
        regional_ids = regional_curator_scope_ids(user)
        scope_filter = (
            Q(recording__usage_dialect_id__in=regional_ids) if regional_ids else Q()
        )
        return queryset.filter(
            Q(recording__visibility=True) | Q(recording__recorder=user) | scope_filter
        )
    return queryset.filter(recording__visibility=True)


def entry_api_queryset(user):
    links = available_recording_links_for_user(user).select_related(
        "recording", "sense"
    )
    return (
        visible_entries_for_user(user)
        .select_related("usage_dialect", "usage_dialect__parent", "created_by")
        .prefetch_related(
            Prefetch(
                "entry_writings",
                queryset=EntryWriting.objects.filter(is_current=True).select_related(
                    "writing"
                ),
            ),
            Prefetch(
                "senses",
                queryset=EntrySense.objects.select_related(
                    "created_by"
                ).prefetch_related(
                    Prefetch(
                        "concept_links",
                        queryset=EntrySenseConcept.objects.select_related("concept"),
                    )
                ),
            ),
            Prefetch(
                "pronunciation_variants",
                queryset=PronunciationVariant.objects.exclude(
                    status=PronunciationVariant.Status.REJECTED
                ).select_related("dialect", "dialect__parent", "created_by"),
            ),
            Prefetch(
                "recording_links", queryset=links, to_attr="available_recording_links"
            ),
        )
        .annotate(
            evidence_count=Count("evidence_links", distinct=True),
            attestation_count=Count(
                "usage_attestations",
                filter=Q(usage_attestations__active=True),
                distinct=True,
            ),
        )
    )


class EntryViewSet(viewsets.ModelViewSet):
    http_method_names = ["get", "post", "patch", "head", "options"]
    permission_classes = [V2ResourcePermission]

    def get_serializer_class(self):
        return EntryCardSerializer if self.action == "list" else EntrySerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        instance = entry_api_queryset(request.user).get(pk=serializer.instance.pk)
        output = EntrySerializer(instance, context=self.get_serializer_context())
        return Response(
            output.data,
            status=status.HTTP_201_CREATED,
            headers=self.get_success_headers(output.data),
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        refreshed = entry_api_queryset(request.user).get(pk=instance.pk)
        return Response(
            EntrySerializer(refreshed, context=self.get_serializer_context()).data
        )

    def get_queryset(self):
        queryset = entry_api_queryset(self.request.user)
        search = (
            self.request.query_params.get("q")
            or self.request.query_params.get("search")
            or ""
        ).strip()
        if search:
            queryset = queryset.filter(
                Q(summary__icontains=search)
                | Q(identity_note__icontains=search)
                | Q(
                    entry_writings__is_current=True,
                    entry_writings__writing__text__icontains=search,
                )
                | Q(
                    entry_writings__is_current=True,
                    entry_writings__writing__normalized_text__icontains=search,
                )
                | Q(senses__gloss__icontains=search)
                | Q(pronunciation_variants__ipa__icontains=search)
                | Q(pronunciation_variants__base_romanization__icontains=search)
                | Q(pronunciation_variants__surface_romanization__icontains=search)
                | Q(senses__concept_links__concept__code__icontains=search)
                | Q(senses__concept_links__concept__label__icontains=search)
                | Q(evidence_links__evidence__original_writing__icontains=search)
                | Q(evidence_links__evidence__original_gloss__icontains=search)
            )
        filters = {
            "status": "status",
            "writing_type": "entry_writings__writing__form_type",
            "source_type": "evidence_links__evidence__source_type",
        }
        for parameter, lookup in filters.items():
            value = self.request.query_params.get(parameter)
            if value:
                queryset = queryset.filter(**{lookup: value})
        writing = self.request.query_params.get("writing")
        if writing:
            queryset = queryset.filter(
                entry_writings__is_current=True,
                entry_writings__writing__text__iexact=writing.strip(),
            )
        ipa = self.request.query_params.get("ipa")
        if ipa:
            queryset = queryset.filter(
                pronunciation_variants__ipa__icontains=ipa.strip()
            )
        romanization = self.request.query_params.get("romanization")
        if romanization:
            queryset = queryset.filter(
                Q(
                    pronunciation_variants__base_romanization__icontains=romanization.strip()
                )
                | Q(
                    pronunciation_variants__surface_romanization__icontains=romanization.strip()
                )
            )
        source = self.request.query_params.get("source")
        if source:
            queryset = queryset.filter(
                evidence_links__evidence__citation__icontains=source.strip()
            )
        concept = self.request.query_params.get("concept")
        if concept:
            if concept.isdigit():
                queryset = queryset.filter(senses__concept_links__concept_id=concept)
            else:
                queryset = queryset.filter(
                    senses__concept_links__concept__code__iexact=concept
                )
        ids = selected_dialect_ids(self.request)
        if ids is not None:
            queryset = queryset.filter(
                Q(usage_dialect_id__in=ids)
                | Q(pronunciation_variants__dialect_id__in=ids)
                | Q(recording_links__recording__usage_dialect_id__in=ids)
                | Q(
                    usage_attestations__dialect_id__in=ids,
                    usage_attestations__active=True,
                )
            )
        has_recording = parse_boolean(
            self.request.query_params.get("has_recording"), "has_recording"
        )
        if has_recording is not None:
            subquery = available_recording_links_for_user(self.request.user).filter(
                entry_id=OuterRef("pk")
            )
            queryset = queryset.annotate(
                has_available_recording=Exists(subquery)
            ).filter(has_available_recording=has_recording)
        ordering = self.request.query_params.get("ordering", "-updated_at")
        if ordering not in {
            "updated_at",
            "-updated_at",
            "created_at",
            "-created_at",
            "id",
            "-id",
        }:
            raise BadRequestException("不支持该 ordering")
        return queryset.distinct().order_by(ordering, "-id")


class EntrySenseViewSet(viewsets.ModelViewSet):
    http_method_names = ["get", "post", "patch", "head", "options"]
    serializer_class = EntrySenseSerializer
    permission_classes = [V2ResourcePermission]

    def get_queryset(self):
        queryset = EntrySense.objects.filter(
            entry__in=visible_entries_for_user(self.request.user)
        ).select_related("entry", "entry__created_by", "created_by")
        queryset = queryset.prefetch_related(
            "entry__entry_writings__writing", "concept_links__concept"
        )
        for parameter, lookup in (
            ("entry_id", "entry_id"),
            ("status", "status"),
            ("concept", "concept_links__concept__code"),
        ):
            value = self.request.query_params.get(parameter)
            if value:
                queryset = queryset.filter(**{lookup: value})
        search = self.request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(
                Q(gloss__icontains=search) | Q(usage_note__icontains=search)
            )
        return queryset.distinct()

    def perform_create(self, serializer):
        entry = serializer.validated_data["entry"]
        if not can_curate_entry(self.request.user, entry):
            raise PermissionDenied("只有贡献者或词条整理员可以补充该词条义项")
        serializer.save()


class WritingFormViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = WritingFormSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        queryset = WritingForm.objects.filter(
            entries__in=visible_entries_for_user(self.request.user)
        )
        search = self.request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(
                Q(text__icontains=search) | Q(normalized_text__icontains=search)
            )
        form_type = self.request.query_params.get("form_type")
        if form_type:
            queryset = queryset.filter(form_type=form_type)
        return queryset.distinct()


class ConceptViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ConceptSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        queryset = Concept.objects.all()
        search = self.request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(
                Q(code__icontains=search)
                | Q(label__icontains=search)
                | Q(definition__icontains=search)
            )
        return queryset


class PronunciationVariantViewSet(viewsets.ModelViewSet):
    http_method_names = ["get", "post", "patch", "head", "options"]
    serializer_class = PronunciationVariantSerializer
    permission_classes = [V2ResourcePermission]

    def get_queryset(self):
        queryset = (
            PronunciationVariant.objects.filter(
                entry__in=visible_entries_for_user(self.request.user)
            )
            .select_related(
                "entry", "entry__created_by", "dialect", "dialect__parent", "created_by"
            )
            .prefetch_related("entry__entry_writings__writing")
        )
        for parameter in ("entry_id", "reading_type", "status"):
            value = self.request.query_params.get(parameter)
            if value:
                queryset = queryset.filter(**{parameter: value})
        ids = selected_dialect_ids(self.request)
        if ids is not None:
            queryset = queryset.filter(dialect_id__in=ids)
        ipa = self.request.query_params.get("ipa")
        if ipa:
            queryset = queryset.filter(ipa__icontains=ipa.strip())
        romanization = self.request.query_params.get("romanization")
        if romanization:
            queryset = queryset.filter(
                Q(base_romanization__icontains=romanization.strip())
                | Q(surface_romanization__icontains=romanization.strip())
            )
        return queryset

    def perform_create(self, serializer):
        entry = serializer.validated_data["entry"]
        dialect = serializer.validated_data["dialect"]
        if not (
            can_curate_entry(self.request.user, entry)
            or is_regional_curator(self.request.user, dialect)
        ):
            raise PermissionDenied("只有词条贡献者或相应整理员可以补充地区读音")
        serializer.save()


class RecordingViewSet(viewsets.ModelViewSet):
    http_method_names = ["get", "post", "patch", "head", "options"]
    serializer_class = RecordingSerializer
    permission_classes = [V2ResourcePermission]

    def response_queryset(self):
        return (
            visible_recordings_for_user(self.request.user)
            .select_related("usage_dialect", "usage_dialect__parent", "recorder")
            .prefetch_related(
                "entry_links__sense",
                "entry_links__entry__entry_writings__writing",
            )
            .annotate(evidence_count=Count("evidence_links", distinct=True))
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        instance = self.response_queryset().get(pk=serializer.instance.pk)
        output = self.get_serializer(instance)
        return Response(
            output.data,
            status=status.HTTP_201_CREATED,
            headers=self.get_success_headers(output.data),
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(
            self.get_serializer(self.response_queryset().get(pk=instance.pk)).data
        )

    def get_queryset(self):
        queryset = self.response_queryset()
        for parameter in ("recording_type", "status"):
            value = self.request.query_params.get(parameter)
            if value:
                queryset = queryset.filter(**{parameter: value})
        entry_id = self.request.query_params.get("entry_id")
        if entry_id:
            queryset = queryset.filter(
                entry_links__entry_id=entry_id,
                entry_links__is_current=True,
            )
        role = self.request.query_params.get("role")
        if role:
            queryset = queryset.filter(
                entry_links__role=role,
                entry_links__is_current=True,
            )
        ids = selected_dialect_ids(self.request)
        if ids is not None:
            queryset = queryset.filter(usage_dialect_id__in=ids)
        search = self.request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(
                Q(original_gloss__icontains=search)
                | Q(entry_links__entry__summary__icontains=search)
                | Q(entry_links__entry__entry_writings__writing__text__icontains=search)
            )
        has_entry = parse_boolean(
            self.request.query_params.get("has_entry"), "has_entry"
        )
        if has_entry is not None:
            queryset = queryset.annotate(
                has_current_entry=Exists(
                    RecordingEntryLink.objects.filter(
                        recording_id=OuterRef("pk"), is_current=True
                    ).exclude(status=RecordingEntryLink.Status.REJECTED)
                )
            ).filter(has_current_entry=has_entry)
        return queryset.distinct().order_by("-created_at", "-id")


class RecordingEntryLinkViewSet(viewsets.ModelViewSet):
    http_method_names = ["get", "post", "head", "options"]
    serializer_class = RecordingEntryLinkSerializer
    permission_classes = [V2ResourcePermission]

    def get_queryset(self):
        queryset = (
            RecordingEntryLink.objects.filter(
                recording__in=visible_recordings_for_user(self.request.user),
                entry__in=visible_entries_for_user(self.request.user),
            )
            .select_related(
                "recording",
                "recording__usage_dialect",
                "entry",
                "sense",
                "created_by",
                "reviewed_by",
            )
            .prefetch_related("entry__entry_writings__writing")
        )
        for parameter in ("recording_id", "entry_id", "role", "status"):
            value = self.request.query_params.get(parameter)
            if value:
                queryset = queryset.filter(**{parameter: value})
        current = parse_boolean(
            self.request.query_params.get("is_current"), "is_current"
        )
        if current is not None:
            queryset = queryset.filter(is_current=current)
        return queryset

    def perform_create(self, serializer):
        recording = serializer.validated_data["recording"]
        entry = serializer.validated_data["entry"]
        if not visible_entries_for_user(self.request.user).filter(pk=entry.pk).exists():
            raise PermissionDenied("不能关联不可见词条")
        if (
            not visible_recordings_for_user(self.request.user)
            .filter(pk=recording.pk)
            .exists()
        ):
            raise PermissionDenied("不能修改不可见录音")
        if not (
            can_curate_recording(self.request.user, recording)
            or can_curate_entry(self.request.user, entry)
        ):
            raise PermissionDenied("只有录制者、词条贡献者或整理员可以提出关联")
        serializer.save()


class UsageAttestationViewSet(viewsets.ModelViewSet):
    http_method_names = ["get", "post", "delete", "head", "options"]
    serializer_class = UsageAttestationSerializer
    permission_classes = [V2ResourcePermission]

    def get_queryset(self):
        queryset = (
            UsageAttestation.objects.filter(
                entry__in=visible_entries_for_user(self.request.user)
            )
            .select_related(
                "entry", "entry__created_by", "dialect", "dialect__parent", "attester"
            )
            .prefetch_related("entry__entry_writings__writing")
        )
        if not (self.request.user and self.request.user.is_authenticated):
            queryset = queryset.filter(active=True)
        for parameter in ("entry_id", "dialect_id"):
            value = self.request.query_params.get(parameter)
            if value:
                queryset = queryset.filter(**{parameter: value})
        active = parse_boolean(self.request.query_params.get("active"), "active")
        if active is not None:
            queryset = queryset.filter(active=active)
        return queryset

    def perform_create(self, serializer):
        entry = serializer.validated_data["entry"]
        if not visible_entries_for_user(self.request.user).filter(pk=entry.pk).exists():
            raise PermissionDenied("不能确认不可见词条")
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        attestation = self.get_object()
        self.check_object_permissions(request, attestation)
        attestation.active = False
        attestation.save(update_fields=["active", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class EvidenceRecordViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = EvidenceRecordSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        visible_entries = visible_entries_for_user(self.request.user)
        visible_recordings = visible_recordings_for_user(self.request.user)
        queryset = EvidenceRecord.objects.filter(
            Q(claim_links__entry__in=visible_entries)
            | Q(claim_links__sense__entry__in=visible_entries)
            | Q(claim_links__pronunciation_variant__entry__in=visible_entries)
            | Q(claim_links__recording__in=visible_recordings)
            | Q(claim_links__recording_entry_link__recording__in=visible_recordings)
        ).select_related("contributor")
        source_type = self.request.query_params.get("source_type")
        if source_type:
            queryset = queryset.filter(source_type=source_type)
        entry_id = self.request.query_params.get("entry_id")
        if entry_id:
            queryset = queryset.filter(
                Q(claim_links__entry_id=entry_id)
                | Q(claim_links__sense__entry_id=entry_id)
                | Q(claim_links__pronunciation_variant__entry_id=entry_id)
                | Q(claim_links__recording_entry_link__entry_id=entry_id)
            )
        recording_id = self.request.query_params.get("recording_id")
        if recording_id:
            queryset = queryset.filter(
                Q(claim_links__recording_id=recording_id)
                | Q(claim_links__recording_entry_link__recording_id=recording_id)
            )
        return queryset.distinct()


class LegacyReviewCandidateViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = LegacyReviewCandidateSerializer
    permission_classes = [IsLexicalCurator]

    def get_queryset(self):
        queryset = LegacyReviewCandidate.objects.select_related(
            "primary_entry"
        ).prefetch_related("entries__entry_writings__writing")
        for parameter in ("candidate_type", "status", "source_system"):
            value = self.request.query_params.get(parameter)
            if value:
                queryset = queryset.filter(**{parameter: value})
        return queryset


class CurationView(APIView):
    permission_classes = [IsActiveCurator]

    def get(self, request):
        grants = active_curator_grants(request.user)
        candidates = LegacyReviewCandidate.objects.filter(
            status=LegacyReviewCandidate.Status.PENDING
        )
        disputed_entries = Entry.objects.filter(status=Entry.Status.DISPUTED)
        disputed_recordings = Recording.objects.filter(status=Recording.Status.DISPUTED)
        disputed_links = RecordingEntryLink.objects.filter(
            status=RecordingEntryLink.Status.DISPUTED,
            is_current=True,
        )
        is_lexical = (
            request.user.is_staff
            or grants.filter(role=CuratorGrant.Role.LEXICAL).exists()
        )
        if not is_lexical:
            regional_ids = regional_curator_scope_ids(request.user)
            candidates = candidates.none()
            disputed_entries = disputed_entries.filter(
                Q(usage_dialect_id__in=regional_ids)
                | Q(recording_links__recording__usage_dialect_id__in=regional_ids)
            ).distinct()
            disputed_recordings = disputed_recordings.filter(
                usage_dialect_id__in=regional_ids
            )
            disputed_links = disputed_links.filter(
                recording__usage_dialect_id__in=regional_ids
            )
        return Response(
            {
                "grants": CuratorGrantSerializer(grants, many=True).data,
                "pending": {
                    "legacy_candidates": candidates.count(),
                    "disputed_entries": disputed_entries.count(),
                    "disputed_recordings": disputed_recordings.count(),
                    "disputed_recording_links": disputed_links.count(),
                },
            }
        )
