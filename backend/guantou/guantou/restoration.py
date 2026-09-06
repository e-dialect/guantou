"""Entry-first collections and lightweight Recording interactions (no legacy writes)."""

from django.db import transaction
from django.db.models import Q, Count, Prefetch
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from inbox.models import Notification
from inbox.services import send_event_notification
from .models import (
    Collection,
    CollectionEntry,
    CollectionRecording,
    Recording,
    RecordingEntryLink,
    RecordingLike,
    RecordingComment,
    RecordingCommentLike,
    DailyRecordingSelection,
)
from .v2_views import (
    visible_entries_for_user,
    visible_recordings_for_user,
    entry_api_queryset,
)
from .v2_serializers import EntryCardSerializer, RecordingSerializer


def active_links(user):
    return (
        RecordingEntryLink.objects.filter(is_current=True)
        .exclude(status="rejected")
        .filter(
            entry__in=visible_entries_for_user(user),
            recording__in=visible_recordings_for_user(user),
        )
    )


def recording_data(recording, request):
    data = RecordingSerializer(recording, context={"request": request}).data
    links = active_links(request.user).filter(recording=recording)
    ids = set(links.values_list("id", flat=True))
    data["entry_links"] = [link for link in data["entry_links"] if link["id"] in ids]
    data["like_count"] = recording.likes.count()
    data["liked"] = (
        request.user.is_authenticated
        and recording.likes.filter(user=request.user).exists()
    )
    data["comment_count"] = (
        recording.comments.filter(hidden=False)
        .filter(Q(parent=None) | Q(parent__hidden=False))
        .count()
    )
    return data


class CollectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Collection
        fields = ["id", "title", "description", "is_public", "owner_id", "created_at"]
        read_only_fields = ["owner_id", "created_at"]


class SectionInput(serializers.Serializer):
    entry_id = serializers.IntegerField(min_value=1)
    sort_order = serializers.IntegerField(min_value=0, required=False)


class RecordingInput(serializers.Serializer):
    recording_id = serializers.IntegerField(min_value=1)
    entry_id = serializers.IntegerField(min_value=1, required=False, allow_null=True)
    sort_order = serializers.IntegerField(min_value=0, required=False)


class OrderInput(serializers.Serializer):
    ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1), max_length=1000
    )
    section_id = serializers.IntegerField(min_value=1, required=False, allow_null=True)


def append_order(rows):
    last = (
        rows.order_by("-sort_order", "-id").values_list("sort_order", flat=True).first()
    )
    return (last + 1) if last is not None else 0


