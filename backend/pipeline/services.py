from .models import DEFAULT_STAGE_NAMES, PipelineStage


def create_default_stages(user):
    """Give a new account the standard Kanban columns."""
    PipelineStage.objects.bulk_create(
        PipelineStage(user=user, name=name, order=index)
        for index, name in enumerate(DEFAULT_STAGE_NAMES)
    )
