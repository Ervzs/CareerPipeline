from django.db.models import ProtectedError
from drf_spectacular.utils import extend_schema
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from config.exceptions import Conflict

from . import services
from .models import Company, JobApplication, PipelineStage
from .serializers import (
    ApplicationMoveSerializer,
    CompanySerializer,
    JobApplicationSerializer,
    PipelineStageSerializer,
    StageReorderSerializer,
)


class PipelineStageViewSet(viewsets.ModelViewSet):
    serializer_class = PipelineStageSerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):  # schema generation has no user
            return PipelineStage.objects.none()
        # Tenant isolation: every query is scoped to the caller.
        return PipelineStage.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        user = self.request.user
        serializer.save(user=user, order=services.next_stage_order(user))

    def perform_destroy(self, instance):
        try:
            instance.delete()
        except ProtectedError as exc:
            raise Conflict(
                "This stage still contains applications. Move them to another stage first.",
                code="stage_not_empty",
            ) from exc
        services.resequence_stages(self.request.user)

    @extend_schema(request=StageReorderSerializer, responses=PipelineStageSerializer(many=True))
    @action(detail=False, methods=["post"])
    def reorder(self, request):
        """Set the left-to-right order. Send every stage id exactly once."""
        serializer = StageReorderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        stages = services.reorder_stages(request.user, serializer.validated_data["stage_ids"])
        return Response(PipelineStageSerializer(stages, many=True).data)


class CompanyViewSet(viewsets.ModelViewSet):
    serializer_class = CompanySerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Company.objects.none()
        return Company.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def perform_destroy(self, instance):
        try:
            instance.delete()
        except ProtectedError as exc:
            raise Conflict(
                "This company still has applications. Delete or reassign them first.",
                code="company_in_use",
            ) from exc


class JobApplicationViewSet(viewsets.ModelViewSet):
    """Kanban data: the list is ordered by column, then by position inside the column."""

    serializer_class = JobApplicationSerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return JobApplication.objects.none()
        return (
            JobApplication.objects.filter(user=self.request.user)
            .select_related("company", "stage")
            .order_by("stage__order", "position", "id")
        )

    def perform_destroy(self, instance):
        stage_id = instance.stage_id
        instance.delete()
        services.resequence_column(stage_id)

    @extend_schema(request=ApplicationMoveSerializer, responses=JobApplicationSerializer)
    @action(detail=True, methods=["patch"])
    def move(self, request, pk=None):
        """Move a card to a stage and zero-based position; both columns are re-sequenced."""
        application = self.get_object()
        serializer = ApplicationMoveSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        services.move_application(
            application, serializer.validated_data["stage"], serializer.validated_data["position"]
        )
        return Response(self.get_serializer(self.get_queryset().get(pk=application.pk)).data)
