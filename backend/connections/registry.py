"""Welche Objekte sich wie verbinden lassen — der EINZIGE Ort, der die
Domains kennt. Neue Typen kommen hier dazu, nicht in Views oder Serializern.

Sichtbarkeit (`visible`) ist dieselbe Regel wie in den Domain-APIs
(ADR-001): Organisation und Finanzen gehören einer Person (`owner`),
Haushaltsaufgaben dem Haushalt (Mitgliedschaft), Reisen ihrer Eigentümer:in
und den Teilnehmenden. Eine Verbindung erweitert diese Regeln nie.

Verknüpfen und Lösen ist Schreiben (`editable`): dieselbe Regel wie beim
Bearbeiten des Objekts in seiner Domain. Bei Reisen heißt das Ersteller:in
oder Teilnehmende mit Rolle OWNER/EDITOR (reisen.permissions) — eine reine
VIEWER-Teilnahme darf die Reise sehen, aber nichts an sie hängen."""

from dataclasses import dataclass
from decimal import Decimal
from typing import Callable

from django.db.models import Model, QuerySet
from django.utils import timezone

from connections.models import ObjectType, RelationType
from finanzen.models import SavingsGoal
from core.models import HouseholdMembership
from haushalt.models import FolderEntry, Task as HouseholdTask
from organisation.models import PersonalEvent, PersonalTask
from reisen.models import Trip


def _visible_trips(user):
    # Dieselbe Regel wie die Reisen-API — bewusst von dort importiert statt
    # nachgebaut, damit beide nie auseinanderlaufen.
    from reisen.views import trips_visible_to

    return trips_visible_to(user)


def _editable_trips(user):
    # Wie reisen.permissions.TripContentAccessPermission für Schreibzugriffe.
    from django.db.models import Q

    from reisen.permissions import WRITABLE_ROLES

    return Trip.objects.filter(
        Q(owner=user) | Q(participants__user=user, participants__role__in=WRITABLE_ROLES)
    ).distinct()


def _date(value) -> str:
    return value.strftime('%d.%m.%Y')


def _euro(value: Decimal) -> str:
    text = f'{value:,.2f}'.replace(',', 'X').replace('.', ',').replace('X', '.')
    return f'{text} €'


def _task_subtitle(task: PersonalTask) -> str:
    if task.status == PersonalTask.Status.DONE:
        return 'Erledigt'
    if not task.due_date:
        return 'Ohne Datum'
    when = _date(task.due_date)
    return f'Fällig {when}, {task.due_time:%H:%M} Uhr' if task.due_time else f'Fällig {when}'


def _event_subtitle(event: PersonalEvent) -> str:
    start = timezone.localtime(event.starts_at)
    return f'{_date(start)}, {start:%H:%M} Uhr'


def _goal_subtitle(goal: SavingsGoal) -> str:
    return f'{_euro(goal.current_amount)} von {_euro(goal.target_amount)}'


def _household_task_subtitle(task: HouseholdTask) -> str:
    if task.is_done:
        return 'Erledigt'
    return f'Fällig {_date(task.due_date)}' if task.due_date else 'Ohne Datum'


def _folder_entries(kind: str):
    """Haushaltsordner wie in der Haushalt-API: Mitglieder des Haushalts, aber keine Kind-Konten
    (haushalt.views.NoChildAccount — der Ordner enthält Vertragskosten)."""

    def visible(user):
        adult_households = HouseholdMembership.objects.filter(user=user).exclude(
            role=HouseholdMembership.Role.CHILD_ACCOUNT
        ).values('household')
        return FolderEntry.objects.filter(kind=kind, household__in=adult_households)

    return visible


def _device_subtitle(entry: FolderEntry) -> str:
    # Keine Kosten in der Vorschau — nur, was das Gerät beschreibt.
    parts = [part for part in (entry.provider, entry.model) if part]
    return ' · '.join(parts) or entry.get_status_display()


def _contract_subtitle(entry: FolderEntry) -> str:
    return entry.provider or entry.category or entry.get_status_display()


def _trip_subtitle(trip: Trip) -> str:
    when = f'{_date(trip.start_date)} – {_date(trip.end_date)}'
    return f'{trip.destination}, {when}' if trip.destination else when


@dataclass(frozen=True)
class Kind:
    key: str
    label: str
    domain: str
    model: type[Model]
    visible: Callable[[object], QuerySet]
    subtitle: Callable[[Model], str]
    # Was der Nutzer verknüpfen/lösen darf; ohne Angabe dasselbe wie `visible`
    # (eigene Objekte bzw. Haushaltsaufgaben, die jedes Mitglied bearbeiten darf).
    editable: Callable[[object], QuerySet] | None = None
    # Feld mit dem Namen (für Anzeige und Suche) und fester Grundfilter, falls sich mehrere
    # Arten ein Modell teilen (Gerät und Vertrag liegen beide in FolderEntry).
    title_field: str = 'title'
    base_filter: tuple[tuple[str, object], ...] = ()

    def editable_for(self, user) -> QuerySet:
        return (self.editable or self.visible)(user)

    def base(self) -> QuerySet:
        """Alle Objekte dieser Art, ohne Rechteprüfung — nur zum Aufräumen von Waisen."""
        return self.model.objects.filter(**dict(self.base_filter))

    def title_of(self, obj) -> str:
        return getattr(obj, self.title_field)

    def summary(self, obj) -> dict:
        return {
            'type': self.key,
            'id': obj.pk,
            'title': self.title_of(obj),
            'subtitle': self.subtitle(obj),
            'domain': self.domain,
        }


