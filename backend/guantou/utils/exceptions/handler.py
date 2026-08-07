import logging

from django.http import Http404
from rest_framework import exceptions
from rest_framework.views import exception_handler

from .payload import api_error_payload, field_error, request_id

logger = logging.getLogger("log")


def normalize_message(data, default_message):
    if isinstance(data, dict):
        return data.get("message") or data.get("msg") or default_message
    if isinstance(data, list) and data:
        return str(data[0])
    return default_message


def serialize_validation_error(value):
    if isinstance(value, dict):
        return {key: serialize_validation_error(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        items = [serialize_validation_error(item) for item in value]
        return items[0] if len(items) == 1 else items
    return field_error(str(value), getattr(value, "code", "invalid"))


def normalize_data(data, exc=None):
    extra = getattr(exc, "data", None)
    if extra:
        return extra
    if isinstance(exc, exceptions.ValidationError):
        if isinstance(data, dict):
            return serialize_validation_error(data)
        return {"non_field_errors": serialize_validation_error(data)}
    if isinstance(data, dict):
        return data.get("data", {})
    return {}


def drf_exception_handler(exc, context):
    response = exception_handler(exc, context)
    rid = request_id(context.get("request"))

    if response is None:
        if isinstance(exc, Http404):
            return None
        return response

    if response.status_code >= 500:
        logger.error("DRF server error", exc_info=exc)
        response.data = api_error_payload(
            message="服务器内部错误",
            status_code=response.status_code,
            data={},
            rid=rid,
        )
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
