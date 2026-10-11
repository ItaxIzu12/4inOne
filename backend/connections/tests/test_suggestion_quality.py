"""Qualitäts-Audit der Verknüpfungs-Vorschläge mit realistischen Daten.

Jeder Fall ist eingeordnet:
- HELPFUL  — eindeutig hilfreich: MUSS vorgeschlagen werden.
- MAYBE    — möglicherweise hilfreich: darf, muss aber nicht.
- WRONG    — störend oder falsch: darf NIE vorgeschlagen werden.

Produktregel: lieber kein Vorschlag als ein schlechter. Neue Regeln oder Wortlisten müssen diesen Katalog bestehen."""

from datetime import datetime, time, timedelta
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone

from connections import link_suggestions
from core.models import Household, HouseholdMembership
from finanzen.models import SavingsGoal
from haushalt.models import FolderEntry
from organisation.models import PersonalEvent, PersonalTask
from reisen.models import Trip

pytestmark = pytest.mark.django_db

HELPFUL, MAYBE, WRONG = 'HELPFUL', 'MAYBE', 'WRONG'


@pytest.fixture
def anna():
    user = get_user_model().objects.create_user(username='anna', email='anna@example.com', password='x')
    home = Household.objects.create(name='Zuhause')
    HouseholdMembership.objects.create(user=user, household=home)
    user.home = home
    return user


def _start():
    return timezone.localdate() + timedelta(days=40)


def _trip(user, destination='Berlin', title='Städtetrip', days=4):
    start = _start()
    return Trip.objects.create(owner=user, title=title, destination=destination, start_date=start,
                               end_date=start + timedelta(days=days))


def _offset(days):
    return _start() + timedelta(days=days)


def _event(user, title, day, location=''):
    return PersonalEvent.objects.create(owner=user, title=title, location=location,
                                        starts_at=timezone.make_aware(datetime.combine(day, time(9, 0))))


def _suggested(user, a, b) -> bool:
    keys = {(s.ref('source'), s.ref('target')) for s in link_suggestions.compute(user)}
    return any({a, b} == {src, tgt} for src, tgt in keys)


def _check(verdict, suggested, label):
    if verdict == HELPFUL:
        assert suggested, f'hilfreich, fehlt aber: {label}'
    elif verdict == WRONG:
        assert not suggested, f'falscher Vorschlag: {label}'


# Reise „Berlin“ (Start in 40 Tagen, 4 Tage) ↔ Aufgaben: (Titel, Fälligkeit relativ zum Reisebeginn | None, Urteil)
TRIP_TASKS = [
    ('Hotel Berlin bestätigen', -7, HELPFUL),
    ('Zugtickets nach Berlin buchen', None, HELPFUL),
    ('Berlin Museumspass kaufen', -2, HELPFUL),
    ('Berliner Dom Tickets reservieren', 1, HELPFUL),
    ('Steuererklärung abschließen', -2, WRONG),  # nur zeitlich nah
    ('Berliner Testament mit Notar besprechen', -3, WRONG),  # „Berliner“ ist hier kein Reisebezug
    ('Berliner Freundin anrufen', None, WRONG),
    ('Paket von Lisa Berlin abholen', None, WRONG),  # Name, kein Datum, kein Reisebezug
    ('Wohnung putzen', 0, WRONG),
    ('Restaurant in Berlin aussuchen', 2, MAYBE),
    ('Hotel bestätigen', -5, HELPFUL),  # ohne Ort, aber Reisevorbereitung kurz vor der einzigen Reise
    ('Hotel bestätigen', -40, WRONG),  # ohne Ort und weit vor der Reise: geraten
    ('Pass verlängern', None, WRONG),  # ohne Ort und ohne Datum
]


def test_unnamed_preparation_is_not_guessed_between_two_trips(anna):
    berlin = _trip(anna)
    hamburg = Trip.objects.create(owner=anna, title='Hamburg', destination='Hamburg', start_date=_offset(3),
                                  end_date=_offset(6))
    task = PersonalTask.objects.create(owner=anna, title='Hotel bestätigen', due_date=_offset(-2))
    assert not _suggested(anna, ('TRIP', berlin.pk), ('TASK', task.pk))
    assert not _suggested(anna, ('TRIP', hamburg.pk), ('TASK', task.pk))


@pytest.mark.parametrize('title,due,verdict', TRIP_TASKS)
def test_trip_task_quality(anna, title, due, verdict):
    trip = _trip(anna)
    task = PersonalTask.objects.create(owner=anna, title=title, due_date=None if due is None else _offset(due))
    _check(verdict, _suggested(anna, ('TRIP', trip.pk), ('TASK', task.pk)), title)


def test_short_destinations_are_recognised(anna):
    """„Rom“ hat nur drei Buchstaben — das Reiseziel muss trotzdem zählen."""
    trip = _trip(anna, destination='Rom', title='Ostern')
    task = PersonalTask.objects.create(owner=anna, title='Hotel in Rom buchen')
    assert _suggested(anna, ('TRIP', trip.pk), ('TASK', task.pk))


# Reise ↔ Termine: (Titel, Ort, Tag relativ zum Reisebeginn, Urteil)
TRIP_EVENTS = [
    ('ICE nach Berlin', '', 0, HELPFUL),
    ('Check-in Hotel', 'Berlin Mitte', 0, HELPFUL),
    ('Flug zurück', '', 4, HELPFUL),  # Abreisetag, Reisewort
    ('Museumsinsel', 'Berlin', 2, HELPFUL),
    ('Zahnarzt', '', 1, WRONG),  # nur gleiche Zeit
    ('Zug zur Oma', '', 2, WRONG),  # Reisewort mitten in der Reise, ohne Ziel: zu unsicher
    ('ICE nach Berlin', '', 30, WRONG),  # Ziel, aber nicht in der Reisezeit
]


