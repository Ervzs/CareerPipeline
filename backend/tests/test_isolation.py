"""Tenant isolation: user A must never read, change, delete, or reference user B's data."""

import pytest

from pipeline.models import Company, JobApplication, PipelineStage

MODELS = {"stages": PipelineStage, "companies": Company, "applications": JobApplication}


@pytest.fixture
def b_objects(user_b, stage_of, make_application):
    """One of each kind of object owned by user B."""
    app = make_application(user_b, stage_of(user_b, "Applied"), title="B secret job")
    return {"stages": app.stage, "companies": app.company, "applications": app}


# A write that should change something, per resource.
UPDATES = {
    "stages": {"name": "Hacked"},
    "companies": {"name": "Hacked"},
    "applications": {"job_title": "Hacked"},
}
FIELD = {"stages": "name", "companies": "name", "applications": "job_title"}


@pytest.mark.parametrize("resource", MODELS)
def test_lists_never_contain_other_users_rows(client_a, user_a, b_objects, resource):
    response = client_a.get(f"/api/{resource}/")
    assert response.status_code == 200
    ids = {row["id"] for row in response.json()}
    assert b_objects[resource].id not in ids
    assert ids == set(MODELS[resource].objects.filter(user=user_a).values_list("id", flat=True))


@pytest.mark.parametrize("resource", MODELS)
def test_cannot_retrieve_other_users_object(client_a, b_objects, resource):
    response = client_a.get(f"/api/{resource}/{b_objects[resource].id}/")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


@pytest.mark.parametrize("method", ["patch", "put"])
@pytest.mark.parametrize("resource", MODELS)
def test_cannot_update_other_users_object(client_a, b_objects, resource, method):
    obj = b_objects[resource]
    body = {**UPDATES[resource], "company_name": "X", "stage": getattr(obj, "stage_id", None)}
    response = getattr(client_a, method)(f"/api/{resource}/{obj.id}/", body, format="json")
    assert response.status_code == 404
    before = getattr(obj, FIELD[resource])
    obj.refresh_from_db()
    assert getattr(obj, FIELD[resource]) == before


@pytest.mark.parametrize("resource", MODELS)
def test_cannot_delete_other_users_object(client_a, b_objects, resource):
    obj = b_objects[resource]
    response = client_a.delete(f"/api/{resource}/{obj.id}/")
    assert response.status_code == 404
    assert MODELS[resource].objects.filter(pk=obj.pk).exists()


def test_cannot_move_other_users_application(client_a, user_a, stage_of, b_objects):
    app = b_objects["applications"]
    mine = stage_of(user_a, "Offer")
    response = client_a.patch(
        f"/api/applications/{app.id}/move/", {"stage": mine.id, "position": 0}, format="json"
    )
    assert response.status_code == 404
    app.refresh_from_db()
    assert app.stage.user != user_a


# --- referencing another user's objects --------------------------------------
def test_cannot_create_application_with_other_users_company(client_a, user_a, stage_of, b_objects):
    response = client_a.post(
        "/api/applications/",
        {
            "company": b_objects["companies"].id,
            "stage": stage_of(user_a, "Applied").id,
            "job_title": "Sneaky",
        },
        format="json",
    )
    assert response.status_code == 400
    assert "company" in response.json()["error"]["details"]
    assert not JobApplication.objects.filter(job_title="Sneaky").exists()


def test_cannot_create_application_in_other_users_stage(client_a, user_a, b_objects):
    own_company = Company.objects.create(user=user_a, name="Mine")
    response = client_a.post(
        "/api/applications/",
        {"company": own_company.id, "stage": b_objects["stages"].id, "job_title": "Sneaky"},
        format="json",
    )
    assert response.status_code == 400
    assert "stage" in response.json()["error"]["details"]
    assert not JobApplication.objects.filter(job_title="Sneaky").exists()


def test_cannot_repoint_own_application_at_other_users_company(
    client_a, user_a, stage_of, make_application, b_objects
):
    mine = make_application(user_a, stage_of(user_a, "Applied"))
    response = client_a.patch(
        f"/api/applications/{mine.id}/", {"company": b_objects["companies"].id}, format="json"
    )
    assert response.status_code == 400
    mine.refresh_from_db()
    assert mine.company.user == user_a


def test_cannot_move_own_application_to_other_users_stage(
    client_a, user_a, stage_of, make_application, b_objects
):
    mine = make_application(user_a, stage_of(user_a, "Applied"))
    response = client_a.patch(
        f"/api/applications/{mine.id}/move/",
        {"stage": b_objects["stages"].id, "position": 0},
        format="json",
    )
    assert response.status_code == 400
    mine.refresh_from_db()
    assert mine.stage.user == user_a


def test_cannot_reorder_using_other_users_stage_ids(client_a, user_a, user_b):
    ids = list(user_a.stages.values_list("id", flat=True))
    foreign = list(user_b.stages.values_list("id", flat=True))
    before_b = list(user_b.stages.values_list("id", "order"))
    response = client_a.post(
        "/api/stages/reorder/", {"stage_ids": [*ids[:-1], foreign[0]]}, format="json"
    )
    assert response.status_code == 400
    assert list(user_b.stages.values_list("id", "order")) == before_b


# --- the owner is always the caller -----------------------------------------
@pytest.mark.parametrize(
    ("resource", "body"),
    [
        ("stages", {"name": "Mine"}),
        ("companies", {"name": "Mine"}),
    ],
)
def test_client_supplied_user_is_ignored(client_a, user_a, user_b, resource, body):
    response = client_a.post(f"/api/{resource}/", {**body, "user": user_b.id}, format="json")
    assert response.status_code == 201
    assert MODELS[resource].objects.get(pk=response.json()["id"]).user == user_a


def test_client_supplied_user_is_ignored_for_applications(client_a, user_a, user_b, stage_of):
    response = client_a.post(
        "/api/applications/",
        {
            "stage": stage_of(user_a, "Applied").id,
            "company_name": "Acme",
            "job_title": "Dev",
            "user": user_b.id,
        },
        format="json",
    )
    assert response.status_code == 201
    app = JobApplication.objects.get(pk=response.json()["id"])
    assert app.user == user_a
    assert app.company.user == user_a


@pytest.mark.parametrize("resource", MODELS)
def test_every_endpoint_rejects_unauthenticated_requests(api_client, b_objects, resource):
    obj = b_objects[resource]
    assert api_client.get(f"/api/{resource}/").status_code == 401
    assert api_client.get(f"/api/{resource}/{obj.id}/").status_code == 401
    assert api_client.post(f"/api/{resource}/", {}, format="json").status_code == 401
    assert api_client.delete(f"/api/{resource}/{obj.id}/").status_code == 401
    assert MODELS[resource].objects.filter(pk=obj.pk).exists()


def test_company_name_does_not_reuse_other_users_company(client_a, user_a, stage_of, b_objects):
    """`company_name` matching B's company must create a new one for A, not attach B's."""
    response = client_a.post(
        "/api/applications/",
        {
            "stage": stage_of(user_a, "Applied").id,
            "company_name": b_objects["companies"].name,
            "job_title": "Dev",
        },
        format="json",
    )
    assert response.status_code == 201
    assert response.json()["company"] != b_objects["companies"].id
    assert Company.objects.get(pk=response.json()["company"]).user == user_a
