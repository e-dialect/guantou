from django.http import Http404
from rest_framework import exceptions
from rest_framework.views import exception_handler

from .payload import ERROR_CODES, api_error_payload, request_id


def normalize_message(data, default_message):
    if isinstance(data, dict):
        return data.get("msg") or data.get("message") or default_message
    if isinstance(data, list) and data:
        return str(data[0])
    return default_message


def normalize_details(data):
    if isinstance(data, dict):
        return {
            key: value
            for key, value in data.items()
            if key not in ["msg", "message", "code", "request_id"]
        }
    if isinstance(data, list):
        return {"non_field_errors": data}
    return {}


def drf_exception_handler(exc, context):
    response = exception_handler(exc, context)
    rid = request_id(context.get("request"))

    if response is None:
        if isinstance(exc, Http404):
            return None
        return response

    if isinstance(exc, exceptions.ValidationError):
        code = "validation_error"
    elif isinstance(exc, exceptions.NotAuthenticated):
        code = "not_authenticated"
    elif isinstance(exc, exceptions.AuthenticationFailed):
        code = "authentication_failed"
    elif isinstance(exc, exceptions.PermissionDenied):
        code = "permission_denied"
    elif isinstance(exc, exceptions.NotFound):
        code = "not_found"
    else:
        code = ERROR_CODES.get(response.status_code, "api_error")

    message = normalize_message(response.data, str(exc))
    response.data = api_error_payload(
        message=message,
        status_code=response.status_code,
        details=normalize_details(response.data),
        code=code,
        rid=rid,
    )
    return response
