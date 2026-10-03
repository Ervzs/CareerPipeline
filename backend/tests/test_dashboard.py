import datetime

import pytest

from pipeline.dashboard import WEEKS_SHOWN, build_dashboard, monday_of
from pipeline.models import Company, JobApplication

URL = "/api/dashboard/"
TODAY = datetime.date.today()


def days_ago(n):
    return TODAY - datetime.timedelta(days=n)


@pytest.fixture
def add(stage_of, make_application):
    """add(user, "Applied", days_ago_or_None) creates a card in that stage."""

    def _add(user, stage_name, ago=None, **extra):
        date = None if ago is None else days_ago(ago)
        return make_application(user, stage_of(user, stage_name), date_applied=date, **extra)

    return _add


def test_requires_authentication(api_client):
    assert api_client.get(URL).status_code == 401


def test_empty_account_has_zero_counts_and_a_null_rate(client_a):
    body = client_a.get(URL).json()

    assert body["totals"] == {"applications": 0, "applied": 0}
    assert [s["name"] for s in body["stages"]] == [
        "Wishlist",
        "Applied",
        "Interviewing",
        "Offer",
        "Rejected",
    ]
    assert all(s["count"] == 0 for s in body["stages"])
    assert len(body["weeks"]) == WEEKS_SHOWN
    assert all(w["count"] == 0 for w in body["weeks"])
    assert body["response_rate"] == {
        "baseline_stage": "Applied",
        "responded": 0,
        "applied": 0,
        "rate": None,
    }


def test_counts_per_stage_include_empty_stages(client_a, user_a, add):
    add(user_a, "Wishlist")
    add(user_a, "Applied", 3)
    add(user_a, "Applied", 5)
    add(user_a, "Offer", 20)

    body = client_a.get(URL).json()

    assert {s["name"]: s["count"] for s in body["stages"]} == {
        "Wishlist": 1,
        "Applied": 2,
        "Interviewing": 0,
        "Offer": 1,
        "Rejected": 0,
    }
    assert body["totals"] == {"applications": 4, "applied": 3}


def test_weeks_are_twelve_consecutive_mondays_ending_this_week(client_a):
    weeks = client_a.get(URL).json()["weeks"]

    starts = [datetime.date.fromisoformat(w["week_start"]) for w in weeks]
    assert starts[-1] == monday_of(TODAY)
    assert all(d.weekday() == 0 for d in starts)
    assert all((b - a).days == 7 for a, b in zip(starts, starts[1:], strict=False))


def test_applications_are_counted_in_the_week_they_were_sent(client_a, user_a, add):
    add(user_a, "Applied", 0)
    add(user_a, "Applied", 0)
    last_week = monday_of(TODAY) - datetime.timedelta(days=3)  # a Friday last week
    JobApplication.objects.create(
        user=user_a,
        company=Company.objects.create(user=user_a, name="Old"),
        stage=user_a.stages.get(name="Applied"),
        job_title="Old",
        date_applied=last_week,
    )

    weeks = {w["week_start"]: w["count"] for w in client_a.get(URL).json()["weeks"]}

    assert weeks[monday_of(TODAY).isoformat()] == 2
    assert weeks[monday_of(last_week).isoformat()] == 1
    assert sum(weeks.values()) == 3


def test_applications_older_than_twelve_weeks_are_not_in_the_weekly_chart(client_a, user_a, add):
    add(user_a, "Applied", 12 * 7 + 10)

    body = client_a.get(URL).json()

    assert sum(w["count"] for w in body["weeks"]) == 0
    assert body["totals"]["applied"] == 1  # but they still count toward the totals


def test_wishlist_cards_without_a_date_are_not_in_the_weekly_chart(client_a, user_a, add):
    add(user_a, "Wishlist")

    assert sum(w["count"] for w in client_a.get(URL).json()["weeks"]) == 0


def test_response_rate_counts_cards_that_moved_past_applied(client_a, user_a, add):
    add(user_a, "Applied", 2)
    add(user_a, "Applied", 4)
    add(user_a, "Interviewing", 10)
    add(user_a, "Rejected", 15)
    add(user_a, "Wishlist")  # no date: excluded from the denominator

    rate = client_a.get(URL).json()["response_rate"]

    assert rate == {"baseline_stage": "Applied", "responded": 2, "applied": 4, "rate": 0.5}


def test_rate_is_rounded_to_four_decimals(client_a, user_a, add):
    add(user_a, "Applied", 1)
    add(user_a, "Applied", 2)
    add(user_a, "Offer", 3)

    assert client_a.get(URL).json()["response_rate"]["rate"] == 0.3333


def test_baseline_falls_back_to_the_second_column_when_applied_is_renamed(client_a, user_a, add):
    applied = user_a.stages.get(name="Applied")
    add(user_a, "Applied", 2)
    add(user_a, "Interviewing", 5)
    applied.name = "Sent"
    applied.save()

    rate = client_a.get(URL).json()["response_rate"]

    assert rate["baseline_stage"] == "Sent"
    assert (rate["responded"], rate["applied"]) == (1, 2)


def test_baseline_name_match_ignores_case(client_a, user_a, add):
    user_a.stages.filter(name="Applied").update(name="APPLIED")
    add(user_a, "APPLIED", 2)
    add(user_a, "Offer", 5)

    assert client_a.get(URL).json()["response_rate"]["baseline_stage"] == "APPLIED"


def test_a_single_stage_has_no_baseline_and_a_null_rate(client_a, user_a, add):
    keep = user_a.stages.get(name="Wishlist")
    add(user_a, "Wishlist", 2)
    user_a.stages.exclude(pk=keep.pk).delete()

    rate = client_a.get(URL).json()["response_rate"]

    assert rate == {"baseline_stage": None, "responded": 0, "applied": 1, "rate": None}


def test_other_users_data_is_never_counted(client_a, user_a, user_b, add):
    add(user_a, "Applied", 2)
    for _ in range(5):
        add(user_b, "Offer", 1)

    body = client_a.get(URL).json()

    assert body["totals"] == {"applications": 1, "applied": 1}
    assert sum(w["count"] for w in body["weeks"]) == 1
    assert body["response_rate"]["responded"] == 0


def test_query_count_is_constant(client_a, user_a, add, django_assert_max_num_queries):
    with django_assert_max_num_queries(3):
        client_a.get(URL)
    for i in range(30):
        add(user_a, "Applied" if i % 2 else "Offer", i)
    with django_assert_max_num_queries(3):
        assert client_a.get(URL).json()["totals"]["applications"] == 30


def test_build_dashboard_accepts_a_fixed_today(user_a, add):
    add(user_a, "Applied", 0)
    fixed = datetime.date(2030, 1, 16)  # a Wednesday

    weeks = build_dashboard(user_a, today=fixed)["weeks"]

    assert weeks[-1]["week_start"] == datetime.date(2030, 1, 14)
    assert sum(w["count"] for w in weeks) == 0  # today's real-date card is outside that window
