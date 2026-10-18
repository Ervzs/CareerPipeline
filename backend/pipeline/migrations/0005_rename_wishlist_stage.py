from django.db import migrations


def rename_wishlist(apps, schema_editor):
    """Rename existing users' "Wishlist" stage to "Interested" (skip users who already have one)."""
    PipelineStage = apps.get_model("pipeline", "PipelineStage")
    taken = PipelineStage.objects.filter(name="Interested").values("user")
    PipelineStage.objects.filter(name="Wishlist").exclude(user__in=taken).update(name="Interested")


class Migration(migrations.Migration):
    dependencies = [
        ("pipeline", "0004_listing_url_any_length"),
    ]

    operations = [
        migrations.RunPython(rename_wishlist, migrations.RunPython.noop),
    ]
