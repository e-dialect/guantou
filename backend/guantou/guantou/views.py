from django.db import transaction
from django.db.models import (
    BooleanField,
    Case,
    Count,
    Exists,
    F,
    IntegerField,
    OuterRef,
    Q,
    Value,
    When,
)
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView
from utils.exceptions.types.bad_request import BadRequestException
from utils.exceptions.types.conflict import ConflictException

from .models import (
    Can,
    CanComment,
    CanLike,
    Dialect,
    Flavor,
    Nameplate,
    NameplateSupport,
    Package,
    Pronunciation,
    Shelf,
)
from .permissions import IsCommentAuthorOrAdmin, IsOwnerOrAdmin
from .serializers import (
    CanCardSerializer,
    CanCommentSerializer,
    CanSerializer,
    DialectSerializer,
    FlavorSerializer,
    NameplateCardSerializer,
    NameplateSerializer,
    PackageSerializer,
    PronunciationCardSerializer,
    PronunciationSerializer,
    ShelfSerializer,
)
from .services import (
    aggregate_search,
    elect_primary_nameplate,
    hot_search_terms,
    record_search,
    suggest_search,
    transition_can,
    visible_cans_for_user,
)


class CanWritePermission(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return bool(request.user and request.user.is_authenticated)


def truthy(value):
    return str(value).lower() in {"1", "true", "yes"}


def dialect_ids(value, scope):
    dialect = Dialect.objects.filter(id=value).first()
    if dialect is None:
        return []
    return dialect.descendant_ids() if scope == "subtree" else [dialect.id]


def expanded_dialect_ids(root_ids):
    ids = set()
    for dialect in Dialect.objects.filter(id__in=root_ids).prefetch_related("children"):
        ids.update(dialect.descendant_ids())
    return ids


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
        record_search(results["keyword"], request)
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
                "cans": CanCardSerializer(
                    results["cans"], many=True, context=context
                ).data,
            }
        )


class HotSearchView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response(hot_search_terms(request.query_params.get("limit")))


class SuggestSearchView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response(
            suggest_search(
                request.query_params.get("q", ""),
                user=request.user,
                limit=request.query_params.get("limit"),
            )
        )


class DialectViewSet(viewsets.ModelViewSet):
    http_method_names = ["get", "post", "put", "patch", "delete", "head", "options"]
    queryset = Dialect.objects.select_related("parent").prefetch_related("children")
    serializer_class = DialectSerializer
    permission_classes = [CanWritePermission]

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action == "list":
            parent_id = self.request.query_params.get("parent_id")
            queryset = (
                queryset.filter(parent__isnull=True)
                if parent_id is None
                else queryset.filter(parent_id=parent_id)
            )
        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) | Q(code__icontains=search)
            )
        return queryset.order_by("sort_order", "id")

    @action(detail=False, methods=["get"], permission_classes=[permissions.AllowAny])
    def resolve(self, request):
        qualified_code = request.query_params.get("qualified_code", "").strip()
        if not qualified_code:
            raise BadRequestException("qualified_code 不能为空")
        segments = qualified_code.split(".")
        node = Dialect.objects.filter(parent__isnull=True, code=segments[0]).first()
        for segment in segments[1:]:
            if node is None:
                break
            node = Dialect.objects.filter(parent=node, code=segment).first()
        if node is None:
            node = next(
                (
                    candidate
                    for candidate in Dialect.objects.all().iterator()
                    if qualified_code in (candidate.aliases or [])
                ),
                None,
            )
        if node is None:
            raise NotFound("方言限定码不存在")
        return Response(self.get_serializer(node).data)

    @action(
        detail=True,
        methods=["put", "delete"],
        permission_classes=[permissions.IsAuthenticated],
    )
    def follow(self, request, pk=None):
        dialect = self.get_object()
        info = request.user.user_info
        if request.method == "PUT":
            info.followed_dialects.add(dialect)
            following = True
        elif info.primary_dialect_id == dialect.id:
            info.followed_dialects.add(dialect)
            following = True
        else:
            info.followed_dialects.remove(dialect)
            following = False
        return Response({"dialect_id": dialect.id, "following": following})


