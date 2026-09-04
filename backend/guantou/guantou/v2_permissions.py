from django.utils import timezone
from rest_framework import permissions

from .models import (
    CuratorGrant,
    Entry,
    EntrySense,
    PronunciationVariant,
    Recording,
    RecordingEntryLink,
    UsageAttestation,
)


def active_curator_grants(user, role=None):
    if not user or not user.is_authenticated:
        return CuratorGrant.objects.none()
    now = timezone.now()
    queryset = CuratorGrant.objects.filter(
        user=user,
        revoked_at__isnull=True,
        valid_from__lte=now,
        valid_until__gt=now,
    ).select_related("dialect")
    return queryset.filter(role=role) if role else queryset


def is_lexical_curator(user):
    return bool(
        user
        and user.is_authenticated
        and (
            user.is_staff
            or active_curator_grants(user, CuratorGrant.Role.LEXICAL).exists()
        )
    )


def is_regional_curator(user, dialect):
    if not user or not user.is_authenticated:
        return False
    if user.is_staff:
        return True
    if dialect is None:
        return False
    for grant in active_curator_grants(user, CuratorGrant.Role.REGIONAL):
        if dialect.id in grant.dialect.descendant_ids():
            return True
    return False


def regional_curator_scope_ids(user):
    ids = set()
    for grant in active_curator_grants(user, CuratorGrant.Role.REGIONAL):
        ids.update(grant.dialect.descendant_ids())
    return ids


def can_curate_entry(user, entry):
    return bool(
        user
        and user.is_authenticated
        and (
            user.is_staff or entry.created_by_id == user.id or is_lexical_curator(user)
        )
    )


def can_curate_recording(user, recording):
    return bool(
        user
        and user.is_authenticated
        and (
            user.is_staff
            or recording.recorder_id == user.id
            or is_regional_curator(user, recording.usage_dialect)
        )
    )


class V2ResourcePermission(permissions.BasePermission):
    """Keep public reading broad while limiting edits to owners and curators."""

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        user = request.user
        if isinstance(obj, Entry):
            return can_curate_entry(user, obj)
        if isinstance(obj, EntrySense):
            return can_curate_entry(user, obj.entry)
        if isinstance(obj, PronunciationVariant):
            return can_curate_entry(user, obj.entry) or is_regional_curator(
                user, obj.dialect
            )
        if isinstance(obj, Recording):
            return can_curate_recording(user, obj)
        if isinstance(obj, RecordingEntryLink):
            return (
                obj.created_by_id == user.id
                or can_curate_entry(user, obj.entry)
                or can_curate_recording(user, obj.recording)
            )
        if isinstance(obj, UsageAttestation):
            return bool(user.is_staff or obj.attester_id == user.id)
        return bool(user and user.is_staff)


class IsActiveCurator(permissions.BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and (user.is_staff or active_curator_grants(user).exists())
        )


class IsLexicalCurator(permissions.BasePermission):
    def has_permission(self, request, view):
        return is_lexical_curator(request.user)
