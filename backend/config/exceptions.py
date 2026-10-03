"""One consistent error envelope for every API error:

{"error": {"code": "...", "message": "...", "details": {...}}}
"""

from rest_framework import status
from rest_framework.exceptions import APIException, ValidationError
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
        code = getattr(exc, "detail", None) and getattr(exc.detail, "code", None)
        code = code or getattr(exc, "default_code", "error")
        message = _first_message(response.data)
        details = {}

    response.data = {"error": {"code": code, "message": message, "details": details}}
    return response