class PackageViewSet(viewsets.ModelViewSet):
    http_method_names = ["get", "post", "patch", "head", "options"]
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
    http_method_names = ["get", "post", "patch", "head", "options"]
    queryset = Flavor.objects.prefetch_related(
        "packages", "flavorpackage_set__package", "pronunciations"
    )
    serializer_class = FlavorSerializer
    permission_classes = [IsOwnerOrAdmin]

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
        package_id = self.request.query_params.get("package_id")
        if package_id:
            queryset = queryset.filter(packages__id=package_id)
        dialect_id = self.request.query_params.get("dialect_id")
        if dialect_id:
            ids = dialect_ids(
                dialect_id, self.request.query_params.get("dialect_scope", "exact")
            )
            queryset = queryset.filter(pronunciations__dialect_id__in=ids).distinct()
        return queryset


class PronunciationViewSet(viewsets.ModelViewSet):
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    queryset = Pronunciation.objects.select_related(
        "package", "flavor", "dialect", "created_by"
    )
    serializer_class = PronunciationSerializer
    permission_classes = [IsOwnerOrAdmin]

    def get_serializer_class(self):
        if self.action == "list":
            return PronunciationCardSerializer
        return super().get_serializer_class()

    def get_queryset(self):
        queryset = super().get_queryset()
        for parameter in ("package_id", "flavor_id", "reading_type", "status"):
            value = self.request.query_params.get(parameter)
            if value:
                queryset = queryset.filter(**{parameter: value})
        dialect_id = self.request.query_params.get("dialect_id")
        if dialect_id:
            ids = dialect_ids(
                dialect_id, self.request.query_params.get("dialect_scope", "exact")
            )
            queryset = queryset.filter(dialect_id__in=ids)
        return queryset

    def destroy(self, request, *args, **kwargs):
        pronunciation = self.get_object()
        if (
            pronunciation.status == Pronunciation.Status.VERIFIED
            or pronunciation.attestations.exists()
        ):
            raise ConflictException("已认证或被铭牌引用的读音不能删除")
        return super().destroy(request, *args, **kwargs)

    @action(
        detail=True,
        methods=["post"],
        permission_classes=[permissions.IsAdminUser],
    )
    def transition(self, request, pk=None):
        transitions = {
            "verify": {
                Pronunciation.Status.DRAFT: Pronunciation.Status.VERIFIED,
                Pronunciation.Status.DISPUTED: Pronunciation.Status.VERIFIED,
            },
            "dispute": {
                Pronunciation.Status.DRAFT: Pronunciation.Status.DISPUTED,
                Pronunciation.Status.VERIFIED: Pronunciation.Status.DISPUTED,
            },
            "reject": {
                Pronunciation.Status.DRAFT: Pronunciation.Status.REJECTED,
                Pronunciation.Status.DISPUTED: Pronunciation.Status.REJECTED,
            },
            "restore": {Pronunciation.Status.REJECTED: Pronunciation.Status.DRAFT},
        }
        pronunciation = self.get_object()
        action_name = request.data.get("action", "")
        target = transitions.get(action_name, {}).get(pronunciation.status)
        if target is None:
            raise ConflictException("当前读音状态不允许该流转")
        with transaction.atomic():
            pronunciation = Pronunciation.objects.select_for_update().get(
                pk=pronunciation.pk
            )
            pronunciation.status = target
            canonical = (
                bool(request.data.get("is_canonical"))
                and target == Pronunciation.Status.VERIFIED
            )
            if canonical and not (
                pronunciation.source_citation
                or pronunciation.attestations.filter(
                    status=Nameplate.Status.ACTIVE
                ).exists()
            ):
                raise ConflictException("没有来源或录音证据的读音不能设为 canonical")
            if canonical:
                Pronunciation.objects.filter(
                    package=pronunciation.package,
                    flavor=pronunciation.flavor,
                    dialect=pronunciation.dialect,
                    reading_type=pronunciation.reading_type,
                    is_canonical=True,
                ).exclude(pk=pronunciation.pk).update(is_canonical=False)
            pronunciation.is_canonical = canonical
            pronunciation.save(update_fields=["status", "is_canonical", "updated_at"])
        return Response(self.get_serializer(pronunciation).data)


