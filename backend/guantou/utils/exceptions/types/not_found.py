from .common import CommonException


class NotFoundException(CommonException):
    """
    资源不存在异常
    """

    def __init__(self, msg="资源不存在！"):
        super().__init__()
        self.status = 404
        self.msg = msg


class UserNotFoundException(NotFoundException):
    """
    用户不存在异常
    :param id: 用户id
    """

    def __init__(self, id=0):
        super().__init__()
        self.msg = "用户{}不存在！".format(id)


class AnnouncementNotFoundException(NotFoundException):
    """公告不存在异常。"""

    def __init__(self, id=""):
        super().__init__()
        self.status = 404
        self.msg = "公告{}不存在！".format(id)


class NotBoundWechat(NotFoundException):
    """
    微信未绑定异常
    """

    def __init__(self, username=""):
        super().__init__()
        self.status = 404
        self.msg = "账户 {}微信未绑定".format(username)


class NotBoundEmail(NotFoundException):
    """
    邮箱未绑定异常
    """

    def __init__(self, username=""):
        super().__init__()
        self.status = 404
        self.msg = "该账号尚未绑定邮箱，请先绑定邮箱后再找回密码"
