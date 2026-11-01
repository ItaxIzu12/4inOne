"""Gespeicherte Dateien von Ordner-Anhängen nach dem Löschen entfernen (auch beim Löschen von Eintrag/Haushalt)."""
from django.db import transaction
from django.db.models.signals import post_delete
from django.dispatch import receiver

from .models import FolderAttachment


@receiver(post_delete, sender=FolderAttachment)
def remove_folder_file(sender, instance, using, **kwargs):
    if instance.file.name:
        storage, name = instance.file.storage, instance.file.name
        transaction.on_commit(lambda: storage.delete(name), using=using)
