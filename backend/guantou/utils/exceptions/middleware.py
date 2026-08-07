import logging
import json

from django.core.paginator import EmptyPage
from django.http import JsonResponse
from django.middleware.common import MiddlewareMixin

from .payload import api_error_payload, request_id
from .types.common import CommonException
from .types.bad_request import BadRequestException

logger = logging.getLogger("log")


class ExceptionMiddleware(MiddlewareMixin):
    """统一异常处理中间件"""

    def process_request(self, request):
        request_id(request)

    def process_response(self, request, response):
        rid = request_id(request)
        if rid:
            response["X-Request-ID"] = rid
        if response.status_code >= 400 and not hasattr(response, "data"):
            content_type = response.get("Content-Type", "")
            if "application/json" in content_type:
                try:
                    payload = json.loads(response.content.decode(response.charset))
                except (ValueError, UnicodeDecodeError):
                    payload = {}
                if isinstance(payload, dict) and not (
                    payload.get("code") == response.status_code
                    and set(("message", "data", "request_id")).issubset(payload)
                ):
                    message = (
                        payload.get("message")
                        or payload.get("msg")
                        or payload.get("detail")
                        or response.reason_phrase
                    )
                    extra = {
                        key: value
                        for key, value in payload.items()
                        if key not in {"message", "msg", "detail", "code", "request_id"}
                    }
                    data = {"fields": extra} if extra else {}
                    response.content = json.dumps(
                        api_error_payload(
                            message, response.status_code, data=data, rid=rid
                        ),
                        ensure_ascii=False,
                    ).encode(response.charset)
        return response

    def process_exception(self, request, exception) -> JsonResponse:
        """
        统一异常处理
        :param request: 请求对象
        :param exception: 异常对象
        :return:
        """
        if isinstance(exception, EmptyPage):
            return BadRequestException(str(exception)).response(request)
        if isinstance(exception, KeyError):
            return BadRequestException("缺少必要参数").response(request)
        if isinstance(exception, ValueError):
            return BadRequestException("参数值异常").response(request)
        if isinstance(exception, CommonException):
            return exception.response(request)
        logger.exception("Unhandled request exception")
        return CommonException(exception).response(request)
