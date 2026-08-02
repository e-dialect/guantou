import uuid

from rest_framework import status

REQUEST_ID_ATTR = "_guantou_request_id"

ERROR_CODES = {
    status.HTTP_400_BAD_REQUEST: "bad_request",
    status.HTTP_401_UNAUTHORIZED: "unauthorized",
    status.HTTP_403_FORBIDDEN: "forbidden",
    status.HTTP_404_NOT_FOUND: "not_found",
    status.HTTP_500_INTERNAL_SERVER_ERROR: "internal_error",
}


def request_id(request):
    if not request:
        return ""
    current = getattr(request, REQUEST_ID_ATTR, "")
    if current:
        return current
    generated = request.META.get("HTTP_X_REQUEST_ID") or str(uuid.uuid4())
    setattr(request, REQUEST_ID_ATTR, generated)
    return generated


def api_error_payload(message, status_code, details=None, code=None, rid=""):
    normalized_code = code or ERROR_CODES.get(status_code, "error")
    return {
        "msg": message,
        "message": message,
        "code": normalized_code,
        "details": details or {},
        "request_id": rid,
    }
