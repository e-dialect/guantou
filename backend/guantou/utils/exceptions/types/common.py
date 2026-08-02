from django.http import JsonResponse

from utils.exceptions.payload import api_error_payload, request_id


class CommonException(Exception):
    """
    公共异常类
    """

    def __init__(self, exception: Exception = None):
        super().__init__()
        self.status = 500
        self.msg = str(exception if exception else "服务器内部错误")

    def __str__(self):
        return self.msg

    def response(self, request=None):
        rid = request_id(request) if request else ""
        return JsonResponse(
            api_error_payload(self.msg, self.status, rid=rid),
            status=self.status,
        )
