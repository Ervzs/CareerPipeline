"""The production configuration: health probe and Django's own deployment checklist."""

import os
import subprocess
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent


def test_health_endpoint_is_public_and_does_not_need_auth(api_client):
    response = api_client.get("/api/health/")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def run_manage(*args, **env_overrides):
    env = {**os.environ, **env_overrides}
    return subprocess.run(
        [sys.executable, "manage.py", *args],
        cwd=BACKEND_DIR,
        env=env,
        capture_output=True,
        text=True,
        timeout=120,
    )


PRODUCTION_ENV = {
    "DEBUG": "False",
    "SECRET_KEY": "x" * 60 + "-production-style-secret-key-for-checks-only",
    "ALLOWED_HOSTS": "careerpipeline-api.onrender.com",
    "DATABASE_URL": "sqlite:///:memory:",
    "CORS_ALLOWED_ORIGINS": "https://careerpipeline.vercel.app",
    "CSRF_TRUSTED_ORIGINS": "https://careerpipeline-api.onrender.com",
    "REFRESH_COOKIE_SECURE": "True",
    "REFRESH_COOKIE_SAMESITE": "None",
}


def test_django_deployment_checklist_passes_with_production_settings():
    result = run_manage("check", "--deploy", "--fail-level", "WARNING", **PRODUCTION_ENV)
    assert result.returncode == 0, result.stdout + result.stderr


def test_production_enables_https_hardening_and_cross_site_cookie():
    code = (
        "from django.conf import settings as s;"
        "print(s.SECURE_SSL_REDIRECT, s.SESSION_COOKIE_SECURE, s.SECURE_HSTS_SECONDS > 0,"
        " s.REFRESH_COOKIE_SECURE, s.REFRESH_COOKIE_SAMESITE, s.DEBUG)"
    )
    result = run_manage("shell", "-c", code, **PRODUCTION_ENV)
    assert result.returncode == 0, result.stderr
    assert result.stdout.strip().splitlines()[-1] == "True True True True None False"


def test_render_hostname_is_allowed_automatically():
    code = "from django.conf import settings as s; print(s.ALLOWED_HOSTS)"
    env = {**PRODUCTION_ENV, "ALLOWED_HOSTS": "", "RENDER_EXTERNAL_HOSTNAME": "my-api.onrender.com"}
    result = run_manage("shell", "-c", code, **env)
    assert result.returncode == 0, result.stderr
    assert "my-api.onrender.com" in result.stdout
