"""Welche Objekte sich wie verbinden lassen — der EINZIGE Ort, der die
Domains kennt. Neue Typen kommen hier dazu, nicht in Views oder Serializern.

Sichtbarkeit (`visible`) ist dieselbe Regel wie in den Domain-APIs
(ADR-001): Organisation und Finanzen gehören einer Person (`owner`),
Haushaltsaufgaben dem Haushalt (Mitgliedschaft), Reisen ihrer Eigentümer:in
und den Teilnehmenden. Eine Verbindung erweitert diese Regeln nie."""

from dataclasses import dataclass
from decimal import Decimal
from typing import Callable

from django.db.models import Model, QuerySet
from django.utils import timezone

from connections.models import ObjectType, RelationType
from finanzen.models import SavingsGoal
from haushalt.models import Task as HouseholdTask
from organisation.models import PersonalEvent, PersonalTask
from reisen.models import Trip


def _visible_trips(user):
    # Dieselbe Regel wie die Reisen-API — bewusst von dort importiert statt
    # nachgebaut, damit beide nie auseinanderlaufen.
    from reisen.views import trips_visible_to

    return trips_visible_to(user)


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

    def summary(self, obj) -> dict:
        return {
            'type': self.key,
            'id': obj.pk,
            'title': obj.title,
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
        ObjectType.TRIP, 'Reise', 'reisen', Trip, _visible_trips, _trip_subtitle,
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
