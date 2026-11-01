"""Sammel-Endpunkt für Hinweise in Listen (31.10.2026): GET /connections/summary/?object_type=&ids=

Nur lesend, dieselben Regeln wie die Liste je Objekt: sichtbar nur, wenn beide Seiten sichtbar sind; fremde und
nicht vorhandene IDs fehlen einfach (kein Zähler, keine Maske); Abfragen fest statt je Objekt."""

from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.db import connection as db
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APIClient

from connections import services
from connections.models import Connection, ObjectType, Origin, RelationType
from core.models import Household, HouseholdMembership
from haushalt.models import Task as HouseholdTask
from organisation.models import PersonalEvent, PersonalTask
from reisen.models import Trip, TripParticipant

pytestmark = pytest.mark.django_db

URL = '/api/v1/connections/summary/'


def _user(name):
    return get_user_model().objects.create_user(username=name, email=f'{name}@example.com', password='x')


def _client(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


def _connect(user, a, b):
    return services.create_connection(user, a[0], a[1], b[0], b[1])


@pytest.fixture
def world():
    anna, clara, bert = _user('anna'), _user('clara'), _user('bert')
    home = Household.objects.create(name='Anna und Clara')
    for member in (anna, clara):
        HouseholdMembership.objects.create(user=member, household=home)
    start = timezone.localdate() + timedelta(days=12)
    trip = Trip.objects.create(owner=anna, title='Berlin Wochenende', destination='Berlin', start_date=start,
                               end_date=start + timedelta(days=2))
    TripParticipant.objects.create(trip=trip, user=clara, role=TripParticipant.Role.EDITOR)
    dinner = PersonalEvent.objects.create(owner=anna, title='Abendessen mit Lena', starts_at=timezone.now() + timedelta(days=13))
    anna_task = PersonalTask.objects.create(owner=anna, title='Hotel bezahlen')
    clara_task = PersonalTask.objects.create(owner=clara, title='Claras private Aufgabe')
    flowers = HouseholdTask.objects.create(household=home, title='Blumen gießen lassen')
    return locals()


def test_summary_lists_the_visible_other_side_per_object(world):
    w = world
    _connect(w['anna'], (ObjectType.TRIP, w['trip'].pk), (ObjectType.CALENDAR_EVENT, w['dinner'].pk))
    _connect(w['anna'], (ObjectType.TRIP, w['trip'].pk), (ObjectType.HOUSEHOLD_TASK, w['flowers'].pk))
    r = _client(w['anna']).get(URL, {'object_type': 'CALENDAR_EVENT', 'ids': f"{w['dinner'].pk}"})
    assert r.status_code == 200
    assert r['Cache-Control'] == 'no-store'
    [other] = r.json()[str(w['dinner'].pk)]
    assert {k: other[k] for k in ('type', 'id', 'title', 'domain')} == {'type': 'TRIP', 'id': w['trip'].pk, 'title': 'Berlin Wochenende', 'domain': 'reisen'}
    # Aus Sicht der Reise: beide Gegenstücke, in der Reihenfolge des Anlegens
    r = _client(w['anna']).get(URL, {'object_type': 'TRIP', 'ids': str(w['trip'].pk)})
    assert [o['type'] for o in r.json()[str(w['trip'].pk)]] == ['CALENDAR_EVENT', 'HOUSEHOLD_TASK']


def test_a_connection_never_reveals_the_other_persons_private_side(world):
    """Clara reist mit, sieht aber Annas Termin nicht — die Verbindung Reise ↔ Termin bleibt für sie unsichtbar."""
    w = world
    _connect(w['anna'], (ObjectType.TRIP, w['trip'].pk), (ObjectType.CALENDAR_EVENT, w['dinner'].pk))
    _connect(w['clara'], (ObjectType.TRIP, w['trip'].pk), (ObjectType.TASK, w['clara_task'].pk))
    clara = _client(w['clara'])
    only = clara.get(URL, {'object_type': 'TRIP', 'ids': str(w['trip'].pk)}).json()[str(w['trip'].pk)]
    assert [o['title'] for o in only] == ['Claras private Aufgabe']
    # Annas Termin-ID abgefragt: wie nicht vorhanden — leer, kein Titel, kein Hinweis
    assert clara.get(URL, {'object_type': 'CALENDAR_EVENT', 'ids': str(w['dinner'].pk)}).json() == {}
    # Und Anna sieht Claras private Aufgabe ebenso wenig
    anna_view = _client(w['anna']).get(URL, {'object_type': 'TRIP', 'ids': str(w['trip'].pk)}).json()[str(w['trip'].pk)]
    assert [o['title'] for o in anna_view] == ['Abendessen mit Lena']


def test_strangers_and_unknown_ids_get_an_empty_answer(world):
    w = world
    _connect(w['anna'], (ObjectType.TRIP, w['trip'].pk), (ObjectType.CALENDAR_EVENT, w['dinner'].pk))
    bert = _client(w['bert'])
    assert bert.get(URL, {'object_type': 'TRIP', 'ids': f"{w['trip'].pk},999999"}).json() == {}
    assert bert.get(URL, {'object_type': 'CALENDAR_EVENT', 'ids': str(w['dinner'].pk)}).json() == {}


def test_revoked_trip_access_hides_the_hint_immediately(world):
    w = world
    _connect(w['clara'], (ObjectType.TRIP, w['trip'].pk), (ObjectType.TASK, w['clara_task'].pk))
    TripParticipant.objects.filter(trip=w['trip'], user=w['clara']).delete()
    assert _client(w['clara']).get(URL, {'object_type': 'TASK', 'ids': str(w['clara_task'].pk)}).json() == {}
    assert Connection.objects.count() == 1  # nichts gelöscht, nur nicht mehr sichtbar


@pytest.mark.parametrize('params', [
    {'object_type': 'TASK'},
    {'object_type': 'TASK', 'ids': ''},
    {'object_type': 'TASK', 'ids': 'a,b'},
    {'object_type': 'TASK', 'ids': '0'},
    {'object_type': 'TASK', 'ids': '-3'},
    {'object_type': 'TASK', 'ids': str(2**63)},
    {'object_type': 'NOPE', 'ids': '1'},
    {'object_type': 'TASK', 'ids': ','.join(str(i) for i in range(1, 202))},
])
def test_invalid_queries_are_rejected_cleanly(world, params):
    assert _client(world['anna']).get(URL, params).status_code == 400


def test_anonymous_is_rejected(world):
    assert APIClient().get(URL, {'object_type': 'TASK', 'ids': '1'}).status_code in (401, 403)


def test_query_count_does_not_grow_with_the_number_of_objects(world):
    w = world
    events = [PersonalEvent.objects.create(owner=w['anna'], title=f'Termin {i}', starts_at=timezone.now()) for i in range(8)]
    for e in events:
        Connection.objects.create(source_type=ObjectType.TRIP, source_id=w['trip'].pk, target_type=ObjectType.CALENDAR_EVENT,
                                  target_id=e.pk, relation_type=RelationType.RELATED_TO, origin=Origin.MANUAL, created_by=w['anna'])
    ids = [e.pk for e in events]
    with CaptureQueriesContext(db) as small:
        services.get_connection_summary(w['anna'], ObjectType.CALENDAR_EVENT, ids[:1])
    with CaptureQueriesContext(db) as large:
        result = services.get_connection_summary(w['anna'], ObjectType.CALENDAR_EVENT, ids)
    assert len(result) == 8
    assert len(large) == len(small)
