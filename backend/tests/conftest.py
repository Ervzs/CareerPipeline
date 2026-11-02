import pytest
from rest_framework.test import APIClient

from accounts.models import User

PASSWORD = "correct-horse-battery-9"


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user(db):
    return User.objects.create_user(email="ana@example.com", password=PASSWORD)


@pytest.fixture
def other_user(db):
    return User.objects.create_user(email="ben@example.com", password=PASSWORD)


@pytest.fixture
def auth_client(user):
    client = APIClient()
    client.force_authenticate(user)
    return client
