"""One consistent error envelope for every API error:

{"error": {"code": "...", "message": "...", "details": {...}}}
"""

from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.http import Http404
from rest_framework import status
from rest_framework.exceptions import (
    APIException,
    NotFound,
    PermissionDenied,
    ValidationError,
)
from rest_framework.views import exception_handler


class Conflict(APIException):
    """409: the request is valid but blocked by the current state of the data."""

    status_code = status.HTTP_409_CONFLICT
    default_detail = "The request conflicts with the current state of the resource."
    default_code = "conflict"


def _first_message(details):
    """Pull a readable message out of DRF's nested error structures."""
    if isinstance(details, dict):
        return _first_message(next(iter(details.values()), ""))
    if isinstance(details, list):
        return _first_message(details[0]) if details else ""
    return str(details)


def api_exception_handler(exc, context):
    # DRF converts Django's Http404/PermissionDenied internally; do the same here so we
    # can read a proper `default_code` from them.
    if isinstance(exc, Http404):
        exc = NotFound()
    elif isinstance(exc, DjangoPermissionDenied):
        exc = PermissionDenied()

    response = exception_handler(exc, context)
    if response is None:
        return None

    if isinstance(exc, ValidationError):
        code = "validation_error"
        details = response.data
        message = "Invalid input." if isinstance(details, dict) else _first_message(details)
        if not isinstance(details, dict):
            details = {"non_field_errors": details}
    else:
        # ErrorDetail carries the specific code (e.g. "stage_not_empty"); else the class default.
        code = getattr(getattr(exc, "detail", None), "code", None) or exc.default_code
        message = _first_message(response.data)
        details = {}

    response.data = {"error": {"code": code, "message": message, "details": details}}
    return response
