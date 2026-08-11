from django import forms

from .models import User, UserInfo


class UserInfoForm(forms.ModelForm):
    class Meta:
        model = UserInfo
        fields = (
            "nickname",
            "birthday",
            "telephone",
            "avatar",
            "primary_dialect",
        )


class UserForm(forms.ModelForm):
    class Meta:
        model = User
        fields = ("username", "password", "email")

    def clean_email(self):
        return str(self.cleaned_data["email"]).strip().lower()


class UserFormByWechat(forms.ModelForm):
    class Meta:
        model = User
        fields = ("username",)
