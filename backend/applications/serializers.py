from rest_framework import serializers

from .models import Application


class ApplicationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Application
        fields = [
            "id",
            "company",
            "job_title",
            "status",
            "job_url",
            "applied_date",
            "notes",
            "created_at",
            "updated_at",
        ]
