from django.conf import settings
from django.db import models


class Application(models.Model):
    class Status(models.TextChoices):
        INTERESTED = "interested"
        APPLIED = "applied"
        INTERVIEW = "interview"
        OFFER = "offer"
        REJECTED = "rejected"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="applications"
    )
    company = models.CharField(max_length=200)
    job_title = models.CharField(max_length=200)
    status = models.CharField(max_length=20, choices=Status, default=Status.INTERESTED)
    job_url = models.URLField(blank=True)
    applied_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.company} — {self.job_title}"
