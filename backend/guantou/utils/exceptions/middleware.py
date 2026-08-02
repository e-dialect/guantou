import logging

from django.core.paginator import EmptyPage
from django.http import JsonResponse
from django.middleware.common import MiddlewareMixin

from .payload import request_id
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
