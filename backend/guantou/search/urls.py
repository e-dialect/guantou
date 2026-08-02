from django.urls import path

from .views import AggregateSearchView

app_name = "search"

urlpatterns = [
    path("", AggregateSearchView.as_view(), name="aggregate"),
]
