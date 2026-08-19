from django.contrib.auth.models import AnonymousUser
from django.contrib.contenttypes.models import ContentType
from django.db.models.signals import post_delete, post_save, pre_delete, pre_save
from django.dispatch import receiver

from guantou.models import (
    Can,
    Dialect,
    Flavor,
    Pronunciation,
    Nameplate,
    NameplateSupport,
    Package,
    Shelf,
)
from utils.exceptions.payload import request_id

from .context import get_current_request
from .models import ObjectChangeLog

TRACKED_MODELS = (
    Can,
    Nameplate,
    Flavor,
    Pronunciation,
    Package,
    Dialect,
    Shelf,
    NameplateSupport,
)

# Can status transitions are audited by guantou.CanTransition; skip the
# redundant generic ObjectChangeLog snapshot for the transition-only save.
IGNORED_UPDATE_FIELDS = {
    Can: {"views", "updated_at", "transition_log", "status", "verifier"},
}

SNAPSHOT_ATTR = "_audit_original_snapshot"


def serialize_value(value):
    if value is None:
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()
    if isinstance(value, (str, int, float, bool, list, dict)):
        return value
    return str(value)


def snapshot(instance):
    data = {}
    for field in instance._meta.fields:
        data[field.name] = serialize_value(getattr(instance, field.name))
    return data


def request_actor():
    request = get_current_request()
    if not request:
        return None, None, ""
    user = getattr(request, "user", None)
    if isinstance(user, AnonymousUser) or not getattr(user, "is_authenticated", False):
        user = None
    return user, getattr(request, "visitor", None), request_id(request)


def should_skip_update(instance, update_fields):
    ignored = IGNORED_UPDATE_FIELDS.get(instance.__class__, set())
    if not ignored or update_fields is None:
        return False
    return set(update_fields).issubset(ignored)


def create_log(instance, action, before=None, after=None):
    before = before or {}
    after = after or {}
    changed_fields = sorted(
        field
        for field in set(before) | set(after)
        if before.get(field) != after.get(field)
    )
    if action == ObjectChangeLog.Action.UPDATE and not changed_fields:
        return
    user, visitor, rid = request_actor()
    ObjectChangeLog.objects.create(
        content_type=ContentType.objects.get_for_model(instance.__class__),
        object_id=str(instance.pk),
        object_label=str(instance)[:255],
        action=action,
        changed_fields=changed_fields,
        before=before,
        after=after,
        actor_user=user,
        actor_visitor=visitor,
        request_id=rid,
    )


@receiver(pre_save)
def capture_original(sender, instance, update_fields=None, **kwargs):
    if sender not in TRACKED_MODELS or not instance.pk:
        return
    if should_skip_update(instance, update_fields):
        return
    original = sender.objects.filter(pk=instance.pk).first()
    if original:
        setattr(instance, SNAPSHOT_ATTR, snapshot(original))


@receiver(post_save)
def log_save(sender, instance, created=False, update_fields=None, **kwargs):
    if sender not in TRACKED_MODELS:
        return
    if not created and should_skip_update(instance, update_fields):
        return
    after = snapshot(instance)
    if created:
        create_log(instance, ObjectChangeLog.Action.CREATE, before={}, after=after)
        return
    before = getattr(instance, SNAPSHOT_ATTR, {})
    create_log(instance, ObjectChangeLog.Action.UPDATE, before=before, after=after)


@receiver(pre_delete)
def capture_deleted(sender, instance, **kwargs):
    if sender not in TRACKED_MODELS:
        return
    setattr(instance, SNAPSHOT_ATTR, snapshot(instance))


@receiver(post_delete)
def log_delete(sender, instance, **kwargs):
    if sender not in TRACKED_MODELS:
        return
    before = getattr(instance, SNAPSHOT_ATTR, snapshot(instance))
    create_log(instance, ObjectChangeLog.Action.DELETE, before=before, after={})
