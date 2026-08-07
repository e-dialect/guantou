from rest_framework.exceptions import APIException


class ConflictException(APIException):
    status_code = 409
    default_detail = "资源状态或关联发生冲突"
    default_code = "conflict"

    def __init__(self, message=None, data=None):
        self.data = data or {}
        super().__init__(detail=message or self.default_detail, code=self.default_code)
