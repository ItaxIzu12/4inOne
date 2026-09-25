"""Ohne Fremdschlüssel gibt es kein ON DELETE CASCADE — deshalb räumen wir
Verbindungen auf, sobald eines der verbundenen Objekte gelöscht wird (auch bei
kaskadierenden Löschungen, etwa wenn ein Konto entfernt wird)."""

from django.db.models import Q
from django.db.models.signals import post_delete
from django.dispatch import receiver

from connections.models import Connection
from connections.registry import KINDS


def _remove_connections(kind_key: str):
    def handler(sender, instance, **kwargs):
        Connection.objects.filter(
            Q(source_type=kind_key, source_id=instance.pk) | Q(target_type=kind_key, target_id=instance.pk)
        ).delete()

    return handler


for _key, _kind in KINDS.items():
    post_delete.connect(_remove_connections(_key), sender=_kind.model, weak=False, dispatch_uid=f'connections-{_key}')
