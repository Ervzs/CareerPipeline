from django.db.models import ProtectedError
from drf_spectacular.utils import extend_schema
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from config.exceptions import Conflict

from . import services
from .models import PipelineStage
from .serializers import PipelineStageSerializer, StageReorderSerializer


class PipelineStageViewSet(viewsets.ModelViewSet):
    serializer_class = PipelineStageSerializer

    def get_queryset(self):
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
