from rest_framework import serializers

from .models import ProductEventName, ProductPlatform

SURFACES = {"listen", "search", "record", "entry_detail", "curation"}
RESULTS = {"view", "success", "empty", "error", "unavailable", "cancelled"}
METADATA_RULES = {
    "tab": {"today", "dialect", "following", "recommended"},
    "result_bucket": {"0", "1-5", "6-20", "21+"},
    "filter_count": range(0, 11),
    "has_linked_entry": {True, False},
    "dialect_depth": range(0, 11),
    "task_kind": {
        "legacy_candidate",
        "entry",
        "sense",
        "recording",
        "pronunciation",
        "recording_link",
    },
    "capability": {
        "listen_feed",
        "entry_search",
        "recording",
        "usage_attestation",
        "curation_workbench",
        "wechat_auth",
    },
    "reason": {"not_compiled", "disabled_remotely", "config_unavailable"},
}


class ProductEventInputSerializer(serializers.Serializer):
    session_id = serializers.CharField(write_only=True, min_length=8, max_length=128)
    event_name = serializers.ChoiceField(choices=ProductEventName.choices)
    platform = serializers.ChoiceField(choices=ProductPlatform.choices)
    surface = serializers.ChoiceField(
        required=False, allow_blank=True, choices=sorted(SURFACES)
    )
    result = serializers.ChoiceField(
        required=False, allow_blank=True, choices=sorted(RESULTS)
    )
    metadata = serializers.JSONField(required=False, default=dict)

    def validate_metadata(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError("metadata 必须是对象")
        unknown = sorted(set(value) - set(METADATA_RULES))
        if unknown:
            raise serializers.ValidationError(
                f"不允许记录这些字段：{', '.join(unknown)}"
            )
        normalized = {}
        for key, candidate in value.items():
            allowed = METADATA_RULES[key]
            if key in {"filter_count", "dialect_depth"}:
                if type(candidate) is not int or candidate not in allowed:
                    raise serializers.ValidationError(f"{key} 超出允许范围")
            elif candidate not in allowed:
                raise serializers.ValidationError(f"{key} 取值无效")
            normalized[key] = candidate
        return normalized
