import pytest
from django.urls import path
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import NotFound
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from config.exceptions import Conflict


class _Payload(serializers.Serializer):
    name = serializers.CharField()


@api_view(["POST"])
@permission_classes([AllowAny])
def _invalid(request):
    _Payload(data=request.data).is_valid(raise_exception=True)
    return Response()


@api_view(["GET"])
@permission_classes([AllowAny])
def _missing(request):
    raise NotFound("Nothing here.")


@api_view(["GET"])
@permission_classes([AllowAny])
def _conflict(request):
    raise Conflict("Still in use.")


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def _private(request):
    return Response()


urlpatterns = [
    path("invalid/", _invalid),
    path("missing/", _missing),
    path("conflict/", _conflict),
    path("private/", _private),
]


@pytest.mark.urls("tests.test_errors")
@pytest.mark.parametrize(
    ("method", "url", "status", "code"),
    [
        ("post", "/invalid/", 400, "validation_error"),
        ("get", "/missing/", 404, "not_found"),
        ("get", "/conflict/", 409, "conflict"),
        ("get", "/private/", 401, "not_authenticated"),
    ],
)
def test_errors_use_one_envelope(api_client, method, url, status, code):
    response = getattr(api_client, method)(url, {}, format="json")
    assert response.status_code == status
    error = response.json()["error"]
    assert set(error) == {"code", "message", "details"}
    assert error["code"] == code
    assert error["message"]
