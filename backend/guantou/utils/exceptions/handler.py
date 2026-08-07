from django.http import Http404
from rest_framework import exceptions
from rest_framework.views import exception_handler

from .payload import api_error_payload, request_id


def normalize_message(data, default_message):
    if isinstance(data, dict):
        return data.get("msg") or data.get("message") or default_message
    if isinstance(data, list) and data:
        return str(data[0])
    return default_message


def normalize_data(data, exc=None):
    extra = getattr(exc, "data", None)
    if extra:
        return extra
    if isinstance(data, dict):
        fields = {
            key: value
            for key, value in data.items()
            if key not in ["msg", "message", "code", "request_id", "data"]
        }
        return {"fields": fields} if fields else data.get("data", {})
    if isinstance(data, list):
        return {"fields": {"non_field_errors": data}}
    return {}


def drf_exception_handler(exc, context):
    response = exception_handler(exc, context)
    rid = request_id(context.get("request"))

    if response is None:
        if isinstance(exc, Http404):
            return None
        return response

    default_message = (
        "请求参数校验失败" if isinstance(exc, exceptions.ValidationError) else str(exc)
    )
    message = normalize_message(response.data, default_message)
    response.data = api_error_payload(
        message=message,
        status_code=response.status_code,
        data=normalize_data(response.data, exc),
        rid=rid,
    )
    return response
