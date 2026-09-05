from django.core.exceptions import ValidationError

CAPABILITY_KEYS = (
    "listen_feed",
    "entry_search",
    "recording",
    "usage_attestation",
    "curation_workbench",
    "wechat_auth",
)


def default_remote_capabilities():
    """Remote switches can only turn compiled client capabilities off."""

    return {key: True for key in CAPABILITY_KEYS}


def validate_remote_capabilities(value):
    if not isinstance(value, dict):
        raise ValidationError("远程能力开关必须是对象")
    unknown = sorted(set(value) - set(CAPABILITY_KEYS))
    if unknown:
        raise ValidationError(f"未知能力开关：{', '.join(unknown)}")
    invalid = sorted(key for key, enabled in value.items() if type(enabled) is not bool)
    if invalid:
        raise ValidationError(f"能力开关只能使用 true/false：{', '.join(invalid)}")


def resolved_remote_capabilities(value):
    resolved = default_remote_capabilities()
    if isinstance(value, dict):
        for key in CAPABILITY_KEYS:
            if type(value.get(key)) is bool:
                resolved[key] = value[key]
    return resolved
