import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError

User = get_user_model()


@pytest.mark.django_db
def test_create_user_hashes_password_and_normalizes_email():
    user = User.objects.create_user(email="Jane@EXAMPLE.com", password="s3cret-pass-123")
    assert user.email == "Jane@example.com"
    assert user.password != "s3cret-pass-123"
    assert user.password.startswith("pbkdf2_")
    assert user.check_password("s3cret-pass-123")


@pytest.mark.django_db
def test_email_is_unique():
    User.objects.create_user(email="a@example.com", password="pw-123456789")
    with pytest.raises(IntegrityError):
        User.objects.create_user(email="a@example.com", password="pw-123456789")


@pytest.mark.django_db
def test_user_has_no_username_field():
    assert User.USERNAME_FIELD == "email"
    assert "username" not in [f.name for f in User._meta.get_fields()]


@pytest.mark.django_db
def test_create_user_requires_email():
    with pytest.raises(ValueError):
        User.objects.create_user(email="", password="pw-123456789")
