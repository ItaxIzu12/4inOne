"""Alle Verknüpfungen in einer Matrix (14.11.2026).

Für JEDES erlaubte Arten-Paar (registry.ALLOWED_PAIRS) und JEDE automatische Verbindung (models.AutoKind) läuft
derselbe Ablauf – so fällt sofort auf, wenn ein Paar oder eine Art dazukommt und nicht überall funktioniert:

Manuell:   anlegen (auch „falsch herum“) → auf beiden Seiten sichtbar → kein Duplikat → Auswahl liefert „fits“ und
           lässt Verknüpftes weg → Fremde sehen und ändern nichts → Löschen der Quelle nimmt nur die Verknüpfung mit.
Automatisch: verbinden → erscheint im Zielbereich → pausieren blendet aus → fortsetzen zeigt wieder →
           Fremde können nicht verbinden → Löschen der Quelle entfernt die Verbindung, alles andere bleibt.
"""

from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from connections.models import AutoKind, AutoLink, Connection, ObjectType as T
from connections.registry import ALLOWED_PAIRS, KINDS
from connections.tests.test_auto_links import AUTO, ORDNER, _calendar, _client, _contract, _link, _planned, w  # noqa: F401
from finanzen.models import SavingsGoal
from haushalt.models import FolderEntry, Task as HouseholdTask
from organisation.models import PersonalEvent, PersonalTask
from reisen.models import Trip, TripEvent

pytestmark = pytest.mark.django_db

URL = '/api/v1/connections/'


def _make(world, object_type):
    """Ein Eintrag der Art, den Anna bearbeiten darf."""
    anna, home, today = world['anna'], world['home'], timezone.localdate()
    if object_type == T.TASK:
        return PersonalTask.objects.create(owner=anna, title='Matrix-Aufgabe')
    if object_type == T.CALENDAR_EVENT:
        return PersonalEvent.objects.create(owner=anna, title='Matrix-Termin', starts_at=timezone.now() + timedelta(days=3))
    if object_type == T.SAVINGS_GOAL:
        return SavingsGoal.objects.create(owner=anna, title='Matrix-Sparziel', target_amount=Decimal('100'))
    if object_type == T.HOUSEHOLD_TASK:
        return HouseholdTask.objects.create(household=home, title='Matrix-Haushaltsaufgabe')
    if object_type == T.TRIP:
        return Trip.objects.create(owner=anna, title='Matrix-Reise', destination='Wien', start_date=today + timedelta(days=10), end_date=today + timedelta(days=12))
    if object_type == T.DEVICE:
        return FolderEntry.objects.create(household=home, created_by=anna, kind=FolderEntry.Kind.DEVICE, name='Matrix-Gerät')
    if object_type == T.CONTRACT:
        return FolderEntry.objects.create(household=home, created_by=anna, kind=FolderEntry.Kind.CONTRACT, name='Matrix-Vertrag')
    raise AssertionError(object_type)


def test_every_object_type_in_the_registry_has_a_factory_here(w):  # noqa: F811
    # kommt eine neue Art dazu, muss sie auch in die Matrix
    for object_type in KINDS:
        assert _make(w, object_type) is not None


@pytest.mark.parametrize('pair', list(ALLOWED_PAIRS), ids=lambda p: f'{p[0]}-{p[1]}')
def test_manual_connection_works_the_same_for_every_allowed_pair(w, pair):  # noqa: F811
    source_type, target_type = pair
    anna, dora = _client(w['anna']), _client(w['dora'])
    source, target = _make(w, source_type), _make(w, target_type)

    # „falsch herum“ angegeben – gespeichert wird in der festen Richtung des Paars
    created = anna.post(URL, {'source_type': target_type, 'source_id': target.pk, 'target_type': source_type, 'target_id': source.pk}, format='json')
    assert created.status_code == 201, created.data
    stored = Connection.objects.get()
    assert (stored.source_type, stored.target_type) == (source_type, target_type)
    assert created.data['relation_type'] == ALLOWED_PAIRS[pair][0]

    # auf beiden Seiten sichtbar
    for obj_type, obj, other in ((source_type, source, target), (target_type, target, source)):
        rows = anna.get(URL, {'object_type': obj_type, 'object_id': obj.pk}).data
        assert [r['other']['id'] for r in rows] == [other.pk]

    # kein Duplikat, in keiner Richtung
    again = anna.post(URL, {'source_type': source_type, 'source_id': source.pk, 'target_type': target_type, 'target_id': target.pk}, format='json')
    assert again.status_code == 409

    # Auswahl: liefert „fits“, Verknüpftes fehlt
    extra = _make(w, target_type)
    rows = anna.get(URL + 'candidates/', {'object_type': source_type, 'object_id': source.pk, 'target_type': target_type}).data
    assert [r['id'] for r in rows] == [extra.pk]
    assert all(isinstance(r['fits'], bool) for r in rows)

    # Fremde: nichts sehen, nichts anlegen
    assert dora.get(URL, {'object_type': source_type, 'object_id': source.pk}).status_code == 404
    stranger = dora.post(URL, {'source_type': source_type, 'source_id': source.pk, 'target_type': target_type, 'target_id': extra.pk}, format='json')
    assert stranger.status_code == 404

    # Quelle gelöscht: Verknüpfung weg, der Partner bleibt
    source.delete()
    assert not Connection.objects.exists()
    assert type(target).objects.filter(pk=target.pk).exists()


