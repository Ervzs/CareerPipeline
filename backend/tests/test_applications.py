from applications.models import Application

URL = "/api/applications/"


def test_list_without_token_returns_401(api_client):
    response = api_client.get(URL)

    assert response.status_code == 401


def test_create_sets_logged_in_user_as_owner(auth_client, user):
    response = auth_client.post(URL, {"company": "Accenture", "job_title": "Junior Web Developer"})

    assert response.status_code == 201
    assert Application.objects.get(id=response.data["id"]).user == user


def test_list_returns_only_my_applications(auth_client, user, other_user):
    Application.objects.create(user=user, company="Accenture", job_title="Developer")
    Application.objects.create(user=other_user, company="Globe", job_title="Developer")

    response = auth_client.get(URL)

    assert response.status_code == 200
    assert [row["company"] for row in response.data] == ["Accenture"]


def test_other_users_application_returns_404(auth_client, other_user):
    theirs = Application.objects.create(user=other_user, company="Globe", job_title="Developer")

    response = auth_client.get(f"{URL}{theirs.id}/")

    assert response.status_code == 404
