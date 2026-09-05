from .common import CommonException


class ServiceUnavailableException(CommonException):
    def __init__(self, msg="服务暂不可用"):
        super().__init__()
        self.status = 503
        self.msg = msg

    def response(self, request=None):
        response = super().response(request)
        response.safe_public_error = True
        return response
