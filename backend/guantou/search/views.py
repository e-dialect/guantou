from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from guantou.serializers import CanSerializer, FlavorSerializer, PackageSerializer

from .services import aggregate_search, result_limit


class AggregateSearchView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        keyword = request.query_params.get("q") or request.query_params.get(
            "search", ""
        )
        limit = result_limit(request.query_params.get("limit"))
        results = aggregate_search(keyword, request.user, limit)
        context = {"request": request}
        return Response(
            {
                "keyword": results["keyword"],
                "flavors": FlavorSerializer(
                    results["flavors"], many=True, context=context
                ).data,
                "packages": PackageSerializer(
                    results["packages"], many=True, context=context
                ).data,
                "cans": CanSerializer(results["cans"], many=True, context=context).data,
            }
        )
