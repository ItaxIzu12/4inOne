"""Private Dateien auch bei Konto-/Queryset-Löschungen nach Commit entfernen."""
from django.db import transaction
from django.db.models.signals import post_delete
from django.dispatch import receiver

from .models import PersonalFile


@receiver(post_delete, sender=PersonalFile)
def remove_private_file(sender, instance, using, **kwargs):
    if instance.file.name:
        storage, name = instance.file.storage, instance.file.name
        transaction.on_commit(lambda: storage.delete(name), using=using)