class CollectionViewSet(viewsets.ModelViewSet):
    serializer_class = CollectionSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        public = Collection.objects.filter(is_public=True)
        if self.request.query_params.get("mine") == "true":
            return (
                Collection.objects.filter(owner=self.request.user)
                if self.request.user.is_authenticated
                else Collection.objects.none()
            )
        if self.action == "list":
            return public
        return (
            Collection.objects.filter(Q(is_public=True) | Q(owner=self.request.user))
            if self.request.user.is_authenticated
            else public
        )

    def owned(self):
        box = self.get_object()
        if box.owner_id != self.request.user.id:
            raise PermissionDenied("只有集盒所有者可以修改")
        return box

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    def perform_update(self, serializer):
        self.owned()
        serializer.save()

    def perform_destroy(self, instance):
        self.owned()
        instance.delete()

    def retrieve(self, request, *args, **kwargs):
        box = self.get_object()
        data = self.get_serializer(box).data
        data["editable"] = request.user.id == box.owner_id
        # Public viewers only see currently visible resources, even if a private item was collected earlier.
        viewer = request.user
        directory = list(box.sections.all())
        entry_map = {
            entry.id: EntryCardSerializer(entry, context={"request": request}).data
            for entry in entry_api_queryset(viewer).filter(
                pk__in=[row.entry_id for row in directory]
            )
        }
        collected = list(box.recording_items.all())
        links_qs = active_links(viewer).filter(
            recording_id__in=[row.recording_id for row in collected]
        )
        links = set(links_qs.values_list("entry_id", "recording_id"))
        recordings = (
            visible_recordings_for_user(viewer)
            .filter(pk__in=[row.recording_id for row in collected])
            .select_related(
                "usage_dialect", "usage_dialect__parent", "recorder__user_info"
            )
            .prefetch_related(
                Prefetch(
                    "entry_links",
                    queryset=links_qs.select_related("entry", "sense").prefetch_related(
                        "entry__entry_writings__writing"
                    ),
                )
            )
        )
        recording_map = {
            row["id"]: row
            for row in RecordingSerializer(
                recordings, many=True, context={"request": request}
            ).data
        }
        sections = []
        seen = set()
        grouped = {}
        for item in collected:
            grouped.setdefault(item.section_id, []).append(item)
        for section in directory:
            if section.entry_id not in entry_map:
                continue
            items = []
            for item in grouped.get(section.id, []):
                if item.recording_id not in recording_map:
                    continue
                valid = (section.entry_id, item.recording_id) in links
                if not valid and not data["editable"]:
                    continue
                items.append(
                    {
                        "id": item.id,
                        "needs_review": not valid,
                        "recording": recording_map[item.recording_id],
                    }
                )
                seen.add(item.recording_id)
            sections.append(
                {
                    "id": section.id,
                    "entry": entry_map[section.entry_id],
                    "recordings": items,
                    "recording_count": len(items),
                }
            )
        pending = []
        for item in grouped.get(None, []):
            if item.recording_id not in recording_map:
                continue
            pending.append(
                {"id": item.id, "recording": recording_map[item.recording_id]}
            )
            seen.add(item.recording_id)
        if data["editable"]:
            shown_items = len(pending) + sum(len(row["recordings"]) for row in sections)
            data["unavailable_count"] = (
                len(directory) - len(sections) + len(collected) - shown_items
            )
        data.update(
            sections=sections,
            pending=pending,
            recording_count=len(seen),
            entry_count=len(sections),
        )
        return Response(data)

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def entries(self, request, pk=None):
        box = self.owned()
        Collection.objects.select_for_update().get(pk=box.pk)
        values = SectionInput(data=request.data)
        values.is_valid(raise_exception=True)
        entry = get_object_or_404(
            visible_entries_for_user(request.user), pk=values.validated_data["entry_id"]
        )
        section, _ = CollectionEntry.objects.get_or_create(
            collection=box,
            entry=entry,
            defaults={"sort_order": append_order(box.sections)},
        )
        return Response({"id": section.id})

    @action(detail=True, methods=["delete"], url_path=r"entries/(?P<item_id>[0-9]+)")
    def remove_entry(self, request, pk=None, item_id=None):
        get_object_or_404(self.owned().sections, pk=item_id).delete()
        return Response(status=204)

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def recordings(self, request, pk=None):
        box = self.owned()
        Collection.objects.select_for_update().get(pk=box.pk)
        values = RecordingInput(data=request.data)
        values.is_valid(raise_exception=True)
        values = values.validated_data
        recording = get_object_or_404(
            visible_recordings_for_user(request.user), pk=values["recording_id"]
        )
        links = active_links(request.user).filter(recording=recording)
        section = None
        if values.get("entry_id"):
            if not links.filter(entry_id=values["entry_id"]).exists():
                raise ValidationError("请选择录音当前关联的词条")
            section, _ = CollectionEntry.objects.get_or_create(
                collection=box,
                entry_id=values["entry_id"],
                defaults={"sort_order": append_order(box.sections)},
            )
        elif links.exists():
            raise ValidationError("这段录音已有词条，请选择盒内归属")
        item, _ = CollectionRecording.objects.get_or_create(
            collection=box,
            section=section,
            recording=recording,
            defaults={
                "sort_order": append_order(box.recording_items.filter(section=section))
            },
        )
        # Explicitly assigning a linked entry confirms organization of a pending item.
        if section:
            box.recording_items.filter(section=None, recording=recording).delete()
        return Response({"id": item.id})

    @action(detail=True, methods=["delete"], url_path=r"recordings/(?P<item_id>[0-9]+)")
    def remove_recording(self, request, pk=None, item_id=None):
        get_object_or_404(self.owned().recording_items, pk=item_id).delete()
        return Response(status=204)

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def order(self, request, pk=None):
        box = self.owned()
        Collection.objects.select_for_update().get(pk=box.pk)
        values = OrderInput(data=request.data)
        values.is_valid(raise_exception=True)
        data = values.validated_data
        if "section_id" in data:
            if data["section_id"] is not None:
                get_object_or_404(box.sections, pk=data["section_id"])
            rows = box.recording_items.filter(section_id=data["section_id"])
        else:
            rows = box.sections.all()
        if "section_id" in data:
            available = rows.filter(
                recording__in=visible_recordings_for_user(request.user)
            )
        else:
            available = rows.filter(entry__in=visible_entries_for_user(request.user))
        ids = data["ids"]
        expected = set(available.values_list("id", flat=True))
        if len(ids) != len(set(ids)) or set(ids) != expected:
            raise ValidationError("排序必须包含该目录全部可见条目且不能重复")
        ordered = list(rows)
        by_id = {row.id: row for row in ordered}
        positions = [index for index, row in enumerate(ordered) if row.id in expected]
        for position, item_id in zip(positions, ids):
            ordered[position] = by_id[item_id]
        for index, row in enumerate(ordered):
            row.sort_order = index
        rows.model.objects.bulk_update(ordered, ["sort_order"])
        return Response({"ordered": True})