class CanViewSet(viewsets.ModelViewSet):
    http_method_names = ["get", "post", "put", "patch", "delete", "head", "options"]
    queryset = (
        Can.objects.select_related("recorder", "submitted_dialect", "verifier")
        .prefetch_related(
            "nameplates__package",
            "nameplates__flavor",
            "nameplates__dialect",
            "nameplates__pronunciation",
            "nameplates__creator",
        )
        .annotate(
            nameplate_count=Count(
                "nameplates",
                filter=Q(nameplates__status=Nameplate.Status.ACTIVE),
                distinct=True,
            ),
            like_count=Count("likes", distinct=True),
            comment_count=Count("comments", distinct=True),
        )
    )
    serializer_class = CanSerializer
    permission_classes = [IsOwnerOrAdmin]

    def get_serializer_class(self):
        return CanCardSerializer if self.action == "list" else CanSerializer

    def get_queryset(self):
        queryset = self.queryset
        user = self.request.user
        if user and user.is_authenticated:
            queryset = queryset.annotate(
                liked_by_me=Exists(
                    CanLike.objects.filter(can_id=OuterRef("pk"), user=user)
                )
            )
        else:
            queryset = queryset.annotate(
                liked_by_me=Value(False, output_field=BooleanField())
            )

        feed = self.request.query_params.get("feed", "")
        if feed in {"dialect", "following", "recommended"}:
            queryset = queryset.filter(visibility=True)
            if feed == "dialect":
                primary_id = (
                    user.user_info.primary_dialect_id
                    if user.is_authenticated and hasattr(user, "user_info")
                    else None
                )
                queryset = queryset.filter(
                    submitted_dialect_id__in=(
                        expanded_dialect_ids([primary_id]) if primary_id else []
                    )
                )
            elif feed == "following":
                if not user.is_authenticated or not hasattr(user, "user_info"):
                    queryset = queryset.none()
                else:
                    roots = user.user_info.followed_dialects.values_list(
                        "id", flat=True
                    )
                    followed_authors = user.following_relationships.values_list(
                        "followed_id", flat=True
                    )
                    queryset = queryset.filter(
                        Q(recorder_id__in=followed_authors)
                        | Q(submitted_dialect_id__in=expanded_dialect_ids(roots))
                    )
            else:
                roots = []
                if user.is_authenticated and hasattr(user, "user_info"):
                    roots = list(
                        user.user_info.followed_dialects.values_list("id", flat=True)
                    )
                    if user.user_info.primary_dialect_id:
                        roots.append(user.user_info.primary_dialect_id)
                preferred = expanded_dialect_ids(roots)
                if preferred:
                    queryset = queryset.annotate(
                        dialect_priority=Case(
                            When(submitted_dialect_id__in=preferred, then=Value(1)),
                            default=Value(0),
                            output_field=IntegerField(),
                        )
                    )
                else:
                    queryset = queryset.annotate(
                        dialect_priority=Value(0, output_field=IntegerField())
                    )
                queryset = queryset.order_by(
                    "-dialect_priority",
                    "-like_count",
                    "-views",
                    "-created_at",
                    "-id",
                )
        if not (user and user.is_authenticated and user.is_staff):
            if user and user.is_authenticated:
                queryset = queryset.filter(
                    Q(visibility=True) | Q(recorder=user) | Q(verifier=user)
                )
            else:
                queryset = queryset.filter(visibility=True)
        status_value = self.request.query_params.get("status")
        if status_value:
            queryset = queryset.filter(status=status_value)
        if truthy(self.request.query_params.get("needs_label")):
            queryset = queryset.filter(nameplate_count=0)
        submitted_dialect_id = self.request.query_params.get("submitted_dialect_id")
        if submitted_dialect_id:
            queryset = queryset.filter(submitted_dialect_id=submitted_dialect_id)
        dialect_id = self.request.query_params.get("dialect_id")
        if dialect_id:
            ids = dialect_ids(
                dialect_id, self.request.query_params.get("dialect_scope", "exact")
            )
            queryset = queryset.filter(
                nameplates__status=Nameplate.Status.ACTIVE,
                nameplates__dialect_id__in=ids,
            )
        flavor_id = self.request.query_params.get("flavor_id")
        if flavor_id:
            queryset = queryset.filter(
                nameplates__status=Nameplate.Status.ACTIVE,
                nameplates__flavor_id=flavor_id,
            )
        pronunciation_id = self.request.query_params.get("pronunciation_id")
        if pronunciation_id:
            queryset = queryset.filter(
                nameplates__status=Nameplate.Status.ACTIVE,
                nameplates__pronunciation_id=pronunciation_id,
            )
        if truthy(self.request.query_params.get("mine")) and user.is_authenticated:
            queryset = queryset.filter(recorder=user)
        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(concept_text__icontains=search)
                | Q(nameplates__text_content__icontains=search)
                | Q(nameplates__definition__icontains=search)
            )
        if feed == "recommended":
            return queryset.distinct()
        return queryset.distinct().order_by("-created_at", "-id")

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.views = F("views") + 1
        instance.save(update_fields=["views"])
        instance.refresh_from_db(fields=["views"])
        return Response(self.get_serializer(instance).data)

    @action(detail=False, methods=["get"], permission_classes=[permissions.AllowAny])
    def random(self, request):
        queryset = self.get_queryset().filter(visibility=True).order_by("?")
        instance = queryset.first()
        if instance is None:
            raise NotFound("暂无公开罐头")
        return Response(CanSerializer(instance, context={"request": request}).data)

    @action(
        detail=True,
        methods=["put", "delete"],
        permission_classes=[permissions.IsAuthenticated],
    )
    def like(self, request, pk=None):
        can = self.get_object()
        if not can.visibility:
            raise NotFound("罐头不存在")
        if request.method == "PUT":
            _, changed = CanLike.objects.get_or_create(can=can, user=request.user)
            liked = True
        else:
            deleted, _ = CanLike.objects.filter(can=can, user=request.user).delete()
            changed = bool(deleted)
            liked = False
        return Response(
            {
                "can_id": can.id,
                "liked": liked,
                "changed": changed,
                "like_count": CanLike.objects.filter(can=can).count(),
            }
        )

    @action(
        detail=True,
        methods=["post"],
        permission_classes=[permissions.IsAuthenticated],
    )
    def transition(self, request, pk=None):
        can = self.get_object()
        can = transition_can(
            can_id=can.id,
            user=request.user,
            action=request.data.get("action", ""),
            reason=request.data.get("reason", ""),
        )
        return Response(self.get_serializer(can).data)

    @action(detail=True, methods=["get"], permission_classes=[permissions.AllowAny])
    def nameplates(self, request, pk=None):
        can = self.get_object()
        queryset = can.nameplates.select_related(
            "can", "package", "flavor", "dialect", "pronunciation", "creator"
        )
        page = self.paginate_queryset(queryset)
        serializer = NameplateCardSerializer(
            page if page is not None else queryset,
            many=True,
            context={"request": request},
        )
        return (
            self.get_paginated_response(serializer.data)
            if page is not None
            else Response(serializer.data)
        )


