"""Passt ein Eintrag zum Objekt, das man gerade verknüpft? (13.11.2026)

Die Auswahl beim manuellen Verknüpfen zeigte bisher ALLE Einträge des Zieltyps – für die Reise „Berlin“ also auch
das Sparziel „Badmintonschuhe“. Hier steht je Arten-Paar, woran man erkennt, dass etwas zusammengehört. Bewusst
großzügiger als die Vorschläge (link_suggestions.py): Es ordnet nur die Auswahl, es schlägt nichts selbst vor.
Unpassendes bleibt über die Suche erreichbar – verknüpfen darf man alles, was die Regeln erlauben.
"""

from __future__ import annotations

from datetime import date, timedelta

from django.utils import timezone

from connections.link_suggestions import (
    CONTRACT_WORDS, DEVICE_WORDS, TRAVEL_WORDS, TRIP_CONTRACT_PARTS, TRIP_GOAL_WORDS, _flags, _fold, match_word, words,
)
from connections.models import ObjectType

GOAL_LEAD_DAYS = 180   # Sparziel mit Zieldatum bis ein halbes Jahr vor der Reise
TASK_LEAD_DAYS = 30    # Aufgabe bis 30 Tage vor der Reise fällig
EVENT_MARGIN_DAYS = 1  # Anreise am Vortag, Rückfahrt am Tag danach


def _title(object_type: str, obj) -> str:
    if object_type in (ObjectType.DEVICE, ObjectType.CONTRACT):
        return f'{obj.name} {getattr(obj, "provider", "") or ""}'
    if object_type == ObjectType.TRIP:
        return f'{obj.title} {obj.destination}'
    return getattr(obj, 'title', '') or ''


def _day(object_type: str, obj) -> date | None:
    if object_type == ObjectType.CALENDAR_EVENT:
        return timezone.localtime(obj.starts_at).date() if obj.starts_at else None
    if object_type == ObjectType.SAVINGS_GOAL:
        return obj.target_date
    return getattr(obj, 'due_date', None)


def _shares_word(a: str, b: str) -> bool:
    return match_word(words(a, 3), words(b, 3)) is not None


def _trip_fit(trip, other_type: str, other) -> bool:
    title = _title(other_type, other)
    day = _day(other_type, other)
    near = lambda lead, margin=0: day is not None and trip.start_date - timedelta(days=lead) <= day <= trip.end_date + timedelta(days=margin)  # noqa: E731
    if _shares_word(_title(ObjectType.TRIP, trip), title):
        return True
    if other_type == ObjectType.SAVINGS_GOAL:
        return _flags(title, TRIP_GOAL_WORDS) or near(GOAL_LEAD_DAYS)
    if other_type == ObjectType.TASK:
        return _flags(title, TRAVEL_WORDS) or near(TASK_LEAD_DAYS, 1)
    if other_type == ObjectType.CALENDAR_EVENT:
        return near(EVENT_MARGIN_DAYS, EVENT_MARGIN_DAYS)
    if other_type == ObjectType.CONTRACT:
        # Reiseversicherung, Auslands-Krankenversicherung, Mietwagen – auch als Teil eines längeren Wortes
        return any(part in _fold(title) for part in TRIP_CONTRACT_PARTS)
    if other_type == ObjectType.HOUSEHOLD_TASK:
        # Was zuhause weiterläuft, während man weg ist (Pflanzen gießen), oder in der Reisezeit fällig wird
        return bool(getattr(other, 'recurrence_days', None) or getattr(other, 'recurrence_months', None)) or near(0)
    return False


def fits(object_type: str, obj, other_type: str, other, other_devices: tuple[str, ...] = ()) -> bool:
    """True, wenn `other` erkennbar zu `obj` passt (Reihenfolge der Typen egal). `other_devices`: Namen der ANDEREN
    Geräte im Haushalt – „Kühlschrank reinigen“ ist Pflege, aber nicht für die Waschmaschine."""
    if object_type == ObjectType.TRIP:
        return _trip_fit(obj, other_type, other)
    if other_type == ObjectType.TRIP:
        return _trip_fit(other, object_type, obj)
    a, b = _title(object_type, obj), _title(other_type, other)
    pair = {object_type, other_type}
    if pair == {ObjectType.CONTRACT, ObjectType.TASK}:
        task = b if other_type == ObjectType.TASK else a
        return _shares_word(a, b) or _flags(task, CONTRACT_WORDS)
    if pair in ({ObjectType.DEVICE, ObjectType.HOUSEHOLD_TASK}, {ObjectType.DEVICE, ObjectType.TASK}):
        task = b if object_type == ObjectType.DEVICE else a
        if _shares_word(a, b):
            return True
        return _flags(task, DEVICE_WORDS) and not any(_shares_word(name, task) for name in other_devices)
    if pair in ({ObjectType.TASK, ObjectType.CALENDAR_EVENT}, {ObjectType.HOUSEHOLD_TASK, ObjectType.CALENDAR_EVENT}):
        day_a, day_b = _day(object_type, obj), _day(other_type, other)
        return _shares_word(a, b) or (day_a is not None and day_a == day_b)
    # Gerät ↔ Sparziel, Sparziel ↔ Aufgabe: dasselbe Stichwort („Waschmaschine“, „Badmintonschuhe“)
    return _shares_word(a, b)
