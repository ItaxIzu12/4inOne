"""Reise-Ansichten, die mehr als nur die Reise lesen — „Erinnerungen“ und „Sparbetrag“.

Wie suggestions.py nach ADR-001: Die Reise selbst sieht jede Person mit Zugriff (registry.KINDS). Alles aus
anderen Bereichen kommt ausschließlich aus den EIGENEN Daten der anfragenden Person:

- Haushalt: fällige Aufgaben ihres Haushalts, die ihr oder niemandem zugeteilt sind (wie „Heute“).
- Organisation: ihre eigenen Termine und Aufgaben.
- Finanzen: nur ihre eigenen, mit der Reise verknüpften Sparziele.

Eine Mitreisende sieht also die Reise-Erinnerungen, aber nie Haushalt, Termine oder Sparziele der anderen.
Nichts wird gespeichert oder kopiert, alles wird beim Aufruf gelesen."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta

from django.db.models import Q
from django.utils import timezone

from connections.models import ObjectType
from connections.suggestions import _connected_ids, _visible_trip, occurs_between
from finanzen.models import SavingsGoal
from haushalt import services as haushalt_services
from haushalt.models import Task as HouseholdTask
from organisation.models import PersonalEvent, PersonalTask
from reisen.models import Trip

# Was zu Hause oder im Kalender ansteht, zählt ab einer Woche vor der Abreise bis zum letzten Reisetag.
LEAD_DAYS = 7


def _hhmm(value: time | None) -> str | None:
    return value.strftime('%H:%M') if value else None


def _item(key, source, area, title, day: date | None, at: time | None, place='', done=False, ref=None) -> dict:
    return {
        'key': key,
        'source': source,
        'area': area,
        'id': ref,
        'title': title,
        'date': day.isoformat() if day else None,
        'time': _hhmm(at),
        'place': place,
        'done': done,
    }


def _trip_items(trip: Trip) -> list[dict]:
    items = [
        _item(f'trip-task:{task.pk}', 'TRIP_TASK', 'REISEN', task.title, task.due_date, task.due_time,
              trip.title, task.status == task.Status.DONE, task.pk)
        for task in trip.triptasks.all()
    ]
    for event in trip.tripevents.all():
        local = timezone.localtime(event.starts_at)
        items.append(_item(f'trip-event:{event.pk}', 'TRIP_EVENT', 'REISEN', event.title, local.date(), local.time(),
                           event.location or trip.title, False, event.pk))
    return items


def _household_items(user, start: date, end: date) -> list[dict]:
    membership = haushalt_services.membership_for(user)
    if membership is None:
        return []
    tasks = (
        HouseholdTask.objects.filter(
            household=membership.household, is_done=False, is_paused=False, due_date__isnull=False, due_date__lte=end
        )
        .filter(Q(assigned_to=user) | Q(assigned_to__isnull=True))
        .order_by('due_date', 'id')
    )
    items = []
    for task in tasks:
        hit = occurs_between(task, start, end)
        if hit is not None:
            items.append(_item(f'household-task:{task.pk}', 'HOUSEHOLD_TASK', 'HAUSHALT', task.title, hit,
                               task.due_time, 'Zuhause', False, task.pk))
    return items


def _organisation_items(user, start: date, end: date) -> list[dict]:
    tz = timezone.get_current_timezone()
    first = datetime.combine(start, time.min, tzinfo=tz)
    after = datetime.combine(end + timedelta(days=1), time.min, tzinfo=tz)
    items = []
    for event in PersonalEvent.objects.filter(owner=user, starts_at__gte=first, starts_at__lt=after):
        local = timezone.localtime(event.starts_at)
        items.append(_item(f'org-event:{event.pk}', 'ORG_EVENT', 'ORGANISATION', event.title, local.date(),
                           local.time(), event.location, False, event.pk))
    tasks = PersonalTask.objects.filter(owner=user, due_date__gte=start, due_date__lte=end).exclude(
        status=PersonalTask.Status.DONE
    )
    for task in tasks:
        items.append(_item(f'org-task:{task.pk}', 'ORG_TASK', 'ORGANISATION', task.title, task.due_date,
                           task.due_time, '', False, task.pk))
    return items


def reminders(user, trip_id: int) -> dict:
    trip = _visible_trip(user, trip_id)
    today = timezone.localdate()
    start = max(today, trip.start_date - timedelta(days=LEAD_DAYS))
    items = _trip_items(trip)
    if trip.end_date >= start:
        items += _household_items(user, start, trip.end_date)
        items += _organisation_items(user, start, trip.end_date)
    # Ohne Datum ans Ende, sonst nach Tag, Uhrzeit (ganztägig zuerst) und Titel.
    items.sort(key=lambda i: (i['date'] is None, i['date'] or '', i['time'] or '', i['title'].lower()))
    return {'window_start': start.isoformat(), 'window_end': trip.end_date.isoformat(), 'items': items}


def savings(user, trip_id: int) -> list[dict]:
    trip = _visible_trip(user, trip_id)
    goals = SavingsGoal.objects.filter(owner=user, pk__in=_connected_ids(trip, ObjectType.SAVINGS_GOAL)).order_by('id')
    return [
        {
            'id': goal.pk,
            'title': goal.title,
            'current_amount': str(goal.current_amount),
            'target_amount': str(goal.target_amount),
        }
        for goal in goals
    ]
