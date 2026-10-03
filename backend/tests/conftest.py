import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from pipeline.models import Company, JobApplication

User = get_user_model()
PASSWORD = "correct-horse-battery-9"


@pytest.fixture
def api_client():
    return APIClient()


def make_client(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


@pytest.fixture
def user_a(db):
    return User.objects.create_user(email="a@example.com", password=PASSWORD)


@pytest.fixture
def user_b(db):
    return User.objects.create_user(email="b@example.com", password=PASSWORD)


@pytest.fixture
def client_a(user_a):
    return make_client(user_a)


@pytest.fixture
def client_b(user_b):
    return make_client(user_b)


@pytest.fixture
def stage_of():
    """stage_of(user, "Applied") -> that user's stage."""
    return lambda user, name: user.stages.get(name=name)


@pytest.fixture
def make_application():
    """make_application(user, stage, title=..., company=None) appends a card to the column."""

    def _make(user, stage, title="Engineer", company=None, **extra):
        company = company or Company.objects.get_or_create(user=user, name="Acme")[0]
        position = JobApplication.objects.filter(stage=stage).count()
        return JobApplication.objects.create(
            user=user, company=company, stage=stage, job_title=title, position=position, **extra
        )

    return _make