KINDS: dict[str, Kind] = {
    ObjectType.TASK: Kind(
        ObjectType.TASK, 'Aufgabe', 'organisation', PersonalTask,
        lambda user: PersonalTask.objects.filter(owner=user), _task_subtitle,
    ),
    ObjectType.CALENDAR_EVENT: Kind(
        ObjectType.CALENDAR_EVENT, 'Termin', 'organisation', PersonalEvent,
        lambda user: PersonalEvent.objects.filter(owner=user), _event_subtitle,
    ),
    ObjectType.SAVINGS_GOAL: Kind(
        ObjectType.SAVINGS_GOAL, 'Sparziel', 'finanzen', SavingsGoal,
        lambda user: SavingsGoal.objects.filter(owner=user), _goal_subtitle,
    ),
    ObjectType.HOUSEHOLD_TASK: Kind(
        ObjectType.HOUSEHOLD_TASK, 'Haushaltsaufgabe', 'haushalt', HouseholdTask,
        lambda user: HouseholdTask.objects.filter(household__members=user), _household_task_subtitle,
    ),
    ObjectType.TRIP: Kind(
        ObjectType.TRIP, 'Reise', 'reisen', Trip, _visible_trips, _trip_subtitle, _editable_trips,
    ),
    ObjectType.DEVICE: Kind(
        ObjectType.DEVICE, 'Gerät', 'haushalt', FolderEntry, _folder_entries(FolderEntry.Kind.DEVICE),
        _device_subtitle, title_field='name', base_filter=(('kind', FolderEntry.Kind.DEVICE),),
    ),
    ObjectType.CONTRACT: Kind(
        ObjectType.CONTRACT, 'Vertrag', 'haushalt', FolderEntry, _folder_entries(FolderEntry.Kind.CONTRACT),
        _contract_subtitle, title_field='name', base_filter=(('kind', FolderEntry.Kind.CONTRACT),),
    ),
}

# Erlaubte Paare in der festen Richtung (Quelle, Ziel) → erlaubte Relationen,
# die erste ist der Standard. Bewusst nur wenige konkrete Beziehungen.
ALLOWED_PAIRS: dict[tuple[str, str], tuple[str, ...]] = {
    (ObjectType.SAVINGS_GOAL, ObjectType.TASK): (RelationType.TASK_FOR, RelationType.RELATED_TO),
    (ObjectType.TASK, ObjectType.CALENDAR_EVENT): (RelationType.SCHEDULED_AS, RelationType.RELATED_TO),
    (ObjectType.HOUSEHOLD_TASK, ObjectType.CALENDAR_EVENT): (RelationType.SCHEDULED_AS, RelationType.RELATED_TO),
    # „Reise planen“: Wovon wird sie bezahlt, und was im Haushalt betrifft sie?
    (ObjectType.TRIP, ObjectType.SAVINGS_GOAL): (RelationType.FUNDED_BY, RelationType.RELATED_TO),
    (ObjectType.TRIP, ObjectType.HOUSEHOLD_TASK): (RelationType.AFFECTS, RelationType.RELATED_TO),
    # Suggestions V1: Reise ↔ eigene Aufgabe/Termin, Gerät ↔ Sparziel, Vertrag ↔ Aufgabe.
    (ObjectType.TRIP, ObjectType.TASK): (RelationType.TASK_FOR, RelationType.RELATED_TO),
    (ObjectType.TRIP, ObjectType.CALENDAR_EVENT): (RelationType.SCHEDULED_AS, RelationType.RELATED_TO),
    (ObjectType.DEVICE, ObjectType.SAVINGS_GOAL): (RelationType.FUNDED_BY, RelationType.RELATED_TO),
    (ObjectType.CONTRACT, ObjectType.TASK): (RelationType.TASK_FOR, RelationType.RELATED_TO),
}


def canonical_pair(type_a: str, type_b: str) -> tuple[str, str] | None:
    """Die Richtung, in der das Paar gespeichert wird; None = nicht erlaubt."""
    if (type_a, type_b) in ALLOWED_PAIRS:
        return type_a, type_b
    if (type_b, type_a) in ALLOWED_PAIRS:
        return type_b, type_a
    return None


def partner_types(object_type: str) -> list[str]:
    """Womit sich dieser Typ verbinden lässt."""
    partners = []
    for source, target in ALLOWED_PAIRS:
        if source == object_type:
            partners.append(target)
        elif target == object_type:
            partners.append(source)
    return partners
