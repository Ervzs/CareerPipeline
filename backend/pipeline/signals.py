from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver

from .services import create_default_stages


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def add_default_stages(sender, instance, created, **kwargs):
    if created:
        create_default_stages(instance)
