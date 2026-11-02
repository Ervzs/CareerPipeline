from accounts.models import User

PASSWORD = "correct-horse-battery-9"


def login(api_client, user):
    return api_client.post("/api/auth/login/", {"email": user.email, "password": PASSWORD})


def test_register_creates_user_with_hashed_password(api_client, db):
    response = api_client.post(
        "/api/auth/register/", {"email": "new@example.com", "password": PASSWORD}
    )

    assert response.status_code == 201
    user = User.objects.get(email="new@example.com")
    assert user.password != PASSWORD
    assert user.check_password(PASSWORD)


def test_login_returns_access_and_sets_refresh_cookie(api_client, user):
    response = login(api_client, user)

    assert response.status_code == 200
    assert "access" in response.data
    assert "refresh" not in response.data
    assert response.cookies["refresh"]["httponly"]


def test_refresh_cookie_returns_new_access(api_client, user):
    login(api_client, user)

    response = api_client.post("/api/auth/refresh/")

    assert response.status_code == 200
    assert "access" in response.data


def test_logout_blacklists_refresh_token(api_client, user):
    login(api_client, user)
    old_refresh = api_client.cookies["refresh"].value

    api_client.post("/api/auth/logout/")
    api_client.cookies["refresh"] = old_refresh
    response = api_client.post("/api/auth/refresh/")

    assert response.status_code == 401
