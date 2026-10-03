from rest_framework import serializers

from .models import Company, PipelineStage


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
