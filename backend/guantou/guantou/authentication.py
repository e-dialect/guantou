from rest_framework import authentication, exceptions

from user.tokens import token_user


class HeaderTokenAuthentication(authentication.BaseAuthentication):
    """Authenticate DRF requests with the legacy `token` header."""

    def authenticate(self, request):
        token = request.headers.get("token")
        if not token:
            return None
        try:
            return (token_user(token), None)
        except Exception as exc:
            raise exceptions.AuthenticationFailed("Invalid token") from exc
