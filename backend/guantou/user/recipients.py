from django.contrib.auth.models import User


def eligible_recipients(viewer):
    """Public identities eligible for direct mail, shared by lookup and delivery."""
    return User.objects.filter(
        is_active=True, is_superuser=False, user_info__isnull=False
    ).exclude(id=viewer.id)
