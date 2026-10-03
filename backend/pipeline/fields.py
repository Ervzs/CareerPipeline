from rest_framework import serializers


class OwnedPrimaryKeyRelatedField(serializers.PrimaryKeyRelatedField):
    """A foreign-key field that only accepts objects owned by the requesting user.

    Another user's id fails with the same "object does not exist" error as a missing
    id, so nothing about other tenants' data is revealed or can be attached.
    """

    def get_queryset(self):
        queryset = super().get_queryset()
        request = self.context.get("request")
        if request is None or not request.user.is_authenticated:
            return queryset.none()
        return queryset.filter(user=request.user)
