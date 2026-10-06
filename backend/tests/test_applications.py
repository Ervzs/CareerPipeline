from pipeline.models import Company, JobApplication

URL = "/api/applications/"


def payload(stage, **extra):
    return {
        "stage": stage.id,
        "job_title": "Backend Engineer",
        "listing_url": "https://jobs.test/1",
        **extra,
    }


def test_applications_require_authentication(api_client):
    assert api_client.get(URL).status_code == 401


def test_create_with_existing_company(client_a, user_a, stage_of):
    company = Company.objects.create(user=user_a, name="Acme", notes="Remote friendly")
    stage = stage_of(user_a, "Wishlist")
    response = client_a.post(URL, payload(stage, company=company.id), format="json")
    assert response.status_code == 201
    body = response.json()
    assert body["company"] == company.id
    assert body["company_detail"]["name"] == "Acme"
    assert body["company_detail"]["notes"] == "Remote friendly"
    assert body["stage"] == stage.id
    assert body["date_applied"] is None
    assert JobApplication.objects.get(pk=body["id"]).user == user_a


def test_create_with_company_name_creates_company(client_a, user_a, stage_of):
    response = client_a.post(
        URL, payload(stage_of(user_a, "Applied"), company_name="  Globex "), format="json"
    )
    assert response.status_code == 201
    assert response.json()["company_detail"]["name"] == "Globex"
    assert user_a.companies.filter(name="Globex").count() == 1


def test_company_name_reuses_existing_company_case_insensitively(client_a, user_a, stage_of):
    existing = Company.objects.create(user=user_a, name="Globex")
    response = client_a.post(
        URL, payload(stage_of(user_a, "Applied"), company_name="GLOBEX"), format="json"
    )
    assert response.status_code == 201
    assert response.json()["company"] == existing.id
    assert user_a.companies.count() == 1


def test_create_without_company(client_a, user_a, stage_of):
    response = client_a.post(URL, payload(stage_of(user_a, "Applied")), format="json")
    assert response.status_code == 201
    assert response.json()["company"] is None
    assert response.json()["company_detail"] is None


def test_create_rejects_both_company_and_company_name(client_a, user_a, stage_of):
    company = Company.objects.create(user=user_a, name="Acme")
    response = client_a.post(
        URL,
        payload(stage_of(user_a, "Applied"), company=company.id, company_name="Other"),
        format="json",
    )
    assert response.status_code == 400
    assert "company" in response.json()["error"]["details"]
    assert not JobApplication.objects.exists()
    assert user_a.companies.count() == 1


def test_create_requires_listing_url(client_a, user_a, stage_of):
    response = client_a.post(
        URL, payload(stage_of(user_a, "Applied"), listing_url=""), format="json"
    )
    assert response.status_code == 400
    assert "listing_url" in response.json()["error"]["details"]


def test_create_appends_card_to_the_end_of_the_column(client_a, user_a, stage_of):
    stage = stage_of(user_a, "Applied")
    positions = [
        client_a.post(URL, payload(stage, company_name="Acme"), format="json").json()["position"]
        for _ in range(3)
    ]
    assert positions == [0, 1, 2]


def test_stage_is_required_and_dates_are_validated(client_a, stage_of, user_a):
    missing_stage = client_a.post(
        URL, {"job_title": "X", "listing_url": "https://jobs.test/1"}, format="json"
    )
    bad_date = client_a.post(
        URL,
        payload(stage_of(user_a, "Applied"), company_name="A", date_applied="nope"),
        format="json",
    )
    assert missing_stage.status_code == 400
    assert bad_date.status_code == 400


def test_retrieve_update_and_delete(client_a, user_a, stage_of, make_application):
    app = make_application(user_a, stage_of(user_a, "Applied"), title="Dev")
    detail = f"{URL}{app.id}/"
    assert client_a.get(detail).json()["job_title"] == "Dev"

    response = client_a.patch(
        detail, {"job_title": "Senior Dev", "date_applied": "2026-01-15"}, format="json"
    )
    assert response.status_code == 200
    assert response.json()["job_title"] == "Senior Dev"
    assert response.json()["date_applied"] == "2026-01-15"

    assert client_a.delete(detail).status_code == 204
    assert not JobApplication.objects.filter(pk=app.pk).exists()


def test_update_can_switch_company_by_name(client_a, user_a, stage_of, make_application):
    app = make_application(user_a, stage_of(user_a, "Applied"))
    response = client_a.patch(f"{URL}{app.id}/", {"company_name": "Initech"}, format="json")
    assert response.status_code == 200
    assert response.json()["company_detail"]["name"] == "Initech"


def test_update_can_clear_company(client_a, user_a, stage_of, make_application):
    app = make_application(user_a, stage_of(user_a, "Applied"))
    response = client_a.patch(f"{URL}{app.id}/", {"company": None}, format="json")
    assert response.status_code == 200
    assert response.json()["company_detail"] is None


def test_update_cannot_change_stage_or_position(client_a, user_a, stage_of, make_application):
    app = make_application(user_a, stage_of(user_a, "Applied"))
    other_stage = stage_of(user_a, "Offer")
    stage_before = app.stage_id
    rejected = client_a.patch(f"{URL}{app.id}/", {"stage": other_stage.id}, format="json")
    assert rejected.status_code == 400
    assert "stage" in rejected.json()["error"]["details"]

    same_stage = client_a.patch(
        f"{URL}{app.id}/", {"stage": app.stage_id, "position": 7, "job_title": "T"}, format="json"
    )
    assert same_stage.status_code == 200
    app.refresh_from_db()
    assert (app.stage_id, app.position) == (stage_before, 0)


def test_deleting_a_card_closes_the_gap(client_a, user_a, stage_of, make_application):
    stage = stage_of(user_a, "Applied")
    cards = [make_application(user_a, stage, title=f"Job {i}") for i in range(3)]
    assert client_a.delete(f"{URL}{cards[0].id}/").status_code == 204
    remaining = JobApplication.objects.filter(stage=stage).order_by("position")
    assert list(remaining.values_list("job_title", "position")) == [("Job 1", 0), ("Job 2", 1)]


def test_list_is_in_board_order_with_nested_company(client_a, user_a, stage_of, make_application):
    wishlist, applied, offer = (stage_of(user_a, n) for n in ("Wishlist", "Applied", "Offer"))
    make_application(user_a, offer, title="offer-0")
    make_application(user_a, applied, title="applied-0")
    make_application(user_a, applied, title="applied-1")
    make_application(user_a, wishlist, title="wish-0")

    body = client_a.get(URL).json()
    assert [c["job_title"] for c in body] == ["wish-0", "applied-0", "applied-1", "offer-0"]
    assert all({"stage", "position", "company_detail"} <= set(c) for c in body)


def test_list_query_count_does_not_grow_with_rows(
    client_a, user_a, stage_of, make_application, django_assert_max_num_queries
):
    stage = stage_of(user_a, "Applied")
    make_application(user_a, stage)
    with django_assert_max_num_queries(2):
        assert len(client_a.get(URL).json()) == 1

    for i in range(25):
        make_application(
            user_a,
            stage_of(user_a, "Offer"),
            title=f"t{i}",
            company=Company.objects.create(user=user_a, name=f"C{i}"),
        )
    with django_assert_max_num_queries(2):
        assert len(client_a.get(URL).json()) == 26
