from django.contrib.auth.models import User
from django.db.models import Q
from notifications.models import Notification
from notifications.signals import notify


def send_notification(
    sender, recipients, content, target=None, action_object=None, title=None
):
    if recipients is None:
        transfer = User.objects.filter(is_superuser=True).order_by("id").first()
        recipients = User.objects.filter(is_superuser=True)
        if not transfer:
            return []
        return send_notification(
            transfer, recipients, content, target, action_object, title
        )
    if sender is None:
        sender = User.objects.filter(is_superuser=True).order_by("id").first()
    if title is None:
        title = f"【通知】{sender.username} 回复了你"
    try:
        len(recipients)
    except TypeError:
        recipients = [recipients]
    result = notify.send(
        sender,
        recipient=recipients,
        verb=title,
        description=content,
        target=target,
        action_object=action_object,
    )
    return [note.id for note in result[0][1]]


def mark_notification_read(notification):
    if isinstance(notification.target, Notification):
        notification.target.unread = False
        notification.target.save()
        Notification.objects.filter(
            Q(target_content_type=notification.target_content_type)
            & Q(target_object_id=notification.target_object_id)
        ).mark_all_as_read()
    else:
        notification.unread = False
        notification.save()
