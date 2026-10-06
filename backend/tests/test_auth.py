import pytest
from django.contrib.auth import get_user_model

User = get_user_model()
PASSWORD = "correct-horse-battery-9"


@pytest.fixture
def user(db):
    return User.objects.create_user(email="user@example.com", password=PASSWORD)


def login(client, email="user@example.com", password=PASSWORD):
    return client.post("/api/auth/login/", {"email": email, "password": password}, format="json")


# --- register ---------------------------------------------------------------
@pytest.mark.django_db
def test_register_hashes_password_and_creates_default_stages(api_client):
    response = api_client.post(
        "/api/auth/register/", {"email": "new@example.com", "password": PASSWORD}, format="json"
    )
    assert response.status_code == 201
    assert "password" not in response.json()
    user = User.objects.get(email="new@example.com")
    assert user.password != PASSWORD
    assert user.password.startswith("pbkdf2_")
    assert user.check_password(PASSWORD)
    assert user.stages.count() == 5


@pytest.mark.django_db
@pytest.mark.parametrize("password", ["short1", "12345678901", "password1234"])
def test_register_rejects_weak_passwords(api_client, password):
    response = api_client.post(
        "/api/auth/register/", {"email": "weak@example.com", "password": password}, format="json"
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "validation_error"
    assert not User.objects.filter(email="weak@example.com").exists()


@pytest.mark.django_db
def test_register_allows_a_password_that_resembles_the_email(api_client):
    """There is deliberately no "too similar to your email" rule: with a long email almost
    nothing would pass it."""
    response = api_client.post(
        "/api/auth/register/",
        {"email": "maria.cruz@example.com", "password": "mariacruz2026"},
        format="json",
    )
    assert response.status_code == 201
    assert User.objects.get(email="maria.cruz@example.com").check_password("mariacruz2026")


def test_register_rejects_duplicate_email_case_insensitively(api_client, user):
    response = api_client.post(
        "/api/auth/register/", {"email": "USER@example.com", "password": PASSWORD}, format="json"
    )
    assert response.status_code == 400
    assert "email" in response.json()["error"]["details"]


# --- login ------------------------------------------------------------------
def test_login_returns_access_token_and_sets_httponly_refresh_cookie(api_client, user):
    response = login(api_client)
    assert response.status_code == 200
    assert set(response.json()) == {"access"}
    cookie = response.cookies["refresh_token"]
    assert cookie.value
    assert cookie["httponly"]
    assert cookie["path"] == "/api/auth/"
    assert cookie["samesite"] == "Lax"


def test_login_with_wrong_password_fails(api_client, user):
    response = login(api_client, password="wrong-password-1")
    assert response.status_code == 401
    assert "refresh_token" not in response.cookies


# --- refresh ----------------------------------------------------------------
def test_refresh_uses_cookie_and_rotates_it(api_client, user):
    first = login(api_client).cookies["refresh_token"].value
    response = api_client.post("/api/auth/refresh/")
    assert response.status_code == 200
    assert response.json()["access"]
    assert response.cookies["refresh_token"].value != first


def test_refresh_without_cookie_is_401(api_client):
    response = api_client.post("/api/auth/refresh/")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "no_refresh_cookie"


def test_rotated_refresh_token_cannot_be_reused(api_client, user):
    old = login(api_client).cookies["refresh_token"].value
    assert api_client.post("/api/auth/refresh/").status_code == 200
    api_client.cookies["refresh_token"] = old
    assert api_client.post("/api/auth/refresh/").status_code == 401


# --- logout -----------------------------------------------------------------
def test_logout_blacklists_token_and_clears_cookie(api_client, user):
    token = login(api_client).cookies["refresh_token"].value
    response = api_client.post("/api/auth/logout/")
    assert response.status_code == 204
    assert response.cookies["refresh_token"].value == ""
    assert response.cookies["refresh_token"]["max-age"] == 0

    api_client.cookies["refresh_token"] = token  # replay the old token
    assert api_client.post("/api/auth/refresh/").status_code == 401


def test_logout_without_cookie_still_succeeds(api_client):
    assert api_client.post("/api/auth/logout/").status_code == 204


# --- me / protection --------------------------------------------------------
def test_me_requires_authentication(api_client):
    assert api_client.get("/api/auth/me/").status_code == 401


def test_me_returns_current_user(api_client, user):
    access = login(api_client).json()["access"]
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
    response = api_client.get("/api/auth/me/")
    assert response.status_code == 200
    assert response.json() == {"id": user.id, "email": "user@example.com"}


# --- browser extension token ------------------------------------------------
def test_extension_token_is_issued_for_valid_credentials_and_revocable(api_client, user):
    url = "/api/auth/extension-token/"
    wrong = api_client.post(url, {"email": user.email, "password": "nope"}, format="json")
    assert wrong.status_code == 401

    response = api_client.post(url, {"email": user.email, "password": PASSWORD}, format="json")
    assert response.status_code == 200
    key = response.json()["token"]
    again = api_client.post(url, {"email": user.email, "password": PASSWORD}, format="json")
    assert again.json()["token"] == key

    api_client.credentials(HTTP_AUTHORIZATION=f"Token {key}")
    assert api_client.get("/api/auth/me/").status_code == 200
    assert api_client.delete(url).status_code == 204
    assert api_client.get("/api/auth/me/").status_code == 401
