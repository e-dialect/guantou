import hashlib
import logging
import time
import uuid

from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.middleware.common import MiddlewareMixin

from utils.exceptions.payload import request_id

from .context import reset_current_request, set_current_request
from .models import AnonymousVisitor, VisitorEvent

logger = logging.getLogger(__name__)

VISITOR_HEADER = "X-Visitor-ID"
VISITOR_META_HEADER = "HTTP_X_VISITOR_ID"


def client_ip(request):
    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if forwarded_for:
        return forwarded_for.split(",", 1)[0].strip()
    return request.META.get("REMOTE_ADDR", "")


def hash_ip(ip):
    if not ip:
        return ""
    salt = getattr(settings, "SECRET_KEY", "")
    return hashlib.sha256(f"{salt}:{ip}".encode("utf-8")).hexdigest()


def user_agent(request):
    return request.META.get("HTTP_USER_AGENT", "")[:255]


def visitor_id_from_request(request):
    raw = request.META.get(VISITOR_META_HEADER, "")
    try:
        return uuid.UUID(str(raw))
    except (TypeError, ValueError):
        return uuid.uuid4()


def should_track_visitor(request):
    if request.method == "OPTIONS":
        return False
    path = request.path or ""
    skipped_prefixes = (
        "/admin",
        "/static",
        "/media",
    )
    return not path.startswith(skipped_prefixes)


def authenticated_user(request):
    user = getattr(request, "user", None)
    if not user or isinstance(user, AnonymousUser) or not user.is_authenticated:
        return None
    return user


class VisitorTrackingMiddleware(MiddlewareMixin):
    def process_request(self, request):
        request._audit_started_at = time.monotonic()
        request._audit_context_token = set_current_request(request)
        if not should_track_visitor(request):
            return
        visitor_id = visitor_id_from_request(request)
        request._visitor_id = visitor_id
        try:
            request.visitor, _ = AnonymousVisitor.objects.update_or_create(
                id=visitor_id,
                defaults={
                    "user_agent": user_agent(request),
                    "ip_hash": hash_ip(client_ip(request)),
                },
            )
        except Exception:
            # 审计是旁路能力；SQLite 写锁或审计表异常不能把正常业务请求变成 500。
            request.visitor = None
            logger.exception("Failed to persist anonymous visitor")

    def process_response(self, request, response):
        visitor = getattr(request, "visitor", None)
        visitor_id = getattr(request, "_visitor_id", None)
        if visitor_id:
            response[VISITOR_HEADER] = str(visitor_id)

        if visitor and should_track_visitor(request):
            started_at = getattr(request, "_audit_started_at", None)
            duration_ms = 0
            if started_at is not None:
                duration_ms = max(int((time.monotonic() - started_at) * 1000), 0)
            try:
                VisitorEvent.objects.create(
                    visitor=visitor,
                    user=authenticated_user(request),
                    method=request.method,
                    path=(request.path or "")[:512],
                    status_code=getattr(response, "status_code", 0) or 0,
                    request_id=request_id(request),
                    duration_ms=duration_ms,
                )
            except Exception:
                # 响应已经由业务层生成；事件落库失败只记录诊断信息。
                logger.exception("Failed to persist visitor event")

        token = getattr(request, "_audit_context_token", None)
        if token is not None:
            reset_current_request(token)
        return response
