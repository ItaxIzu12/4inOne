"""„Passt dazu“ beim manuellen Verknüpfen (connections/relevance.py) – dieselben Fälle wie im Frontend
(frontend/src/app/shared/connections/connection-relevance.spec.ts), damit Demo und Konto gleich entscheiden."""

from datetime import date, datetime
from types import SimpleNamespace as O

from django.utils import timezone

from connections.models import ObjectType as T
from connections.relevance import fits

TRIP = O(title='Berlin Wochenende', destination='Berlin, Deutschland', start_date=date(2026, 11, 25), end_date=date(2026, 11, 27))


def goal(title, target_date=None):
    return O(title=title, target_date=target_date)


def event(title, day):
    return O(title=title, starts_at=timezone.make_aware(datetime(day.year, day.month, day.day, 11, 0)))


def task(title, due=None):
    return O(title=title, due_date=due)


def test_trip_and_savings_goal():
    assert fits(T.TRIP, TRIP, T.SAVINGS_GOAL, goal('Badmintonschuhe')) is False
    assert fits(T.TRIP, TRIP, T.SAVINGS_GOAL, goal('Reisekasse Berlin')) is True
    assert fits(T.TRIP, TRIP, T.SAVINGS_GOAL, goal('Urlaubskasse')) is True
    assert fits(T.TRIP, TRIP, T.SAVINGS_GOAL, goal('Notgroschen', date(2026, 10, 1))) is True
    assert fits(T.TRIP, TRIP, T.SAVINGS_GOAL, goal('Wohnung', date(2029, 1, 1))) is False


def test_trip_and_event_or_task():
    assert fits(T.TRIP, TRIP, T.CALENDAR_EVENT, event('Museumsinsel-Führung', date(2026, 11, 26))) is True
    assert fits(T.TRIP, TRIP, T.CALENDAR_EVENT, event('Zahnarzt', date(2027, 1, 10))) is False
    assert fits(T.TRIP, TRIP, T.TASK, task('Bahn-Tickets ausdrucken')) is True
    assert fits(T.TRIP, TRIP, T.TASK, task('Steuer machen', date(2026, 11, 10))) is True
    assert fits(T.TRIP, TRIP, T.TASK, task('Steuer machen', date(2027, 3, 1))) is False


def test_trip_and_household_task_in_both_directions():
    plants = O(title='Pflanzen gießen', due_date=None, recurrence_days=1, recurrence_months=None)
    cellar = O(title='Keller aufräumen', due_date=date(2027, 2, 1), recurrence_days=None, recurrence_months=None)
    assert fits(T.TRIP, TRIP, T.HOUSEHOLD_TASK, plants) is True
    assert fits(T.HOUSEHOLD_TASK, cellar, T.TRIP, TRIP) is False


def test_contract_device_and_task_event_pairs():
    contract = O(name='Internet & Telefon', provider='Telekom')
    assert fits(T.CONTRACT, contract, T.TASK, task('Telekom Hotline anrufen')) is True
    assert fits(T.CONTRACT, contract, T.TASK, task('Tarif wechseln')) is True
    assert fits(T.CONTRACT, contract, T.TASK, task('Geschenk kaufen')) is False
    assert fits(T.DEVICE, O(name='Waschmaschine', provider='Miele'), T.SAVINGS_GOAL, goal('Neue Waschmaschine')) is True
    assert fits(T.TASK, task('Arzttermin vorbereiten', date(2026, 11, 20)), T.CALENDAR_EVENT, event('Zahnarzt', date(2026, 11, 20))) is True
