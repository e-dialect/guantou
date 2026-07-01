from utils.exceptions.types.bad_request import InvalidPassword


def validate_password_policy(password):
    if len(password) < 6 or len(password) > 32:
        raise InvalidPassword()