# --------------------------------------------------------------------------- automatische Verbindungen


def _auto_source(world, kind):
    """(Quellen-ID, Prüffunktion „erscheint im Zielbereich?“, Löschen der Quelle) je Art."""
    anna, home, today = world['anna'], world['home'], timezone.localdate()
    in_calendar = lambda prefix: lambda: any(i['key'].startswith(prefix) for i in _calendar(anna, today, today + timedelta(days=400)))  # noqa: E731
    if kind == AutoKind.CONTRACT_FINANCE:
        contract = _contract(anna)
        return contract, lambda: bool(_planned(anna, today)), lambda: _client(anna).delete(f'{ORDNER}{contract}/')
    if kind == AutoKind.CONTRACT_REMINDER:
        contract = _contract(anna)
        return contract, in_calendar('contract:'), lambda: _client(anna).delete(f'{ORDNER}{contract}/')
    if kind == AutoKind.DEVICE_MAINTENANCE:
        device = _client(anna).post(ORDNER, {'kind': 'geraet', 'name': 'Heizung', 'maintenance_due_date': (today + timedelta(days=20)).isoformat()}, format='json').data['id']
        return device, in_calendar('device:'), lambda: _client(anna).delete(f'{ORDNER}{device}/')
    if kind == AutoKind.HOUSEHOLD_TASKS:
        HouseholdTask.objects.create(household=home, title='Müll rausbringen')
        shows = lambda: bool(_client(anna).get(f'{AUTO}household-tasks/').data['tasks'])  # noqa: E731
        return home.pk, shows, home.delete
    if kind in (AutoKind.TRIP_CALENDAR, AutoKind.TRIP_ITINERARY):
        trip = Trip.objects.create(owner=anna, title='Rom', destination='Rom', start_date=today + timedelta(days=10), end_date=today + timedelta(days=12))
        TripEvent.objects.create(trip=trip, title='Kolosseum', starts_at=timezone.now() + timedelta(days=11))
        prefix = 'trip:' if kind == AutoKind.TRIP_CALENDAR else 'trip-event:'
        return trip.pk, in_calendar(prefix), trip.delete
    if kind == AutoKind.SAVINGS_REMINDER:
        goal = SavingsGoal.objects.create(owner=anna, title='Fahrrad', target_amount=Decimal('800'), target_date=today + timedelta(days=60))
        return goal.pk, in_calendar('goal:'), goal.delete
    raise AssertionError(f'Neue Art {kind} fehlt in der Matrix')


@pytest.mark.parametrize('kind', AutoKind.values)
def test_every_automatic_connection_shows_pauses_resumes_and_disappears_with_its_source(w, kind):  # noqa: F811
    source_id, shows, delete_source = _auto_source(w, kind)
    assert not shows(), 'ohne Verbindung darf nichts erscheinen'
    link = _link(w['anna'], kind, source_id)
    assert link['status'] == 'ACTIVE'
    assert shows(), f'{kind}: erscheint nicht im Zielbereich'

    anna = _client(w['anna'])
    anna.patch(f"{AUTO}{link['link_id']}/", {'status': 'PAUSED'}, format='json')
    assert not shows(), f'{kind}: pausiert, aber noch sichtbar'
    anna.patch(f"{AUTO}{link['link_id']}/", {'status': 'ACTIVE'}, format='json')
    assert shows(), f'{kind}: nach Fortsetzen nicht wieder da'

    # Fremde können diese Quelle nicht verbinden
    assert _client(w['dora']).post(AUTO, {'kind': kind, 'source_id': source_id}, format='json').status_code == 404

    delete_source()
    assert not AutoLink.objects.filter(kind=kind, source_id=source_id).exists(), f'{kind}: Verbindung überlebt die Quelle'
