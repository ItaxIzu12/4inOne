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
        # Gerät und Vertrag teilen sich ein Modell: nur die eigene Art aufräumen.
        if any(getattr(instance, field) != value for field, value in KINDS[kind_key].base_filter):
            return
        Connection.objects.filter(
            Q(source_type=kind_key, source_id=instance.pk) | Q(target_type=kind_key, target_id=instance.pk)
        ).delete()

    return handler


for _key, _kind in KINDS.items():
    post_delete.connect(_remove_connections(_key), sender=_kind.model, weak=False, dispatch_uid=f'connections-{_key}')


# Connection Engine V2: abgeleitete Verbindungen hängen an ihrer Quelle — wird sie gelöscht, verschwinden sie (mit
# Protokolleintrag „Quelle gelöscht“). Echte Buchungen, Termine und Aufgaben sind davon nie betroffen.
def _remove_auto_links(kinds, only_kind=None):
    def handler(sender, instance, **kwargs):
        if only_kind is not None and getattr(instance, 'kind', None) != only_kind:
            return
        from connections import auto_links

        auto_links.remove_for_source(kinds, instance.pk)

    return handler


def _connect_auto_link_cleanup():
    from core.models import Household
    from finanzen.models import SavingsGoal
    from haushalt.models import FolderEntry
    from reisen.models import Trip
    from connections.models import AutoKind

    post_delete.connect(_remove_auto_links([AutoKind.CONTRACT_FINANCE, AutoKind.CONTRACT_REMINDER], FolderEntry.Kind.CONTRACT),
                        sender=FolderEntry, weak=False, dispatch_uid='auto-links-contract')
    post_delete.connect(_remove_auto_links([AutoKind.DEVICE_MAINTENANCE], FolderEntry.Kind.DEVICE),
                        sender=FolderEntry, weak=False, dispatch_uid='auto-links-device')
    post_delete.connect(_remove_auto_links([AutoKind.TRIP_CALENDAR, AutoKind.TRIP_ITINERARY]), sender=Trip, weak=False, dispatch_uid='auto-links-trip')
    post_delete.connect(_remove_auto_links([AutoKind.SAVINGS_REMINDER]), sender=SavingsGoal, weak=False, dispatch_uid='auto-links-goal')
    post_delete.connect(_remove_auto_links([AutoKind.HOUSEHOLD_TASKS]), sender=Household, weak=False, dispatch_uid='auto-links-household')


_connect_auto_link_cleanup()
