from django.db import transaction
from rest_framework import serializers

from . import services
from .fields import OwnedPrimaryKeyRelatedField
from .models import ApplicationActivity, Company, JobApplication, PipelineStage


class PipelineStageSerializer(serializers.ModelSerializer):
    """`order` is read-only: columns are arranged through the reorder endpoint, and a new
    stage is appended at the end. `user` is set by the view, never by the client."""

    class Meta:
        model = PipelineStage
        fields = ["id", "name", "order"]
        read_only_fields = ["id", "order"]

    def validate_name(self, value):
        value = value.strip()
        duplicates = PipelineStage.objects.filter(
            user=self.context["request"].user, name__iexact=value
        )
        if self.instance is not None:
            duplicates = duplicates.exclude(pk=self.instance.pk)
        if duplicates.exists():
            raise serializers.ValidationError("You already have a stage with this name.")
        return value


class StageReorderSerializer(serializers.Serializer):
    stage_ids = serializers.ListField(child=serializers.IntegerField(), allow_empty=False)


class CompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = ["id", "name", "website", "notes"]
        read_only_fields = ["id"]


class JobApplicationSerializer(serializers.ModelSerializer):
    """A card on the board.

    Writes: `listing_url` is required on create. Company is optional: send `company`
    (existing id or null) OR `company_name` (finds or creates a company), or neither.
    Reads: `company` is the id and `company_detail` the nested company (both null when
    there is no company), so the board
    can render a card (and its details panel) from one request.
    `stage` is chosen on create; afterwards cards change column only via the move endpoint.
    """

    company = OwnedPrimaryKeyRelatedField(
        queryset=Company.objects.all(), required=False, allow_null=True
    )
    company_name = serializers.CharField(write_only=True, required=False, max_length=200)
    company_detail = CompanySerializer(source="company", read_only=True)
    stage = OwnedPrimaryKeyRelatedField(queryset=PipelineStage.objects.all())

    class Meta:
        model = JobApplication
        fields = [
            "id",
            "company",
            "company_name",
            "company_detail",
            "stage",
            "job_title",
            "job_description",
            "listing_url",
            "date_applied",
            "position",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "position", "created_at", "updated_at"]

    def validate(self, attrs):
        has_id = "company" in attrs
        has_name = "company_name" in attrs
        if has_id and has_name:
            raise serializers.ValidationError(
                {"company": ["Send either `company` or `company_name`, not both."]}
            )
        if self.instance is None and not attrs.get("listing_url"):
            raise serializers.ValidationError({"listing_url": ["Paste the job listing link."]})
        if self.instance is not None and "stage" in attrs and attrs["stage"] != self.instance.stage:
            raise serializers.ValidationError(
                {"stage": ["Use the move endpoint to change an application's stage."]}
            )
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        user = self.context["request"].user
        name = validated_data.pop("company_name", None)
        if name is not None:
            validated_data["company"] = services.get_or_create_company(user, name)
        stage = validated_data.pop("stage")
        return services.create_application(user, stage, **validated_data)

    @transaction.atomic
    def update(self, instance, validated_data):
        user = self.context["request"].user
        validated_data.pop("stage", None)  # unchanged (validated above)
        name = validated_data.pop("company_name", None)
        if name is not None:
            validated_data["company"] = services.get_or_create_company(user, name)
        return super().update(instance, validated_data)


class ApplicationMoveSerializer(serializers.Serializer):
    stage = OwnedPrimaryKeyRelatedField(queryset=PipelineStage.objects.all())
    position = serializers.IntegerField(min_value=0)


class StageCountSerializer(serializers.Serializer):
    stage = serializers.IntegerField()
    name = serializers.CharField()
    order = serializers.IntegerField()
    count = serializers.IntegerField()


class WeekCountSerializer(serializers.Serializer):
    week_start = serializers.DateField(help_text="The Monday that starts the week.")
    count = serializers.IntegerField()


class ResponseRateSerializer(serializers.Serializer):
    baseline_stage = serializers.CharField(allow_null=True)
    responded = serializers.IntegerField()
    applied = serializers.IntegerField()
    rate = serializers.FloatField(
        allow_null=True,
        help_text="responded / applied, from 0 to 1. Null when nothing has been applied to yet.",
    )


class DashboardTotalsSerializer(serializers.Serializer):
    applications = serializers.IntegerField()
    applied = serializers.IntegerField(help_text="Applications that have a date applied.")


class DashboardSerializer(serializers.Serializer):
    totals = DashboardTotalsSerializer()
    stages = StageCountSerializer(many=True)
    weeks = WeekCountSerializer(many=True)
    response_rate = ResponseRateSerializer()


class ApplicationActivitySerializer(serializers.ModelSerializer):
    """`application` and the owner are fixed by the URL and the session, never by the body."""

    class Meta:
        model = ApplicationActivity
        fields = ["id", "application", "kind", "note", "occurred_at", "created_at"]
        read_only_fields = ["id", "application", "created_at"]
