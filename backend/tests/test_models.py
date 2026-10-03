import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction

from pipeline.models import PipelineStage

User = get_user_model()


@pytest.mark.django_db
def test_new_user_gets_default_stages_in_order():
    user = User.objects.create_user(email="new@example.com", password="pw-123456789")
    names = list(user.stages.values_list("name", flat=True))
    assert names == ["Wishlist", "Applied", "Interviewing", "Offer", "Rejected"]
    assert list(user.stages.values_list("order", flat=True)) == [0, 1, 2, 3, 4]


@pytest.mark.django_db
def test_stage_names_unique_per_user_but_not_across_users():
    a = User.objects.create_user(email="a@example.com", password="pw-123456789")
    b = User.objects.create_user(email="b@example.com", password="pw-123456789")
    with pytest.raises(IntegrityError), transaction.atomic():
        PipelineStage.objects.create(user=a, name="Applied", order=9)
    assert PipelineStage.objects.filter(name="Applied").count() == 2
    assert b.stages.filter(name="Applied").exists()
