import uuid

REQUEST_ID_ATTR = "_guantou_request_id"


def request_id(request):
    if not request:
        return ""
    current = getattr(request, REQUEST_ID_ATTR, "")
    if current:
        return current
    generated = request.META.get("HTTP_X_REQUEST_ID") or str(uuid.uuid4())
    setattr(request, REQUEST_ID_ATTR, generated)
    return generated


def api_error_payload(message, status_code, data=None, rid=""):
    return {
        "code": status_code,
        "message": str(message),
        "data": data or {},
        "request_id": rid,
    }


def field_error(message, code="invalid"):
    return {"code": str(code), "message": str(message)}