def event_once(actor, recipient, verb, recording, comment=None):
    if not recipient or actor.pk == recipient.pk:
        return
    metadata = {
        "target_type": "recording",
        "target_id": recording.id,
        "target_url": f"/pages/recordings/details?id={recording.id}",
    }
    obj = comment or recording
    # One notification per actor/object/verb, including unlike/re-like.
    from django.contrib.contenttypes.models import ContentType

    if Notification.objects.filter(
        actor=actor,
        recipient=recipient,
        verb=verb,
        related_content_type=ContentType.objects.get_for_model(obj),
        related_object_id=str(obj.pk),
    ).exists():
        return
    send_event_notification(
        actor=actor,
        recipient=recipient,
        verb=verb,
        action_object=obj,
        metadata=metadata,
        description="你的乡音有了新的回应",
    )


def recording_like(view, request, pk):
    recording = get_object_or_404(visible_recordings_for_user(request.user), pk=pk)
    if request.method == "PUT":
        _, created = RecordingLike.objects.get_or_create(
            recording=recording, user=request.user
        )
        if created:
            event_once(request.user, recording.recorder, "recording.like", recording)
    else:
        RecordingLike.objects.filter(recording=recording, user=request.user).delete()
    return Response(
        {"liked": request.method == "PUT", "like_count": recording.likes.count()}
    )


def discover_recording(view, request, daily=False):
    candidates = Recording.objects.filter(visibility=True).order_by("id")
    if daily:
        today = timezone.localdate()
        selection = DailyRecordingSelection.objects.filter(date=today).first()
        recording = (
            candidates.filter(pk=selection.recording_id).first() if selection else None
        )
        if recording is None:
            count = candidates.count()
            if not count:
                return Response(None, status=204)
            recording = candidates[today.toordinal() % count]
            if selection:
                DailyRecordingSelection.objects.filter(pk=selection.pk).update(
                    recording=recording
                )
            else:
                selection, _ = DailyRecordingSelection.objects.get_or_create(
                    date=today, defaults={"recording": recording}
                )
                recording = (
                    candidates.filter(pk=selection.recording_id).first() or recording
                )
    else:
        from random import randrange

        count = candidates.count()
        recording = candidates[randrange(count)] if count else None
    return (
        Response(recording_data(recording, request))
        if recording
        else Response(None, status=204)
    )


class CommentInput(serializers.Serializer):
    recording_id = serializers.IntegerField(min_value=1)
    parent_id = serializers.IntegerField(min_value=1, required=False, allow_null=True)
    body = serializers.CharField(max_length=2000)
    client_id = serializers.UUIDField()


class CommentSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source="author.username", read_only=True)
    author_id = serializers.IntegerField(read_only=True)
    like_count = serializers.SerializerMethodField()
    liked = serializers.SerializerMethodField()
    editable = serializers.SerializerMethodField()

    def get_like_count(self, obj):
        return obj.likes.count()

    def get_liked(self, obj):
        user = self.context["request"].user
        return user.is_authenticated and obj.likes.filter(user=user).exists()

    def get_editable(self, obj):
        user = self.context["request"].user
        return user.is_authenticated and (user.id == obj.author_id or user.is_staff)

    class Meta:
        model = RecordingComment
        fields = [
            "id",
            "recording_id",
            "parent_id",
            "body",
            "author_name",
            "author_id",
            "created_at",
            "like_count",
            "liked",
            "editable",
        ]


