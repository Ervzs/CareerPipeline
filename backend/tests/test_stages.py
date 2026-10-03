import pytest

from pipeline.models import PipelineStage

URL = "/api/stages/"


def stage_names(user):
    return list(user.stages.values_list("name", flat=True))


def test_stages_require_authentication(api_client):
    assert api_client.get(URL).status_code == 401


def test_list_returns_default_stages_in_order(client_a):
    response = client_a.get(URL)
    assert response.status_code == 200
    assert [s["name"] for s in response.json()] == [
        "Wishlist",
        "Applied",
        "Interviewing",
        "Offer",
        "Rejected",
    ]


def test_create_appends_stage_at_the_end(client_a, user_a):
    response = client_a.post(URL, {"name": "Ghosted"}, format="json")
    assert response.status_code == 201
    assert response.json()["order"] == 5
    assert stage_names(user_a)[-1] == "Ghosted"


def test_client_cannot_set_order_or_user(client_a, user_a, user_b):
    response = client_a.post(URL, {"name": "X", "order": 0, "user": user_b.id}, format="json")
    assert response.status_code == 201
    stage = PipelineStage.objects.get(pk=response.json()["id"])
    assert stage.user == user_a
    assert stage.order == 5


def test_duplicate_name_rejected_for_same_user_only(client_a, client_b):
    response = client_a.post(URL, {"name": "applied"}, format="json")
    assert response.status_code == 400
    assert "name" in response.json()["error"]["details"]
    assert client_b.post(URL, {"name": "Custom"}, format="json").status_code == 201
    assert client_a.post(URL, {"name": "Custom"}, format="json").status_code == 201


def test_rename_stage(client_a, user_a, stage_of):
    stage = stage_of(user_a, "Offer")
    response = client_a.patch(f"{URL}{stage.id}/", {"name": "Offers"}, format="json")
    assert response.status_code == 200
    assert response.json()["name"] == "Offers"


def test_rename_to_own_current_name_is_allowed(client_a, user_a, stage_of):
    stage = stage_of(user_a, "Offer")
    response = client_a.patch(f"{URL}{stage.id}/", {"name": "Offer"}, format="json")
    assert response.status_code == 200


def test_delete_empty_stage_and_close_the_gap(client_a, user_a, stage_of):
    stage = stage_of(user_a, "Interviewing")
    assert client_a.delete(f"{URL}{stage.id}/").status_code == 204
    assert list(user_a.stages.values_list("order", flat=True)) == [0, 1, 2, 3]
    assert "Interviewing" not in stage_names(user_a)


def test_delete_stage_with_applications_is_blocked(client_a, user_a, stage_of, make_application):
    stage = stage_of(user_a, "Applied")
    make_application(user_a, stage)
    response = client_a.delete(f"{URL}{stage.id}/")
    assert response.status_code == 409
    error = response.json()["error"]
    assert error["code"] == "stage_not_empty"
    assert "Move them" in error["message"]
    assert PipelineStage.objects.filter(pk=stage.pk).exists()


# --- reorder ----------------------------------------------------------------
def reorder(client, ids):
    return client.post(f"{URL}reorder/", {"stage_ids": ids}, format="json")


def test_reorder_updates_every_order_value(client_a, user_a):
    ids = list(user_a.stages.values_list("id", flat=True))
    new_ids = list(reversed(ids))
    response = reorder(client_a, new_ids)
    assert response.status_code == 200
    assert [s["id"] for s in response.json()] == new_ids
    assert list(user_a.stages.values_list("id", flat=True)) == new_ids
    assert list(user_a.stages.values_list("order", flat=True)) == [0, 1, 2, 3, 4]


@pytest.mark.parametrize(
    "mutate",
    [
        lambda ids, other: ids[:-1],  # missing one
        lambda ids, other: [*ids, other[0]],  # extra id from another user
        lambda ids, other: [*ids[:-1], other[0]],  # swap in another user's id
        lambda ids, other: [*ids, ids[0]],  # duplicate
        lambda ids, other: [*ids[:-1], ids[0]],  # duplicate replacing one
        lambda ids, other: [*ids, 999999],  # unknown id
        lambda ids, other: [],  # empty
    ],
)
def test_reorder_rejects_lists_that_do_not_match_exactly(client_a, user_a, user_b, mutate):
    ids = list(user_a.stages.values_list("id", flat=True))
    other = list(user_b.stages.values_list("id", flat=True))
    before = list(user_a.stages.values_list("id", "order"))
    response = reorder(client_a, mutate(ids, other))
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "validation_error"
    assert list(user_a.stages.values_list("id", "order")) == before
    assert list(user_b.stages.values_list("order", flat=True)) == [0, 1, 2, 3, 4]
