import datetime

import pytest
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management import call_command

from pipeline.models import Company, JobApplication

User = get_user_model()


def snapshot(user):
    return {
        "stages": list(user.stages.values_list("name", "order")),
        "companies": sorted(user.companies.values_list("name", flat=True)),
        "applications": sorted(
            user.applications.values_list("job_title", "stage__name", "position", "date_applied")
        ),
    }


@pytest.mark.django_db
def test_seed_demo_creates_account_with_data_in_every_stage():
    call_command("seed_demo")
    demo = User.objects.get(email=settings.DEMO_EMAIL)
    assert demo.check_password(settings.DEMO_PASSWORD)
    assert demo.companies.count() >= 8
    assert demo.applications.count() >= 15
    for stage in demo.stages.all():
        assert stage.applications.exists(), f"{stage.name} has no cards"


@pytest.mark.django_db
def test_seed_demo_dates_are_believable():
    call_command("seed_demo")
    demo = User.objects.get(email=settings.DEMO_EMAIL)
    today = datetime.date.today()
    wishlist = demo.applications.filter(stage__name="Wishlist")
    assert wishlist.exists()
    assert all(app.date_applied is None for app in wishlist)
    applied = demo.applications.exclude(stage__name="Wishlist")
    assert all(app.date_applied is not None for app in applied)
    assert all(today - datetime.timedelta(days=90) <= app.date_applied <= today for app in applied)


@pytest.mark.django_db
def test_seed_demo_positions_are_contiguous_per_column():
    call_command("seed_demo")
    demo = User.objects.get(email=settings.DEMO_EMAIL)
    for stage in demo.stages.all():
        positions = list(stage.applications.order_by("position").values_list("position", flat=True))
        assert positions == list(range(len(positions)))


@pytest.mark.django_db
def test_seed_demo_is_idempotent():
    call_command("seed_demo")
    first = snapshot(User.objects.get(email=settings.DEMO_EMAIL))
    call_command("seed_demo")
    demo = User.objects.get(email=settings.DEMO_EMAIL)
    assert snapshot(demo) == first
    assert User.objects.filter(email=settings.DEMO_EMAIL).count() == 1
    assert demo.stages.count() == 5


@pytest.mark.django_db
def test_seed_demo_resets_changes_made_to_the_demo_account():
    call_command("seed_demo")
    demo = User.objects.get(email=settings.DEMO_EMAIL)
    demo.set_password("changed-by-a-visitor-1")
    demo.save()
    demo.stages.create(name="Extra", order=9)
    demo.applications.all().first().delete()

    call_command("seed_demo")
    demo = User.objects.get(email=settings.DEMO_EMAIL)
    assert demo.check_password(settings.DEMO_PASSWORD)
    assert not demo.stages.filter(name="Extra").exists()
    assert demo.applications.count() >= 15


@pytest.mark.django_db
def test_seed_demo_does_not_touch_other_users(user_a, stage_of, make_application):
    make_application(user_a, stage_of(user_a, "Applied"), title="Keep me")
    before = (
        snapshot(user_a),
        Company.objects.filter(user=user_a).count(),
        JobApplication.objects.filter(user=user_a).count(),
    )
    call_command("seed_demo")
    call_command("seed_demo")
    after = (
        snapshot(user_a),
        Company.objects.filter(user=user_a).count(),
        JobApplication.objects.filter(user=user_a).count(),
    )
    assert after == before
