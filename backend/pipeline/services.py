"""Business logic that spans several rows. Views stay thin; anything that must be atomic
lives here."""

from django.db import transaction
from django.db.models import Max
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .models import DEFAULT_STAGE_NAMES, Company, JobApplication, PipelineStage


def create_default_stages(user):
    """Give a new account the standard Kanban columns."""
    PipelineStage.objects.bulk_create(
        PipelineStage(user=user, name=name, order=index)
        for index, name in enumerate(DEFAULT_STAGE_NAMES)
    )


# --- stages -----------------------------------------------------------------
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


# --- companies --------------------------------------------------------------
def get_or_create_company(user, name):
    """Reuse the user's company with this name (case-insensitive), else create it."""
    name = name.strip()
    company = Company.objects.filter(user=user, name__iexact=name).first()
    return company or Company.objects.create(user=user, name=name)


# --- applications -----------------------------------------------------------
@transaction.atomic
def create_application(user, stage, **fields):
    """Create a card at the bottom of its column."""
    PipelineStage.objects.select_for_update().get(pk=stage.pk)  # serialise appends per column
    position = JobApplication.objects.filter(stage=stage).count()
    return JobApplication.objects.create(user=user, stage=stage, position=position, **fields)


def resequence_column(stage_id):
    """Make positions in one column contiguous (0..n-1), keeping the current order."""
    cards = list(JobApplication.objects.filter(stage_id=stage_id).order_by("position", "id"))
    for index, card in enumerate(cards):
        card.position = index
    JobApplication.objects.bulk_update(cards, ["position"])


@transaction.atomic
def move_application(application, target_stage, position):
    """Move a card to `position` (zero-based, clamped) in `target_stage`.

    Both the source and target columns are locked and re-sequenced so positions stay
    contiguous. The caller must have verified that both objects belong to the same user.
    """
    columns = {application.stage_id, target_stage.id}
    cards = list(
        JobApplication.objects.select_for_update()
        .filter(stage_id__in=columns)
        .order_by("position", "id")
    )
    moved = next(card for card in cards if card.pk == application.pk)
    source_id = moved.stage_id

    target = [c for c in cards if c.stage_id == target_stage.id and c.pk != moved.pk]
    position = max(0, min(position, len(target)))
    target.insert(position, moved)
    moved.stage_id = target_stage.id
    moved.updated_at = timezone.now()

    changed = list(target)
    if source_id != target_stage.id:
        source = [c for c in cards if c.stage_id == source_id and c.pk != moved.pk]
        changed += source
        for index, card in enumerate(source):
            card.position = index
    for index, card in enumerate(target):
        card.position = index

    JobApplication.objects.bulk_update(changed, ["stage", "position", "updated_at"])
    return moved
