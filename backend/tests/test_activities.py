import datetime

import pytest
from django.utils import timezone

from pipeline.models import ApplicationActivity, JobApplication


@pytest.fixture
def app_a(user_a, stage_of, make_application):
    return make_application(user_a, stage_of(user_a, "Applied"))


@pytest.fixture
def app_b(user_b, stage_of, make_application):
    return make_application(user_b, stage_of(user_b, "Applied"))


def list_url(app):
    return f"/api/applications/{app.id}/activities/"


def detail_url(activity_id):
    return f"/api/activities/{activity_id}/"


def note(user, application, text="Spoke with the recruiter", **extra):
    return ApplicationActivity.objects.create(
        user=user, application=application, note=text, **extra
    )


def test_requires_authentication(api_client, app_a):
    assert api_client.get(list_url(app_a)).status_code == 401
    assert api_client.post(list_url(app_a), {}, format="json").status_code == 401


def test_create_a_note(client_a, user_a, app_a):
    before = timezone.now()
    response = client_a.post(
        list_url(app_a), {"kind": "call", "note": "Intro call went well"}, format="json"
    )

    assert response.status_code == 201
    body = response.json()
    assert body["kind"] == "call"
    assert body["application"] == app_a.id
    created = ApplicationActivity.objects.get(pk=body["id"])
    assert created.user == user_a
    assert created.occurred_at >= before  # defaults to now


def test_occurred_at_can_be_set_and_kind_defaults_to_other(client_a, app_a):
    response = client_a.post(
        list_url(app_a),
        {"note": "Phone screen", "occurred_at": "2026-03-04T10:30:00Z"},
        format="json",
    )

    assert response.status_code == 201
    assert response.json()["kind"] == "other"
    assert response.json()["occurred_at"] == "2026-03-04T10:30:00Z"


def test_note_text_is_required_and_kind_must_be_valid(client_a, app_a):
    blank = client_a.post(list_url(app_a), {"kind": "call", "note": ""}, format="json")
    missing = client_a.post(list_url(app_a), {"kind": "call"}, format="json")
    bad_kind = client_a.post(list_url(app_a), {"kind": "smoke-signal", "note": "x"}, format="json")

    for response in (blank, missing, bad_kind):
        assert response.status_code == 400
        assert response.json()["error"]["code"] == "validation_error"
    assert "note" in blank.json()["error"]["details"]
    assert "kind" in bad_kind.json()["error"]["details"]
    assert not ApplicationActivity.objects.exists()


def test_list_is_newest_first_by_when_it_happened(client_a, user_a, app_a):
    now = timezone.now()
    note(user_a, app_a, "middle", occurred_at=now - datetime.timedelta(days=2))
    note(user_a, app_a, "newest", occurred_at=now)
    note(user_a, app_a, "oldest", occurred_at=now - datetime.timedelta(days=9))

    notes = [n["note"] for n in client_a.get(list_url(app_a)).json()]

    assert notes == ["newest", "middle", "oldest"]


def test_list_only_contains_that_applications_notes(
    client_a, user_a, app_a, stage_of, make_application
):
    other = make_application(user_a, stage_of(user_a, "Offer"), title="Other")
    note(user_a, app_a, "mine")
    note(user_a, other, "not this one")

    assert [n["note"] for n in client_a.get(list_url(app_a)).json()] == ["mine"]


def test_update_a_note(client_a, user_a, app_a):
    activity = note(user_a, app_a, "draft", kind="other")

    response = client_a.patch(
        detail_url(activity.id), {"note": "final", "kind": "interview"}, format="json"
    )

    assert response.status_code == 200
    activity.refresh_from_db()
    assert (activity.note, activity.kind) == ("final", "interview")


def test_a_note_cannot_be_moved_to_another_application(
    client_a, user_a, app_a, stage_of, make_application
):
    other = make_application(user_a, stage_of(user_a, "Offer"), title="Other")
    activity = note(user_a, app_a)

    client_a.patch(detail_url(activity.id), {"application": other.id}, format="json")

    activity.refresh_from_db()
    assert activity.application_id == app_a.id


def test_delete_a_note(client_a, user_a, app_a):
    activity = note(user_a, app_a)

    assert client_a.delete(detail_url(activity.id)).status_code == 204
    assert not ApplicationActivity.objects.filter(pk=activity.pk).exists()


def test_deleting_an_application_deletes_its_notes(client_a, user_a, app_a):
    note(user_a, app_a)
    note(user_a, app_a, "second")

    assert client_a.delete(f"/api/applications/{app_a.id}/").status_code == 204

    assert ApplicationActivity.objects.count() == 0
    assert not JobApplication.objects.filter(pk=app_a.pk).exists()


# --- tenant isolation -----------------------------------------------------------
def test_cannot_list_another_users_notes(client_a, user_b, app_b):
    note(user_b, app_b, "B secret")

    response = client_a.get(list_url(app_b))

    assert response.status_code == 404
    assert "B secret" not in response.content.decode()


def test_cannot_add_a_note_to_another_users_application(client_a, app_b):
    response = client_a.post(list_url(app_b), {"kind": "call", "note": "sneaky"}, format="json")

    assert response.status_code == 404
    assert not ApplicationActivity.objects.exists()


@pytest.mark.parametrize("method", ["get", "patch", "put", "delete"])
def test_cannot_read_change_or_delete_another_users_note(client_a, user_b, app_b, method):
    activity = note(user_b, app_b, "B secret")

    response = getattr(client_a, method)(detail_url(activity.id), {"note": "hacked"}, format="json")

    assert response.status_code == 404
    activity.refresh_from_db()
    assert activity.note == "B secret"


def test_client_supplied_user_is_ignored(client_a, user_a, user_b, app_a):
    response = client_a.post(
        list_url(app_a), {"note": "x", "user": user_b.id, "application": 999999}, format="json"
    )

    assert response.status_code == 201
    created = ApplicationActivity.objects.get(pk=response.json()["id"])
    assert created.user == user_a
    assert created.application_id == app_a.id


def test_notes_endpoints_reject_anonymous_access_to_existing_notes(api_client, user_a, app_a):
    activity = note(user_a, app_a)

    assert api_client.get(detail_url(activity.id)).status_code == 401
    assert api_client.delete(detail_url(activity.id)).status_code == 401
    assert ApplicationActivity.objects.filter(pk=activity.pk).exists()


def test_list_query_count_does_not_grow(client_a, user_a, app_a, django_assert_max_num_queries):
    for i in range(25):
        note(user_a, app_a, f"note {i}")

    with django_assert_max_num_queries(3):
        assert len(client_a.get(list_url(app_a)).json()) == 25
