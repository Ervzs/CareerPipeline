from django.utils import timezone
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from pipeline.models import JobApplication

URL = "/api/applications/capture/"
JOB = {"listing_url": "https://www.linkedin.com/jobs/view/123/", "job_title": "Backend Engineer"}


def test_capture_saves_to_applied_dated_today(client_a, user_a, stage_of):
    response = client_a.post(URL, JOB, format="json")
    assert response.status_code == 201
    body = response.json()
    assert body["stage"] == stage_of(user_a, "Applied").id
    assert body["date_applied"] == timezone.localdate().isoformat()
    assert body["company_detail"] is None


def test_capture_uses_the_sent_date_and_company(client_a):
    response = client_a.post(
        URL, {**JOB, "company_name": "Acme", "date_applied": "2026-03-04"}, format="json"
    )
    assert response.status_code == 201
    assert response.json()["company_detail"]["name"] == "Acme"
    assert response.json()["date_applied"] == "2026-03-04"


def test_capture_twice_returns_the_existing_card(client_a):
    first = client_a.post(URL, JOB, format="json")
    second = client_a.post(URL, {**JOB, "job_title": "Other"}, format="json")
    assert second.status_code == 200
    assert second.json()["id"] == first.json()["id"]
    assert JobApplication.objects.count() == 1


def test_capture_falls_back_to_the_first_stage(client_a, user_a, stage_of):
    stage_of(user_a, "Applied").delete()
    response = client_a.post(URL, JOB, format="json")
    assert response.status_code == 201
    assert response.json()["stage"] == stage_of(user_a, "Wishlist").id


def test_capture_requires_title_and_url(client_a):
    response = client_a.post(URL, {"listing_url": "not a url"}, format="json")
    assert response.status_code == 400
    assert {"listing_url", "job_title"} <= set(response.json()["error"]["details"])


def test_capture_does_not_see_other_users_cards(client_a, client_b):
    client_b.post(URL, JOB, format="json")
    assert client_a.post(URL, JOB, format="json").status_code == 201
    assert JobApplication.objects.count() == 2


def test_capture_accepts_the_extension_token(user_a):
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Token {Token.objects.create(user=user_a).key}")
    assert client.post(URL, JOB, format="json").status_code == 201
    assert APIClient().post(URL, JOB, format="json").status_code == 401
