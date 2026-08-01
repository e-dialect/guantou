from django.contrib.auth.models import User
from django.db.models import Q

from .models import Notification


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
    notifications = [
        Notification.objects.create(
            actor=sender,
            recipient=recipient,
            verb=title,
            description=content,
            target=target if isinstance(target, Notification) else None,
        )
        for recipient in recipients
    ]
    return [notification.id for notification in notifications]


def mark_notification_read(notification):
    if isinstance(notification.target, Notification):
        notification.target.unread = False
        notification.target.save()
        Notification.objects.filter(Q(target=notification.target)).update(unread=False)
    else:
        notification.unread = False
        notification.save()
