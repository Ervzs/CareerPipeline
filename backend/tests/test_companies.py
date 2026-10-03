from pipeline.models import Company

URL = "/api/companies/"


def test_companies_require_authentication(api_client):
    assert api_client.get(URL).status_code == 401


def test_company_crud(client_a, user_a):
    created = client_a.post(
        URL, {"name": "Acme", "website": "https://acme.test", "notes": "Great team"}, format="json"
    )
    assert created.status_code == 201
    company_id = created.json()["id"]
    assert Company.objects.get(pk=company_id).user == user_a

    assert [c["name"] for c in client_a.get(URL).json()] == ["Acme"]
    assert client_a.get(f"{URL}{company_id}/").json()["notes"] == "Great team"

    updated = client_a.patch(f"{URL}{company_id}/", {"notes": "Updated"}, format="json")
    assert updated.status_code == 200
    assert updated.json()["notes"] == "Updated"

    assert client_a.delete(f"{URL}{company_id}/").status_code == 204
    assert not Company.objects.filter(pk=company_id).exists()


def test_website_must_be_a_valid_url(client_a):
    response = client_a.post(URL, {"name": "Acme", "website": "not a url"}, format="json")
    assert response.status_code == 400
    assert "website" in response.json()["error"]["details"]


def test_website_and_notes_are_optional(client_a):
    assert client_a.post(URL, {"name": "Bare"}, format="json").status_code == 201


def test_name_is_required(client_a):
    assert client_a.post(URL, {}, format="json").status_code == 400


def test_delete_company_with_applications_is_blocked(client_a, user_a, stage_of, make_application):
    app = make_application(user_a, stage_of(user_a, "Applied"))
    response = client_a.delete(f"{URL}{app.company_id}/")
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "company_in_use"
    assert Company.objects.filter(pk=app.company_id).exists()
