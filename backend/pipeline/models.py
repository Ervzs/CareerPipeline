from django.conf import settings
from django.db import models
from django.utils import timezone

DEFAULT_STAGE_NAMES = ["Wishlist", "Applied", "Interviewing", "Offer", "Rejected"]


class PipelineStage(models.Model):
    """A column on the Kanban board. Each user owns an ordered list of stages."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="stages"
    )
    name = models.CharField(max_length=100)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order"]
        constraints = [
            models.UniqueConstraint(fields=["user", "name"], name="unique_stage_name_per_user"),
        ]

    def __str__(self):
        return self.name


class Company(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="companies"
    )
    name = models.CharField(max_length=200)
    website = models.URLField(blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "companies"

    def __str__(self):
        return self.name


class JobApplication(models.Model):
    """A card on the board. `position` is its zero-based order inside its stage column."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="applications"
    )
    # PROTECT: a company/stage that still has applications cannot be deleted.
    # Company is optional: many postings hide who is hiring.
    company = models.ForeignKey(
        Company, on_delete=models.PROTECT, related_name="applications", null=True, blank=True
    )
    stage = models.ForeignKey(PipelineStage, on_delete=models.PROTECT, related_name="applications")
    job_title = models.CharField(max_length=200)
    job_description = models.TextField(blank=True)
    listing_url = models.URLField(max_length=500, blank=True)
    date_applied = models.DateField(null=True, blank=True)
    position = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["stage__order", "position"]

    def __str__(self):
        return f"{self.job_title} @ {self.company}" if self.company else self.job_title


class ApplicationActivity(models.Model):
    """A dated note on an application: a call, an interview, a follow-up...

    Notes only make sense next to their application, so they are deleted with it.
    `user` is the multi-tenancy key like on every other record; it always equals the
    application's owner.
    """

    class Kind(models.TextChoices):
        CALL = "call", "Call"
        INTERVIEW = "interview", "Interview"
        FOLLOW_UP = "follow_up", "Follow-up"
        OTHER = "other", "Other"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="activities"
    )
    application = models.ForeignKey(
        JobApplication, on_delete=models.CASCADE, related_name="activities"
    )
    kind = models.CharField(max_length=20, choices=Kind.choices, default=Kind.OTHER)
    note = models.TextField()
    occurred_at = models.DateTimeField(default=timezone.now)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-occurred_at", "-id"]
        verbose_name_plural = "application activities"

    def __str__(self):
        return f"{self.get_kind_display()} on {self.application}"
