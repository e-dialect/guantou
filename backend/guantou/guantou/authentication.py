from rest_framework import authentication, exceptions

from user.tokens import get_authorization_token, token_user


class BearerTokenAuthentication(authentication.BaseAuthentication):
    """Authenticate DRF requests with the Authorization Bearer header."""

    def authenticate(self, request):
        token = get_authorization_token(request)
        if not token:
            return None
        try:
            user = token_user(token)
            request._request.user = user
            return (user, None)
        except Exception as exc:
            raise exceptions.AuthenticationFailed("Invalid token") from exc

    def authenticate_header(self, request):
        return "Bearer"
