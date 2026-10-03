import pytest

from pipeline.models import JobApplication

URL = "/api/applications/"


def column(stage):
    """[(title, position)] for a stage, in position order."""
    return list(
        JobApplication.objects.filter(stage=stage)
        .order_by("position")
        .values_list("job_title", "position")
    )


def move(client, app, stage, position):
    return client.patch(
        f"{URL}{app.id}/move/", {"stage": stage.id, "position": position}, format="json"
    )


@pytest.fixture
def board(user_a, stage_of, make_application):
    applied = stage_of(user_a, "Applied")
    interviewing = stage_of(user_a, "Interviewing")
    a = [make_application(user_a, applied, title=f"a{i}") for i in range(4)]
    i = [make_application(user_a, interviewing, title=f"i{n}") for n in range(2)]
    return {"applied": applied, "interviewing": interviewing, "a": a, "i": i}


def test_move_within_column_down(client_a, board):
    response = move(client_a, board["a"][0], board["applied"], 2)
    assert response.status_code == 200
    assert response.json()["position"] == 2
    assert column(board["applied"]) == [("a1", 0), ("a2", 1), ("a0", 2), ("a3", 3)]


def test_move_within_column_up(client_a, board):
    move(client_a, board["a"][3], board["applied"], 0)
    assert column(board["applied"]) == [("a3", 0), ("a0", 1), ("a1", 2), ("a2", 3)]


def test_move_to_another_column_resequences_both(client_a, board):
    response = move(client_a, board["a"][1], board["interviewing"], 1)
    assert response.status_code == 200
    assert response.json()["stage"] == board["interviewing"].id
    assert column(board["applied"]) == [("a0", 0), ("a2", 1), ("a3", 2)]
    assert column(board["interviewing"]) == [("i0", 0), ("a1", 1), ("i1", 2)]


def test_move_to_top_and_bottom_of_other_column(client_a, board):
    move(client_a, board["a"][0], board["interviewing"], 0)
    move(client_a, board["a"][1], board["interviewing"], 2)
    assert column(board["interviewing"]) == [("a0", 0), ("i0", 1), ("a1", 2), ("i1", 3)]
    assert column(board["applied"]) == [("a2", 0), ("a3", 1)]


def test_out_of_range_position_is_clamped_to_the_end(client_a, board):
    move(client_a, board["a"][0], board["interviewing"], 999)
    assert column(board["interviewing"]) == [("i0", 0), ("i1", 1), ("a0", 2)]


def test_move_into_empty_column(client_a, board, stage_of, user_a):
    offer = stage_of(user_a, "Offer")
    move(client_a, board["a"][2], offer, 0)
    assert column(offer) == [("a2", 0)]
    assert column(board["applied"]) == [("a0", 0), ("a1", 1), ("a3", 2)]


def test_negative_position_is_rejected(client_a, board):
    response = move(client_a, board["a"][0], board["applied"], -1)
    assert response.status_code == 400
    assert column(board["applied"])[0] == ("a0", 0)


def test_move_requires_stage_and_position(client_a, board):
    response = client_a.patch(f"{URL}{board['a'][0].id}/move/", {}, format="json")
    assert response.status_code == 400


def test_move_to_another_users_stage_is_rejected(client_a, board, user_b):
    foreign = user_b.stages.get(name="Applied")
    response = move(client_a, board["a"][0], foreign, 0)
    assert response.status_code == 400
    board["a"][0].refresh_from_db()
    assert board["a"][0].stage_id == board["applied"].id


def test_move_is_atomic_and_leaves_positions_contiguous(client_a, board):
    for target, pos in [("interviewing", 0), ("applied", 1), ("interviewing", 3), ("applied", 0)]:
        move(client_a, board["a"][1], board[target], pos)
    for stage in (board["applied"], board["interviewing"]):
        assert [p for _, p in column(stage)] == list(range(len(column(stage))))