@pytest.mark.parametrize('title,location,day,verdict', TRIP_EVENTS)
def test_trip_event_quality(anna, title, location, day, verdict):
    trip = _trip(anna)
    event = _event(anna, title, _offset(day), location)
    _check(verdict, _suggested(anna, ('TRIP', trip.pk), ('CALENDAR_EVENT', event.pk)), f'{title} @ {day}')


# Reise ↔ Sparziele: (Ziel der Reise, Sparziel, Zieldatum relativ | None, Urteil)
TRIP_GOALS = [
    ('Japan', 'Japan Urlaub', None, HELPFUL),
    ('Berlin', 'Reisekasse Berlin', None, HELPFUL),
    ('Berlin', 'Kaution Wohnung Berlin', None, WRONG),  # nennt die Stadt, ist aber kein Reisegeld
    ('Berlin', 'Berlin', -5, MAYBE),
]


@pytest.mark.parametrize('destination,title,target,verdict', TRIP_GOALS)
def test_trip_goal_quality(anna, destination, title, target, verdict):
    trip = _trip(anna, destination=destination)
    goal = SavingsGoal.objects.create(owner=anna, title=title, target_amount=Decimal('500'),
                                      target_date=None if target is None else _offset(target))
    _check(verdict, _suggested(anna, ('TRIP', trip.pk), ('SAVINGS_GOAL', goal.pk)), title)


# Gerät ↔ Sparziel: (Gerät, Sparziel, Urteil)
DEVICE_GOALS = [
    ('Waschmaschine', 'Neue Waschmaschine', HELPFUL),
    ('Waschmaschine', 'Sparziel Waschmaschine', HELPFUL),
    ('Fernseher', 'Neuer Fernseher fürs Wohnzimmer', HELPFUL),
    ('Waschmaschine', 'Japan Urlaub', WRONG),
    ('Herd', 'Herdenschutzhund', WRONG),
    ('Heizung', 'Heizungskosten Nachzahlung', MAYBE),
]


@pytest.mark.parametrize('device_name,goal_title,verdict', DEVICE_GOALS)
def test_device_goal_quality(anna, device_name, goal_title, verdict):
    device = FolderEntry.objects.create(household=anna.home, kind=FolderEntry.Kind.DEVICE, name=device_name)
    goal = SavingsGoal.objects.create(owner=anna, title=goal_title, target_amount=Decimal('500'))
    _check(verdict, _suggested(anna, ('DEVICE', device.pk), ('SAVINGS_GOAL', goal.pk)), goal_title)


# Vertrag ↔ Aufgabe: (Vertrag, Anbieter, Aufgabe, Urteil)
CONTRACT_TASKS = [
    ('Internetvertrag', 'Vodafone', 'Vodafone Vertrag prüfen', HELPFUL),
    ('Internet', 'Vodafone', 'Vodafone kündigen', HELPFUL),
    ('Strom', 'Stadtwerke München', 'Stromanbieter wechseln', HELPFUL),
    ('Handyvertrag', 'Telekom', 'Telekom Hotline wegen Rechnung anrufen', HELPFUL),
    ('Strom', 'Stadtwerke München', 'München Wohnung besichtigen', WRONG),  # Ort im Anbieternamen
    ('Hausrat', 'Allianz', 'Allianz Arena Tickets kaufen', WRONG),  # Marke, aber keine Vertragssache
    ('Internet', 'Vodafone', 'Internet-Router neu starten', WRONG),
    ('Internet', 'Vodafone', 'Vodafone Shop Öffnungszeiten', MAYBE),
]


@pytest.mark.parametrize('name,provider,task_title,verdict', CONTRACT_TASKS)
def test_contract_task_quality(anna, name, provider, task_title, verdict):
    contract = FolderEntry.objects.create(household=anna.home, kind=FolderEntry.Kind.CONTRACT, name=name,
                                          provider=provider)
    task = PersonalTask.objects.create(owner=anna, title=task_title)
    _check(verdict, _suggested(anna, ('CONTRACT', contract.pk), ('TASK', task.pk)), task_title)


def test_brief_scenario_end_to_end(anna):
    """Szenario aus dem Audit-Auftrag, alles in einem Konto."""
    trip = _trip(anna)
    hotel = PersonalTask.objects.create(owner=anna, title='Hotel bestätigen', due_date=_offset(-5))
    tax = PersonalTask.objects.create(owner=anna, title='Steuererklärung', due_date=_offset(-5))
    goal = SavingsGoal.objects.create(owner=anna, title='Sparziel Waschmaschine', target_amount=Decimal('700'))
    washer = FolderEntry.objects.create(household=anna.home, kind=FolderEntry.Kind.DEVICE, name='Waschmaschine')
    internet = FolderEntry.objects.create(household=anna.home, kind=FolderEntry.Kind.CONTRACT, name='Internetvertrag',
                                          provider='Vodafone')
    vodafone = PersonalTask.objects.create(owner=anna, title='Vodafone Vertrag prüfen')

    # „Hotel bestätigen“ nennt Berlin nicht, ist aber eindeutig Reisevorbereitung kurz vor der einzigen Reise.
    assert _suggested(anna, ('TRIP', trip.pk), ('TASK', hotel.pk))
    assert not _suggested(anna, ('TRIP', trip.pk), ('TASK', tax.pk))
    assert _suggested(anna, ('DEVICE', washer.pk), ('SAVINGS_GOAL', goal.pk))
    assert _suggested(anna, ('CONTRACT', internet.pk), ('TASK', vodafone.pk))
    assert not _suggested(anna, ('TRIP', trip.pk), ('SAVINGS_GOAL', goal.pk))
