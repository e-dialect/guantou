import demjson3
from django.contrib.auth import authenticate
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from user.dto.user_all import user_all
from user.passwords import validate_password_policy
from user.tokens import generate_token, get_authorization_token, token_check
from user.avatar import upload_avatar
from user.verification import check_email_code
from .forms import UserForm
from .models import UserInfo, User


# for '/users/'
@csrf_exempt
def router_users(request):
    try:
        # US0202 批量获取用户信息
        if request.method == "GET":
            result = User.objects.all()
            if "email" in request.GET:
                result = result.filter(email=request.GET["email"])
            if "username" in request.GET:
                result = result.filter(username=request.GET["username"])
            users = []
            for user in result:
                users.append(user_all(user))
            return JsonResponse({"users": users}, status=200)

        # US0101 新建用户
        elif request.method == "POST":
            body = demjson3.decode(request.body)
            user_form = UserForm(body)
            code = body["code"]
            if user_form.is_valid():
                if check_email_code(user_form.cleaned_data["email"], code):
                    user = user_form.save(commit=False)
                    validate_password_policy(user_form.cleaned_data["password"])
                    user.set_password(user_form.cleaned_data["password"])
                    user.save()
                    user_info = UserInfo.objects.create(
                        user=user, nickname=user.username
                    )
                    if "nickname" in body:
                        user_info.nickname = body["nickname"]
                    if "avatar" in body:
                        user_info.avatar = upload_avatar(
                            user.id, body["avatar"], suffix="png"
                        )
                    user_info.save()
                    return JsonResponse({"id": user.id}, status=200)
                else:
                    return JsonResponse({}, status=401)
            else:
                if user_form["username"].errors:
                    return JsonResponse({}, status=409)
                else:
                    return JsonResponse({}, status=400)
    except Exception as e:
        return JsonResponse({"msg": str(e)}, status=500)


@csrf_exempt
def login(request):
    try:
        if request.method == "POST":
            body = demjson3.decode(request.body)
            username = body["username"]
            password = body["password"]
            user = authenticate(username=username, password=password)
            if user:
                user.last_login = timezone.now()
                # 超级管理员初始状况下没有 userinfo 字段
                if not hasattr(user, "user_info"):
                    user.userinfo = UserInfo.objects.create(
                        user=user, nickname=user.username
                    )
                user.save()
                return JsonResponse(
                    {"token": generate_token(user), "id": user.id}, status=200
                )
            else:
                return JsonResponse({}, status=401)
        elif request.method == "PUT":
            token = get_authorization_token(request)
            if not token:
                return JsonResponse({}, status=401)
            user = token_check(token)
            if user:
                return JsonResponse(
                    {"token": generate_token(user), "id": user.id}, status=200
                )
            else:
                return JsonResponse({}, status=401)
    except Exception as e:
        return JsonResponse({"msg": str(e)}, status=500)


@csrf_exempt
def app(request):
    pass
