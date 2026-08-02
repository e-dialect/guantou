from django.db import transaction
from django.db.models import F, Q
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    Can,
    Dialect,
    Flavor,
    FlavorVariant,
    Nameplate,
    NameplateSupport,
    Package,
    Shelf,
)
from .services import aggregate_search
from .serializers import (
    CanSerializer,
    DialectSerializer,
    FlavorSerializer,
    FlavorVariantSerializer,
    NameplateSerializer,
    PackageSerializer,
    ShelfSerializer,
)


class CanWritePermission(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return bool(request.user and request.user.is_authenticated)


class AggregateSearchView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        keyword = request.query_params.get("q") or request.query_params.get(
            "search", ""
        )
        results = aggregate_search(
            keyword,
            user=request.user,
            limit=request.query_params.get("limit"),
        )
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


class DialectViewSet(viewsets.ModelViewSet):
    queryset = Dialect.objects.all()
    serializer_class = DialectSerializer
    permission_classes = [CanWritePermission]
    search_fields = ["name", "code", "province", "city", "county", "town"]

    def get_queryset(self):
        queryset = super().get_queryset()
        parent = self.request.query_params.get("parent")
        if parent is not None:
            if parent == "null":
                queryset = queryset.filter(parent__isnull=True)
            else:
                queryset = queryset.filter(parent_id=parent)
        return queryset


class PackageViewSet(viewsets.ModelViewSet):
    queryset = Package.objects.prefetch_related("flavors")
    serializer_class = PackageSerializer
    permission_classes = [CanWritePermission]

    def get_queryset(self):
        queryset = super().get_queryset()
        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(text__icontains=search)
        package_type = self.request.query_params.get("package_type")
        if package_type:
            queryset = queryset.filter(package_type=package_type)
        return queryset


class FlavorViewSet(viewsets.ModelViewSet):
    queryset = Flavor.objects.prefetch_related("packages", "variants")
    serializer_class = FlavorSerializer
    permission_classes = [CanWritePermission]

    def get_queryset(self):
        queryset = super().get_queryset()
        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search)
                | Q(definition__icontains=search)
                | Q(mandarin__icontains=search)
                | Q(packages__text__icontains=search)
            ).distinct()
        package = self.request.query_params.get("package")
        if package:
            queryset = queryset.filter(packages__id=package)
        dialect = self.request.query_params.get("dialect")
        if dialect:
            dialect_obj = Dialect.objects.filter(id=dialect).first()
            if dialect_obj:
                queryset = queryset.filter(
                    variants__dialect_id__in=dialect_obj.descendant_ids()
                ).distinct()
        return queryset


class FlavorVariantViewSet(viewsets.ModelViewSet):
    queryset = FlavorVariant.objects.select_related("flavor", "dialect", "created_by")
    serializer_class = FlavorVariantSerializer
    permission_classes = [CanWritePermission]

    def get_queryset(self):
        queryset = super().get_queryset()
        flavor = self.request.query_params.get("flavor")
        if flavor:
            queryset = queryset.filter(flavor_id=flavor)
        dialect = self.request.query_params.get("dialect")
        if dialect:
            dialect_obj = Dialect.objects.filter(id=dialect).first()
            if dialect_obj:
                queryset = queryset.filter(dialect_id__in=dialect_obj.descendant_ids())
        status_value = self.request.query_params.get("status")
        if status_value:
            queryset = queryset.filter(status=status_value)
        return queryset


class CanViewSet(viewsets.ModelViewSet):
    queryset = Can.objects.select_related(
        "recorder", "dialect", "flavor_variant", "verifier"
    ).prefetch_related("nameplates")
    serializer_class = CanSerializer
    permission_classes = [CanWritePermission]

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if not (user and user.is_authenticated and user.is_staff):
            if user and user.is_authenticated:
                queryset = queryset.filter(Q(visibility=True) | Q(recorder=user))
            else:
                queryset = queryset.filter(visibility=True)
        status_value = self.request.query_params.get("status")
        if status_value:
            queryset = queryset.filter(status=status_value)
        needs_label = self.request.query_params.get("needs_label")
        if needs_label == "true":
            queryset = queryset.filter(nameplates__isnull=True)
        dialect = self.request.query_params.get("dialect")
        if dialect:
            dialect_obj = Dialect.objects.filter(id=dialect).first()
            if dialect_obj:
                queryset = queryset.filter(dialect_id__in=dialect_obj.descendant_ids())
        flavor = self.request.query_params.get("flavor")
        if flavor:
            queryset = queryset.filter(
                Q(flavor_variant__flavor_id=flavor) | Q(nameplates__flavor_id=flavor)
            ).distinct()
        mine = self.request.query_params.get("mine")
        if mine == "true" and user and user.is_authenticated:
            queryset = queryset.filter(recorder=user)
        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(concept_text__icontains=search)
                | Q(nameplates__text_content__icontains=search)
                | Q(nameplates__definition__icontains=search)
            ).distinct()
        return queryset

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.views = instance.views + 1
        instance.save(update_fields=["views", "updated_at"])
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    @action(detail=True, methods=["get", "post"], url_path="nameplates")
    def nameplates(self, request, pk=None):
        can = self.get_object()
        if request.method == "GET":
            serializer = NameplateSerializer(
                can.nameplates.all(), many=True, context={"request": request}
            )
            return Response(serializer.data)
        serializer = NameplateSerializer(
            data={**request.data, "can": can.id}, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class NameplateViewSet(viewsets.ModelViewSet):
    queryset = Nameplate.objects.select_related("can", "flavor", "package", "creator")
    serializer_class = NameplateSerializer
    permission_classes = [CanWritePermission]

    def get_queryset(self):
        queryset = super().get_queryset()
        can = self.request.query_params.get("can")
        if can:
            queryset = queryset.filter(can_id=can)
        flavor = self.request.query_params.get("flavor")
        if flavor:
            queryset = queryset.filter(flavor_id=flavor)
        package = self.request.query_params.get("package")
        if package:
            queryset = queryset.filter(package_id=package)
        return queryset

    @action(detail=True, methods=["post"])
    def vote(self, request, pk=None):
        nameplate = self.get_object()
        with transaction.atomic():
            _, created = NameplateSupport.objects.get_or_create(
                nameplate=nameplate, user=request.user
            )
            if created:
                Nameplate.objects.filter(id=nameplate.id).update(weight=F("weight") + 1)
                nameplate.refresh_from_db()
        strongest = nameplate.can.nameplates.order_by("-weight", "id").first()
        if strongest:
            strongest.promote_to_primary()
        serializer = NameplateSerializer(
            strongest or nameplate, context={"request": request}
        )
        return Response(serializer.data)


class ShelfViewSet(viewsets.ModelViewSet):
    queryset = Shelf.objects.prefetch_related("flavors", "cans")
    serializer_class = ShelfSerializer
    permission_classes = [CanWritePermission]

    def get_queryset(self):
        queryset = super().get_queryset()
        shelf_type = self.request.query_params.get("shelf_type")
        if shelf_type:
            queryset = queryset.filter(shelf_type=shelf_type)
        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) | Q(description__icontains=search)
            )
        return queryset
