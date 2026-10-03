"""Numbers for the dashboard, computed with database aggregations (three queries in total,
however many applications the user has)."""

from datetime import timedelta

from django.db.models import Count, Q
from django.db.models.functions import TruncWeek
from django.utils import timezone

from .models import JobApplication, PipelineStage

WEEKS_SHOWN = 12
BASELINE_STAGE_NAME = "applied"


def monday_of(day):
    return day - timedelta(days=day.weekday())


def build_dashboard(user, today=None):
    """Applications per stage, per week, and the response rate for one user.

    Response rate = applications with a date applied that now sit in a stage *after* the
    "Applied" stage, divided by all applications with a date applied. The baseline stage is
    found by name (case-insensitive); if the user renamed or removed it, the second column
    stands in. With no baseline or nothing applied yet the rate is None, never a division by zero.
    """
    today = today or timezone.localdate()

    stages = list(
        PipelineStage.objects.filter(user=user)
        .annotate(count=Count("applications"))
        .order_by("order")
    )

    first_week = monday_of(today) - timedelta(weeks=WEEKS_SHOWN - 1)
    weekly = dict(
        JobApplication.objects.filter(user=user, date_applied__gte=first_week)
        .annotate(week=TruncWeek("date_applied"))
        # order_by() clears the model's default ordering, which would otherwise split the groups.
        .order_by()
        .values_list("week")
        .annotate(count=Count("id"))
    )
    weeks = [
        {"week_start": start, "count": weekly.get(start, 0)}
        for start in (first_week + timedelta(weeks=i) for i in range(WEEKS_SHOWN))
    ]

    baseline = next((s for s in stages if s.name.lower() == BASELINE_STAGE_NAME), None)
    if baseline is None and len(stages) > 1:
        baseline = stages[1]

    applied_filter = Q(date_applied__isnull=False)
    aggregates = {"applied": Count("id", filter=applied_filter)}
    if baseline:
        aggregates["responded"] = Count(
            "id", filter=applied_filter & Q(stage__order__gt=baseline.order)
        )
    counts = JobApplication.objects.filter(user=user).aggregate(**aggregates)
    applied, responded = counts["applied"], counts.get("responded", 0)

    return {
        "totals": {"applications": sum(s.count for s in stages), "applied": applied},
        "stages": [
            {"stage": s.id, "name": s.name, "order": s.order, "count": s.count} for s in stages
        ],
        "weeks": weeks,
        "response_rate": {
            "baseline_stage": baseline.name if baseline else None,
            "responded": responded,
            "applied": applied,
            "rate": round(responded / applied, 4) if baseline and applied else None,
        },
    }
