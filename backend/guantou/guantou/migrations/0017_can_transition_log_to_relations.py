from datetime import datetime

from django.db import migrations
from django.utils import timezone

VALID_STATUSES = {
    "unlabeled",
    "pending",
    "tentative",
    "verified",
    "disputed",
    "rejected",
}


def _actor_id(raw_actor):
    if isinstance(raw_actor, int):
        return raw_actor
    if isinstance(raw_actor, dict):
        actor_id = raw_actor.get("id")
        if isinstance(actor_id, int) and not isinstance(actor_id, bool):
            return actor_id
    return None


def _parse_at(raw_at):
    if not isinstance(raw_at, str):
        return timezone.now()
    try:
        value = datetime.fromisoformat(raw_at.replace("Z", "+00:00"))
        if value.tzinfo is None:
            value = timezone.make_aware(value)
        return value
    except (ValueError, TypeError):
        return timezone.now()


def migrate_json_to_rows(apps, schema_editor):
    Can = apps.get_model("guantou", "Can")
    CanTransition = apps.get_model("guantou", "CanTransition")
    User = apps.get_model("auth", "User")

    user_ids = set(User.objects.values_list("id", flat=True))
    for can in Can.objects.exclude(transition_log=[]).iterator():
        rows = []
        for raw_event in can.transition_log or []:
            if not isinstance(raw_event, dict):
                continue
            from_status = str(raw_event.get("from") or "")
            to_status = str(raw_event.get("to") or "")
            action = str(raw_event.get("action") or "")
            if from_status not in VALID_STATUSES or to_status not in VALID_STATUSES:
                continue
            actor_id = _actor_id(raw_event.get("by"))
            actor = actor_id if actor_id in user_ids else None
            rows.append(
                CanTransition(
                    can_id=can.id,
                    from_status=from_status,
                    to_status=to_status,
                    action=action,
                    actor_id=actor,
                    reason=str(raw_event.get("reason") or ""),
                    created_at=_parse_at(raw_event.get("at")),
                )
            )
        if rows:
            CanTransition.objects.bulk_create(rows)


def migrate_rows_to_json(apps, schema_editor):
    CanTransition = apps.get_model("guantou", "CanTransition")
    CanTransition.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ("guantou", "0016_cantransition"),
    ]

    operations = [
        migrations.RunPython(
            migrate_json_to_rows,
            migrate_rows_to_json,
        ),
    ]
