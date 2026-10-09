"""Fachlogik der Organisation: Termine eines Zeitraums (mit Wiederholungen),
das Erledigen wiederkehrender Aufgaben und die Kennzahlen für das Dashboard.
Alles nur für die eigene Person — der Eigentümer wird immer mitgegeben."""

from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers

from core.recurrence import SIMPLE, next_after, occurrences
from .models import PersonalEvent, PersonalTask

# Höchstens so viele Tage auf einmal — der Kalender lädt nie Jahre.
MAX_RANGE_DAYS = 400


def zone(tz_name: str) -> ZoneInfo:
    try:
        return ZoneInfo(tz_name)
    except (ZoneInfoNotFoundError, ValueError, TypeError):
        raise serializers.ValidationError({'timezone': 'Unbekannte Zeitzone.'})


def events_between(user, start: date, end: date, tz: ZoneInfo) -> list[dict]:
    """Alle Termine, die den Bereich [start, end] (Tage, einschließlich) berühren —
    wiederkehrende einmal pro Vorkommen. Jeder Eintrag: (event, occ_start, occ_end)."""
    lower = datetime.combine(start, time.min, tzinfo=tz)
    upper = datetime.combine(end + timedelta(days=1), time.min, tzinfo=tz)
    rows = []
    single = PersonalEvent.objects.filter(owner=user, recurrence='', starts_at__lt=upper).filter(
        Q(starts_at__gte=lower) | Q(ends_at__gte=lower)
    )
    for event in single:
        rows.append((event, event.starts_at, event.ends_at))
    for event in PersonalEvent.objects.filter(owner=user, starts_at__lt=upper).exclude(recurrence=''):
        days, months = SIMPLE[event.recurrence]
        first = event.starts_at.astimezone(tz)
        length = (event.ends_at - event.starts_at) if event.ends_at else None
        # Mehrtägige Vorkommen, die vor `start` beginnen, ragen evtl. hinein.
        reach = (length.days + 1) if length else 0
        for day in occurrences(first.date(), days, months, start - timedelta(days=reach), end):
            occ_start = datetime.combine(day, first.timetz())
            occ_end = occ_start + length if length else None
            if occ_start < upper and (occ_start >= lower or (occ_end and occ_end >= lower)):
                rows.append((event, occ_start, occ_end))
    rows.sort(key=lambda row: (row[1], row[0].pk))
    return rows


def complete_task(task: PersonalTask) -> PersonalTask:
    """Wiederkehrend: Fälligkeit rückt im Rhythmus weiter, die Aufgabe bleibt offen.
    Einmalig: erledigt."""
    task.last_done_at = timezone.now()
    if task.recurrence_days or task.recurrence_months:
        today = timezone.localdate()
        task.due_date = next_after(task.due_date or today, task.recurrence_days, task.recurrence_months, today)
        task.status = PersonalTask.Status.OPEN
    else:
        task.status = PersonalTask.Status.DONE
    task.save()
    return task


def summary(user, tz_name: str) -> dict:
    """Kennzahlen für das Dashboard in einer Antwort."""
    tz = zone(tz_name)
    today = timezone.now().astimezone(tz).date()
    open_tasks = PersonalTask.objects.filter(owner=user).exclude(status=PersonalTask.Status.DONE)
    return {
        'date': today.isoformat(),
        'events_today': len(events_between(user, today, today, tz)),
        'tasks_today': open_tasks.filter(due_date=today).count(),
        'overdue_tasks': open_tasks.filter(due_date__lt=today).count(),
    }