class CanCommentViewSet(viewsets.ModelViewSet):
    http_method_names = ["get", "post", "delete", "head", "options"]
    serializer_class = CanCommentSerializer
    permission_classes = [IsCommentAuthorOrAdmin]

    def get_queryset(self):
        queryset = CanComment.objects.select_related(
            "author", "author__user_info", "can"
        ).filter(can__visibility=True)
        can_id = self.request.query_params.get("can_id")
        if self.action == "list":
            if not can_id:
                raise BadRequestException("can_id 不能为空")
            queryset = queryset.filter(can_id=can_id)
        return queryset

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)


class NameplateViewSet(viewsets.ModelViewSet):
    # PUT 仅供幂等的 /support/ action；实体更新按契约只接受 PATCH。
    http_method_names = [
        "get",
        "post",
        "put",
        "patch",
        "delete",
        "head",
        "options",
    ]
    queryset = Nameplate.objects.select_related(
        "can",
        "can__recorder",
        "package",
        "flavor",
        "dialect",
        "pronunciation",
        "creator",
        "supersedes",
    )
    serializer_class = NameplateSerializer
    permission_classes = [IsOwnerOrAdmin]

    def get_serializer_class(self):
        return NameplateCardSerializer if self.action == "list" else NameplateSerializer

    def update(self, request, *args, **kwargs):
        if request.method == "PUT":
            from rest_framework.exceptions import MethodNotAllowed

            raise MethodNotAllowed("PUT")
        return super().update(request, *args, **kwargs)

    def get_queryset(self):
        queryset = (
            super()
            .get_queryset()
            .filter(can__in=visible_cans_for_user(self.request.user))
        )
        for parameter in (
            "can_id",
            "package_id",
            "flavor_id",
            "pronunciation_id",
            "creator_id",
            "status",
        ):
            value = self.request.query_params.get(parameter)
            if value:
                queryset = queryset.filter(**{parameter: value})
        source_type = self.request.query_params.get("source_type")
        if source_type:
            queryset = queryset.filter(source__type=source_type)
        dialect_id = self.request.query_params.get("dialect_id")
        if dialect_id:
            ids = dialect_ids(
                dialect_id, self.request.query_params.get("dialect_scope", "exact")
            )
            queryset = queryset.filter(dialect_id__in=ids)
        if "is_primary" in self.request.query_params:
            queryset = queryset.filter(
                is_primary=truthy(self.request.query_params["is_primary"])
            )
        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(text_content__icontains=search)
                | Q(definition__icontains=search)
                | Q(pronunciation_text__icontains=search)
                | Q(source__title__icontains=search)
                | Q(source__attributed_to__icontains=search)
            )
        return queryset

    def perform_create(self, serializer):
        can = serializer.validated_data["can"]
        user = self.request.user
        if not (can.visibility or can.recorder_id == user.id or user.is_staff):
            raise NotFound("罐头不存在或不可见")
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        nameplate = self.get_object()
        can = nameplate.can
        physical_delete = (
            not can.visibility
            and not nameplate.is_primary
            and not nameplate.supports.exists()
            and not hasattr(nameplate, "superseded_by")
        )
        if physical_delete:
            nameplate.delete()
        else:
            nameplate.status = Nameplate.Status.WITHDRAWN
            nameplate.is_primary = False
            nameplate.save(update_fields=["status", "is_primary", "updated_at"])
            elect_primary_nameplate(can)
            pronunciation = nameplate.pronunciation
            if (
                pronunciation
                and pronunciation.is_canonical
                and not (
                    pronunciation.source_citation
                    or pronunciation.attestations.filter(
                        status=Nameplate.Status.ACTIVE
                    ).exists()
                )
            ):
                pronunciation.is_canonical = False
                pronunciation.save(update_fields=["is_canonical", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(
        detail=True,
        methods=["put", "delete"],
        permission_classes=[permissions.IsAuthenticated],
    )
    def support(self, request, pk=None):
        nameplate = self.get_object()
        if nameplate.status != Nameplate.Status.ACTIVE:
            raise ConflictException("只有 active 铭牌可以被支持")
        with transaction.atomic():
            nameplate = Nameplate.objects.select_for_update().get(pk=nameplate.pk)
            if request.method == "PUT":
                _, changed = NameplateSupport.objects.get_or_create(
                    nameplate=nameplate, user=request.user
                )
            else:
                deleted, _ = NameplateSupport.objects.filter(
                    nameplate=nameplate, user=request.user
                ).delete()
                changed = bool(deleted)
            if changed:
                nameplate.weight = nameplate.supports.count()
                nameplate.save(update_fields=["weight", "updated_at"])
            elect_primary_nameplate(nameplate.can)
        if request.method == "DELETE":
            return Response(status=status.HTTP_204_NO_CONTENT)
        nameplate.refresh_from_db()
        return Response(
            NameplateSerializer(nameplate, context={"request": request}).data
        )


class ShelfViewSet(viewsets.ModelViewSet):
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    queryset = Shelf.objects.prefetch_related("flavors", "cans")
    serializer_class = ShelfSerializer
    permission_classes = [IsOwnerOrAdmin]

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
