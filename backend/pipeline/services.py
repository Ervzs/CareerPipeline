"""Business logic that spans several rows. Views stay thin; anything that must be atomic
lives here."""

from django.db import transaction
from django.db.models import Max
from rest_framework.exceptions import ValidationError

from .models import DEFAULT_STAGE_NAMES, PipelineStage


def create_default_stages(user):
    """Give a new account the standard Kanban columns."""
    PipelineStage.objects.bulk_create(
        PipelineStage(user=user, name=name, order=index)
        for index, name in enumerate(DEFAULT_STAGE_NAMES)
    )


def next_stage_order(user):
    """Order value that appends a stage after the user's last column."""
    highest = PipelineStage.objects.filter(user=user).aggregate(highest=Max("order"))["highest"]
    return 0 if highest is None else highest + 1


def resequence_stages(user):
    """Close gaps in stage order values (0..n-1) while keeping the current order."""
    stages = list(PipelineStage.objects.filter(user=user).order_by("order", "id"))
    for index, stage in enumerate(stages):
        stage.order = index
    PipelineStage.objects.bulk_update(stages, ["order"])


@transaction.atomic
def reorder_stages(user, stage_ids):
    """Apply a new left-to-right order. `stage_ids` must be exactly the user's stages."""
    stages = {s.id: s for s in PipelineStage.objects.select_for_update().filter(user=user)}
    if len(stage_ids) != len(set(stage_ids)):
        raise ValidationError({"stage_ids": ["Duplicate stage ids are not allowed."]})
    if set(stage_ids) != set(stages):
        raise ValidationError(
            {"stage_ids": ["The list must contain exactly all of your stage ids."]}
        )
    ordered = []
    for index, stage_id in enumerate(stage_ids):
        stages[stage_id].order = index
        ordered.append(stages[stage_id])
    PipelineStage.objects.bulk_update(ordered, ["order"])
    return ordered
