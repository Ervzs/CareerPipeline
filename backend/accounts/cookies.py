"""Helpers for the httpOnly refresh-token cookie.

The refresh token never appears in a response body: JavaScript only ever holds the
short-lived access token, so an XSS bug cannot steal a long-lived credential.
"""

from django.conf import settings


def _cookie_options():
    return {
        "httponly": True,
        "secure": settings.REFRESH_COOKIE_SECURE,
        "samesite": settings.REFRESH_COOKIE_SAMESITE,
        "path": settings.REFRESH_COOKIE_PATH,
    }


def set_refresh_cookie(response, refresh_token):
    max_age = int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds())
    response.set_cookie(
        settings.REFRESH_COOKIE_NAME, str(refresh_token), max_age=max_age, **_cookie_options()
    )


def clear_refresh_cookie(response):
    # Expire with the same attributes it was set with, otherwise browsers
    # (notably for SameSite=None; Secure) may keep the cookie.
    response.set_cookie(settings.REFRESH_COOKIE_NAME, "", max_age=0, **_cookie_options())


def get_refresh_cookie(request):
    return request.COOKIES.get(settings.REFRESH_COOKIE_NAME)
