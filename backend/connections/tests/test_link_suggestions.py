"""Suggestions V1 — Verknüpfungs-Vorschläge: Qualität, Ablauf und Sicherheit.

Anna hat eine Berlin-Reise, eigene Aufgaben/Termine/Sparziele und teilt mit Clara einen Haushalt (Geräte,
Verträge). Bert ist fremd."""

from datetime import datetime, time, timedelta
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from connections import link_suggestions
from connections.models import Connection, Origin
from core.models import Household, HouseholdMembership
from finanzen.models import SavingsGoal
from haushalt.models import FolderEntry
from organisation.models import PersonalEvent, PersonalTask
from reisen.models import Trip, TripParticipant

pytestmark = pytest.mark.django_db

URL = '/api/v1/connections/link-suggestions/'


def _user(name):
    return get_user_model().objects.create_user(username=name, email=f'{name}@example.com', password='x')


def _client(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


def _today():
    return timezone.localdate()


@pytest.fixture
def w():
    anna, clara, bert = _user('anna'), _user('clara'), _user('bert')
    home = Household.objects.create(name='Anna und Clara')
    HouseholdMembership.objects.create(user=anna, household=home)
    HouseholdMembership.objects.create(user=clara, household=home)
    start = _today() + timedelta(days=30)
    trip = Trip.objects.create(owner=anna, title='Städtetrip', destination='Berlin', start_date=start,
                               end_date=start + timedelta(days=4))
    return {'anna': anna, 'clara': clara, 'bert': bert, 'home': home, 'trip': trip, 'start': start}


def task(owner, title, due=None, **extra):
    return PersonalTask.objects.create(owner=owner, title=title, due_date=due, **extra)


def event(owner, title, day, location=''):
    at = timezone.make_aware(datetime.combine(day, time(8, 30)))
    return PersonalEvent.objects.create(owner=owner, title=title, starts_at=at, location=location)


def goal(owner, title):
    return SavingsGoal.objects.create(owner=owner, title=title, target_amount=Decimal('800.00'))


def device(home, name, **extra):
    return FolderEntry.objects.create(household=home, kind=FolderEntry.Kind.DEVICE, name=name, **extra)


def contract(home, name, provider=''):
    return FolderEntry.objects.create(household=home, kind=FolderEntry.Kind.CONTRACT, name=name, provider=provider)


def listing(user, object_type, object_id):
    r = _client(user).get(URL, {'object_type': object_type, 'object_id': object_id})
    assert r.status_code == 200, r.data
    return r.data


def keys(user, object_type, object_id):
    return [row['key'] for row in listing(user, object_type, object_id)]


# ---------------------------------------------------------------------------
# Qualität: positive und negative Fälle (70–75)
# ---------------------------------------------------------------------------


def test_70_trip_task_positive_with_explanation(w):
    t = task(w['anna'], 'Hotel Berlin bestätigen', w['start'] - timedelta(days=7))
    rows = listing(w['anna'], 'TRIP', w['trip'].pk)
    assert len(rows) == 1
    row = rows[0]
    assert row['reason_code'] == 'DATE_AND_CONTEXT_MATCH'
    assert row['other'] == {'type': 'TASK', 'id': t.pk, 'title': 'Hotel Berlin bestätigen',
                            'subtitle': row['other']['subtitle'], 'domain': 'organisation'}
    assert 'Berlin' in row['reason'] and 'könnte' in row['headline']
    assert 'score' not in row and 'confidence' not in str(row).lower()  # keine Prozentwerte für Menschen
    # Dieselbe Verbindung von der Aufgabe aus gesehen: ein Vorschlag, gleicher Schlüssel.
    assert keys(w['anna'], 'TASK', t.pk) == [row['key']]


def test_71_trip_task_negative_date_alone_is_not_enough(w):
    task(w['anna'], 'Steuererklärung abschließen', w['start'] - timedelta(days=2))
    assert listing(w['anna'], 'TRIP', w['trip'].pk) == []


def test_trip_task_keyword_alone_is_not_enough(w):
    task(w['anna'], 'Berliner Freundin anrufen')  # nennt Berlin, aber weder Termin nahe der Reise noch Reisebezug
    assert listing(w['anna'], 'TRIP', w['trip'].pk) == []


def test_trip_event_matches_destination_in_trip_window(w):
    e = event(w['anna'], 'ICE nach Berlin', w['start'])
    event(w['anna'], 'ICE nach Berlin', w['start'] + timedelta(days=40))  # außerhalb der Reise
    event(w['anna'], 'Zahnarzt', w['start'] + timedelta(days=1))  # in der Reise, aber ohne Bezug
    rows = listing(w['anna'], 'TRIP', w['trip'].pk)
    assert [r['other']['id'] for r in rows] == [e.pk]


def test_72_device_and_savings_goal(w):
    d = device(w['home'], 'Waschmaschine', provider='Siemens')
    g = goal(w['anna'], 'Neue Waschmaschine')
    rows = listing(w['anna'], 'DEVICE', d.pk)
    assert [r['other']['id'] for r in rows] == [g.pk]
    assert rows[0]['reason_code'] == 'DEVICE_SAVINGS_GOAL_MATCH'


def test_73_unrelated_savings_goal(w):
    d = device(w['home'], 'Waschmaschine')
    goal(w['anna'], 'Japan Urlaub')
    assert listing(w['anna'], 'DEVICE', d.pk) == []


def test_contract_and_task_by_provider_not_by_generic_name(w):
    c = contract(w['home'], 'Internet', provider='Vodafone')
    t = task(w['anna'], 'Vodafone Vertrag prüfen')
    task(w['anna'], 'Internet-Router neu starten')  # nur der Vertragsname, kein Vertragsbezug
    rows = listing(w['anna'], 'CONTRACT', c.pk)
    assert [r['other']['id'] for r in rows] == [t.pk]
    assert rows[0]['reason_code'] == 'CONTRACT_TASK_MATCH'


def test_74_existing_connection_suppresses_suggestion_both_directions(w):
    t = task(w['anna'], 'Hotel Berlin bestätigen', w['start'] - timedelta(days=7))
    Connection.objects.create(source_type='TRIP', source_id=w['trip'].pk, target_type='TASK', target_id=t.pk)
    assert listing(w['anna'], 'TRIP', w['trip'].pk) == []
    assert listing(w['anna'], 'TASK', t.pk) == []


def test_75_no_self_suggestion_and_one_per_pair(w):
    task(w['anna'], 'Hotel Berlin buchen', w['start'] - timedelta(days=3))
    all_keys = [s.key for s in link_suggestions.compute(w['anna'])]
    assert len(all_keys) == len(set(all_keys)) == 1
    for s in link_suggestions.compute(w['anna']):
        assert s.ref('source') != s.ref('target')


def test_ranking_and_limit_per_object(w):
    soon = task(w['anna'], 'Zugtickets Berlin buchen', w['start'] - timedelta(days=2))  # Datum + Reisewort
    task(w['anna'], 'Berlin Hotel reservieren')  # nur Reisewort
    for n in range(4):
        task(w['anna'], f'Berlin Museum Tickets {n}', w['start'] + timedelta(days=1))
    rows = listing(w['anna'], 'TRIP', w['trip'].pk)
    assert len(rows) == 3  # nie mehr als drei auf einmal
    assert rows[0]['other']['id'] == soon.pk or rows[0]['reason_code'] == 'DATE_AND_CONTEXT_MATCH'


def test_past_and_cancelled_trips_produce_nothing(w):
    Trip.objects.filter(pk=w['trip'].pk).update(status=Trip.Status.CANCELLED)
    task(w['anna'], 'Hotel Berlin bestätigen', w['start'] - timedelta(days=7))
    assert link_suggestions.compute(w['anna']) == []


# ---------------------------------------------------------------------------
# Ablauf: Annehmen und Ablehnen (76, 77, 82, 83)
# ---------------------------------------------------------------------------


def test_76_dismiss_keeps_it_away_after_reload(w):
    task(w['anna'], 'Hotel Berlin bestätigen', w['start'] - timedelta(days=7))
    key = keys(w['anna'], 'TRIP', w['trip'].pk)[0]
    assert _client(w['anna']).post(URL + 'dismiss/', {'key': key}, format='json').status_code == 204
    assert listing(w['anna'], 'TRIP', w['trip'].pk) == []
    assert listing(w['anna'], 'TRIP', w['trip'].pk) == []  # zweiter Aufruf: weiterhin weg
    assert not Connection.objects.exists()


def test_77_accept_creates_connection_via_engine_and_changes_nothing_else(w):
    due = w['start'] - timedelta(days=7)
    t = task(w['anna'], 'Hotel Berlin bestätigen', due)
    key = keys(w['anna'], 'TRIP', w['trip'].pk)[0]
    r = _client(w['anna']).post(URL + 'accept/', {'key': key}, format='json')
    assert r.status_code == 201, r.data
    saved = Connection.objects.get()
    assert (saved.source_type, saved.source_id, saved.target_type, saved.target_id) == ('TRIP', w['trip'].pk, 'TASK', t.pk)
    assert saved.origin == Origin.SUGGESTED and saved.created_by == w['anna']
    t.refresh_from_db()
    assert t.title == 'Hotel Berlin bestätigen' and t.due_date == due and t.status == PersonalTask.Status.OPEN
    # Vorschlag weg, Verbindung unter „Verknüpft mit“
    assert listing(w['anna'], 'TRIP', w['trip'].pk) == []
    connected = _client(w['anna']).get('/api/v1/connections/', {'object_type': 'TRIP', 'object_id': w['trip'].pk})
    assert [c['other']['id'] for c in connected.data] == [t.pk]
    # Zweites Annehmen: gilt nicht mehr
    assert _client(w['anna']).post(URL + 'accept/', {'key': key}, format='json').status_code == 404


def test_82_repeated_computation_yields_one_suggestion(w):
    task(w['anna'], 'Hotel Berlin bestätigen', w['start'] - timedelta(days=7))
    first = keys(w['anna'], 'TRIP', w['trip'].pk)
    for _ in range(3):
        assert keys(w['anna'], 'TRIP', w['trip'].pk) == first


def test_83_deleted_target_disappears_and_cannot_be_accepted(w):
    t = task(w['anna'], 'Hotel Berlin bestätigen', w['start'] - timedelta(days=7))
    key = keys(w['anna'], 'TRIP', w['trip'].pk)[0]
    t.delete()
    assert listing(w['anna'], 'TRIP', w['trip'].pk) == []
    assert _client(w['anna']).post(URL + 'accept/', {'key': key}, format='json').status_code == 404
    assert not Connection.objects.exists()


def test_manual_connection_elsewhere_invalidates_suggestion(w):
    t = task(w['anna'], 'Hotel Berlin bestätigen', w['start'] - timedelta(days=7))
    key = keys(w['anna'], 'TRIP', w['trip'].pk)[0]
    created = _client(w['anna']).post('/api/v1/connections/', {
        'source_type': 'TASK', 'source_id': t.pk, 'target_type': 'TRIP', 'target_id': w['trip'].pk}, format='json')
    assert created.status_code == 201
    assert _client(w['anna']).post(URL + 'accept/', {'key': key}, format='json').status_code == 404
    assert Connection.objects.count() == 1


# ---------------------------------------------------------------------------
# Sicherheit (78–81, 56–62)
# ---------------------------------------------------------------------------


def test_78_permission_lost_before_accept(w):
    TripParticipant.objects.create(trip=w['trip'], user=w['clara'], role=TripParticipant.Role.EDITOR)
    t = task(w['clara'], 'Hotel Berlin bestätigen', w['start'] - timedelta(days=7))
    key = keys(w['clara'], 'TASK', t.pk)[0]
    TripParticipant.objects.filter(user=w['clara']).update(role=TripParticipant.Role.VIEWER)  # Rechte entzogen
    r = _client(w['clara']).post(URL + 'accept/', {'key': key}, format='json')
    assert r.status_code == 404 and 'Berlin' not in r.content.decode()
    assert not Connection.objects.exists()


def test_79_cross_user_cannot_read_accept_or_dismiss(w):
    t = task(w['anna'], 'Hotel Berlin bestätigen', w['start'] - timedelta(days=7))
    key = keys(w['anna'], 'TRIP', w['trip'].pk)[0]
    bert = _client(w['bert'])
    assert bert.get(URL, {'object_type': 'TRIP', 'object_id': w['trip'].pk}).status_code == 404
    assert bert.get(URL, {'object_type': 'TASK', 'object_id': t.pk}).status_code == 404
    accept = bert.post(URL + 'accept/', {'key': key}, format='json')
    dismiss = bert.post(URL + 'dismiss/', {'key': key}, format='json')
    assert accept.status_code == dismiss.status_code == 404
    assert 'Hotel' not in accept.content.decode() + dismiss.content.decode()
    assert not Connection.objects.exists()
    assert keys(w['anna'], 'TRIP', w['trip'].pk) == [key]  # Berts Versuch hat Annas Vorschlag nicht abgelehnt


def test_80_shared_household_device_never_reveals_private_goal(w):
    d = device(w['home'], 'Waschmaschine')
    goal(w['anna'], 'Neue Waschmaschine')  # privat, gehört Anna
    rows = listing(w['clara'], 'DEVICE', d.pk)
    assert rows == []
    assert link_suggestions.compute(w['clara']) == []
    assert link_suggestions.top_for_user(w['clara']) == []


def test_81_trip_participant_never_sees_owners_private_task(w):
    TripParticipant.objects.create(trip=w['trip'], user=w['clara'], role=TripParticipant.Role.EDITOR)
    task(w['anna'], 'Hotel Berlin bestätigen', w['start'] - timedelta(days=7))  # Annas private Aufgabe
    rows = listing(w['clara'], 'TRIP', w['trip'].pk)
    assert rows == [] and 'Hotel' not in str(rows)
    # Claras eigene passende Aufgabe dagegen schon
    own = task(w['clara'], 'Zug nach Berlin buchen', w['start'] - timedelta(days=3))
    assert [r['other']['id'] for r in listing(w['clara'], 'TRIP', w['trip'].pk)] == [own.pk]


def test_viewer_participant_gets_no_trip_suggestions(w):
    TripParticipant.objects.create(trip=w['trip'], user=w['clara'], role=TripParticipant.Role.VIEWER)
    task(w['clara'], 'Zug nach Berlin buchen', w['start'] - timedelta(days=3))
    assert listing(w['clara'], 'TRIP', w['trip'].pk) == []  # verknüpfen dürfte sie nicht


def test_child_account_gets_no_device_suggestions(w):
    kid = _user('kid')
    HouseholdMembership.objects.create(user=kid, household=w['home'], role=HouseholdMembership.Role.CHILD_ACCOUNT)
    d = device(w['home'], 'Spielkonsole')
    goal(kid, 'Neue Spielkonsole')
    assert _client(kid).get(URL, {'object_type': 'DEVICE', 'object_id': d.pk}).status_code == 404
    assert link_suggestions.compute(kid) == []


@pytest.mark.parametrize('key', [
    '', 'link', 'link:TRIP:1:TASK', 'link:TRIP:x:TASK:1', 'link:TRIP:1:TASK:1:extra', 'trip:1:goal',
    'link:BUDGET:1:TASK:2', "link:TRIP:1' OR 1=1:TASK:2", 'link:TRIP:99999999999999999999:TASK:1',
    'link:TRIP:9999999999999999999:TASK:1', 'link:TASK:1:TRIP:2',
])
def test_malformed_keys_are_rejected_without_details(w, key):
    r = _client(w['anna']).post(URL + 'accept/', {'key': key}, format='json')
    assert r.status_code in (400, 404)
    assert not Connection.objects.exists()


def test_client_cannot_inject_ids_or_origin(w):
    """Nur der Schlüssel zählt; Typen/IDs/Origin aus dem Body werden ignoriert."""
    t = task(w['anna'], 'Hotel Berlin bestätigen', w['start'] - timedelta(days=7))
    key = keys(w['anna'], 'TRIP', w['trip'].pk)[0]
    other = task(w['bert'], 'Berts Aufgabe')
    r = _client(w['anna']).post(URL + 'accept/', {
        'key': key, 'target_id': other.pk, 'origin': 'AUTOMATED', 'created_by': w['bert'].pk}, format='json')
    assert r.status_code == 201
    saved = Connection.objects.get()
    assert saved.target_id == t.pk and saved.origin == Origin.SUGGESTED and saved.created_by == w['anna']


def test_forged_key_for_valid_pair_without_rule_match_is_rejected(w):
    """Der Accept-Endpunkt ist kein Hintereingang zum Verknüpfen: ohne gültigen Vorschlag kein Ergebnis."""
    t = task(w['anna'], 'Steuererklärung abschließen')
    forged = f'link:TRIP:{w["trip"].pk}:TASK:{t.pk}'
    assert _client(w['anna']).post(URL + 'accept/', {'key': forged}, format='json').status_code == 404
    assert _client(w['anna']).post(URL + 'dismiss/', {'key': forged}, format='json').status_code == 404
    assert not Connection.objects.exists()


def test_dashboard_shows_at_most_one_strong_suggestion(w):
    task(w['anna'], 'Hotel Berlin bestätigen', w['start'] - timedelta(days=7))
    task(w['anna'], 'Zug nach Berlin buchen', w['start'] - timedelta(days=1))
    top = link_suggestions.top_for_user(w['anna'])
    assert len(top) == 1 and 'other' not in top[0]
    today = _client(w['anna']).get('/api/v1/today/')
    assert today.status_code == 200 and today.data['link_suggestion']['key'] == top[0]['key']


def test_dashboard_shows_none_when_nothing_strong(w):
    assert _client(w['anna']).get('/api/v1/today/').data['link_suggestion'] is None


def test_suggestions_never_change_anything_on_read(w):
    t = task(w['anna'], 'Hotel Berlin bestätigen', w['start'] - timedelta(days=7))
    before = PersonalTask.objects.filter(pk=t.pk).values().get()
    listing(w['anna'], 'TRIP', w['trip'].pk)
    _client(w['anna']).get('/api/v1/today/')
    assert PersonalTask.objects.filter(pk=t.pk).values().get() == before
    assert not Connection.objects.exists()


# ---------------------------------------------------------------------------
# Audit (Pre-Launch): gezielte Angriffe
# ---------------------------------------------------------------------------


def test_adversarial_key_with_swapped_target_or_type_fails(w):
    own = task(w['anna'], 'Hotel Berlin bestätigen', w['start'] - timedelta(days=7))
    foreign = task(w['bert'], 'Hotel Berlin bestätigen', w['start'] - timedelta(days=7))
    anna = _client(w['anna'])
    valid = keys(w['anna'], 'TRIP', w['trip'].pk)[0]
    assert valid.endswith(f':TASK:{own.pk}')
    for forged in (
        f'link:TRIP:{w["trip"].pk}:TASK:{foreign.pk}',  # fremde target_id
        f'link:TRIP:{w["trip"].pk}:CALENDAR_EVENT:{own.pk}',  # anderer Typ, gleiche ID
        f'link:CONTRACT:{w["trip"].pk}:TASK:{own.pk}',  # anderer Quelltyp
    ):
        for action in ('accept/', 'dismiss/'):
            r = anna.post(URL + action, {'key': forged}, format='json')
            assert r.status_code == 404 and 'Hotel' not in r.content.decode(), (forged, action)
    assert not Connection.objects.exists()


def test_participant_cannot_discover_owners_private_tasks_anywhere(w):
    TripParticipant.objects.create(trip=w['trip'], user=w['clara'], role=TripParticipant.Role.EDITOR)
    task(w['anna'], 'Geheimes Hotel Berlin', w['start'] - timedelta(days=7))
    clara = _client(w['clara'])
    bodies = [
        clara.get(URL, {'object_type': 'TRIP', 'object_id': w['trip'].pk}).content.decode(),
        clara.get('/api/v1/connections/candidates/', {'object_type': 'TRIP', 'object_id': w['trip'].pk,
                                                       'target_type': 'TASK'}).content.decode(),
        clara.get('/api/v1/today/').content.decode(),
        clara.get(f'/api/v1/connections/reisen/{w["trip"].pk}/erinnerungen/').content.decode(),
    ]
    assert all('Geheimes' not in body for body in bodies)


def test_household_member_never_sees_private_goal_through_shared_device(w):
    d = device(w['home'], 'Waschmaschine')
    g = goal(w['anna'], 'Neue Waschmaschine')
    assert _client(w['anna']).post('/api/v1/connections/', {
        'source_type': 'DEVICE', 'source_id': d.pk, 'target_type': 'SAVINGS_GOAL', 'target_id': g.pk},
        format='json').status_code == 201
    clara = _client(w['clara'])
    bodies = [
        clara.get('/api/v1/connections/', {'object_type': 'DEVICE', 'object_id': d.pk}),
        clara.get(URL, {'object_type': 'DEVICE', 'object_id': d.pk}),
        clara.get('/api/v1/connections/candidates/', {'object_type': 'DEVICE', 'object_id': d.pk,
                                                       'target_type': 'SAVINGS_GOAL'}),
    ]
    for r in bodies:
        assert r.status_code == 200 and r.data == []
        assert 'Neue Waschmaschine' not in r.content.decode()
    # Und Clara kann nicht über die ID an Annas Ziel heran
    assert clara.post('/api/v1/connections/', {
        'source_type': 'DEVICE', 'source_id': d.pk, 'target_type': 'SAVINGS_GOAL', 'target_id': g.pk},
        format='json').status_code == 404


def test_suggestion_response_exposes_only_preview_fields(w, settings):
    settings.DEBUG = False
    task(w['anna'], 'Hotel Berlin bestätigen', w['start'] - timedelta(days=7), description='Zimmer 12, Code 4711')
    row = listing(w['anna'], 'TRIP', w['trip'].pk)[0]
    assert set(row) == {'key', 'reason_code', 'headline', 'reason', 'relation_label', 'source', 'target', 'other'}
    for side in ('source', 'target', 'other'):
        assert set(row[side]) == {'type', 'id', 'title', 'subtitle', 'domain'}
    assert '4711' not in str(row)  # keine Beschreibung, keine Notizen