class RecordingCommentViewSet(viewsets.GenericViewSet):
    serializer_class = CommentSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        return (
            RecordingComment.objects.filter(
                recording__in=visible_recordings_for_user(self.request.user),
                hidden=False,
            )
            .filter(Q(parent=None) | Q(parent__hidden=False))
            .select_related("author", "recording", "parent__author")
            .prefetch_related("likes")
        )

    def list(self, request):
        values = serializers.IntegerField(min_value=1).run_validation(
            request.query_params.get("recording_id")
        )
        get_object_or_404(visible_recordings_for_user(request.user), pk=values)
        rows = self.get_queryset().filter(recording_id=values)
        page = self.paginate_queryset(rows)
        return self.get_paginated_response(self.get_serializer(page, many=True).data)

    @transaction.atomic
    def create(self, request):
        values = CommentInput(data=request.data)
        values.is_valid(raise_exception=True)
        data = values.validated_data
        recording = get_object_or_404(
            visible_recordings_for_user(request.user), pk=data["recording_id"]
        )
        parent = None
        if data.get("parent_id"):
            parent = get_object_or_404(
                self.get_queryset(),
                pk=data["parent_id"],
                recording=recording,
                parent=None,
            )
        comment, created = RecordingComment.objects.get_or_create(
            author=request.user,
            client_id=data["client_id"],
            defaults={"recording": recording, "parent": parent, "body": data["body"]},
        )
        if (
            comment.recording_id != recording.id
            or comment.parent_id != data.get("parent_id")
            or comment.body != data["body"]
            or comment.hidden
        ):
            raise ValidationError("重复请求标识对应的评论不一致")
        if created:
            event_once(
                request.user,
                recording.recorder,
                "recording.comment",
                recording,
                comment,
            )
            if parent and parent.author_id != recording.recorder_id:
                event_once(
                    request.user, parent.author, "recording.reply", recording, comment
                )
        return Response(
            self.get_serializer(comment).data, status=201 if created else 200
        )

    def destroy(self, request, pk=None):
        comment = self.get_object()
        if not (comment.author_id == request.user.id or request.user.is_staff):
            raise PermissionDenied()
        comment.hidden = True
        comment.save(update_fields=["hidden"])
        return Response(status=204)

    @action(
        detail=True,
        methods=["put", "delete"],
        permission_classes=[permissions.IsAuthenticated],
    )
    @transaction.atomic
    def like(self, request, pk=None):
        comment = self.get_object()
        if request.method == "PUT":
            _, created = RecordingCommentLike.objects.get_or_create(
                comment=comment, user=request.user
            )
            if created:
                event_once(
                    request.user,
                    comment.author,
                    "recording.comment_like",
                    comment.recording,
                    comment,
                )
        else:
            comment.likes.filter(user=request.user).delete()
        return Response(
            {"liked": request.method == "PUT", "like_count": comment.likes.count()}
        )


def entry_suggestions(view, request, popular=False):
    # Public only: suggestions and aggregate ranks must not disclose private terms.
    rows = entry_api_queryset(None)
    term = str(request.query_params.get("q", "")).strip()[:120]
    if not popular:
        if not term:
            return Response([])
        rows = rows.filter(
            Q(summary__icontains=term)
            | Q(entry_writings__writing__text__icontains=term)
        ).distinct()
    else:
        rows = rows.annotate(
            popularity=Count(
                "recording_links__recording__likes",
                filter=Q(
                    recording_links__is_current=True,
                    recording_links__recording__visibility=True,
                )
                & ~Q(recording_links__status="rejected"),
                distinct=True,
            )
            + Count(
                "usage_attestations",
                filter=Q(usage_attestations__active=True),
                distinct=True,
            )
        ).order_by("-popularity", "-id")
    return Response(
        EntryCardSerializer(rows[:8], many=True, context={"request": request}).data
    )
