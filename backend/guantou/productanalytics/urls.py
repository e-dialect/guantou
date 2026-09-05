from django.urls import path

from .views import ProductEventView

app_name = "productanalytics"

urlpatterns = [
    path("product-events/", ProductEventView.as_view(), name="product-events"),
]
