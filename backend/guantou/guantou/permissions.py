from rest_framework import permissions


class IsOwnerOrAdmin(permissions.BasePermission):
    """
    对象级权限：
    - GET/HEAD/OPTIONS 不受限
    - PUT/PATCH/DELETE 仅允许资源创建者或 is_staff 用户操作

    支持的资源所有者字段：
    - Can.recorder
    - Nameplate.creator
    - Flavor.created_by
    """

    OWNER_FIELD_MAP = {
        "Can": "recorder",
        "Nameplate": "creator",
        "Flavor": "created_by",
    }

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True

        user = request.user
        if not (user and user.is_authenticated):
            return False

        if user.is_staff:
            return True

        model_name = obj.__class__.__name__
        owner_field = self.OWNER_FIELD_MAP.get(model_name)
        if owner_field:
            owner = getattr(obj, owner_field, None)
            return owner == user

        return False
