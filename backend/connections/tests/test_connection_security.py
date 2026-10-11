"""Connection Engine V1 — Sicherheitsmatrix (Ergänzung zu test_connections.py).

Kernregel: Eine Verbindung verleiht nie Rechte. Sehen heißt beide Seiten sehen;
Verknüpfen und Lösen heißt beide Seiten bearbeiten dürfen (oder die Verbindung
selbst angelegt haben).

Anna besitzt die Reise und teilt mit Clara einen Haushalt. Clara ist je nach
Test Mitreisende als VIEWER oder EDITOR. Bert ist fremd."""

from datetime import timedelta
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.test import APIClient

from connections import services, suggestions
from connections.models import Connection, ObjectType
from core.models import Household, HouseholdMembership
from finanzen.models import SavingsGoal
from haushalt.models import Task as HouseholdTask
from organisation.models import PersonalTask
from reisen.models import Trip, TripParticipant

pytestmark = pytest.mark.django_db

URL = '/api/v1/connections/'


def _user(name):
    return get_user_model().objects.create_user(username=name, email=f'{name}@example.com', password='x')


def _client(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


def link(client, type_a, id_a, type_b, id_b, **extra):
    return client.post(
        URL, {'source_type': type_a, 'source_id': id_a, 'target_type': type_b, 'target_id': id_b, **extra}, format='json'
    )


@pytest.fixture
def world():
    anna, clara, bert = _user('anna'), _user('clara'), _user('bert')
    home = Household.objects.create(name='Anna und Clara')
    for member in (anna, clara):
        HouseholdMembership.objects.create(user=member, household=home)
    bert_home = Household.objects.create(name='Bert')
    HouseholdMembership.objects.create(user=bert, household=bert_home)
    start = timezone.localdate() + timedelta(days=30)
    trip = Trip.objects.create(owner=anna, title='Lissabon', destination='Lissabon', start_date=start,
                               end_date=start + timedelta(days=5))
    shared_task = HouseholdTask.objects.create(household=home, title='Blumen gießen lassen')
    bert_task = HouseholdTask.objects.create(household=bert_home, title='Berts Keller')
    return {'anna': anna, 'clara': clara, 'bert': bert, 'trip': trip, 'shared_task': shared_task, 'bert_task': bert_task}


def _join(world, role):
    TripParticipant.objects.create(trip=world['trip'], user=world['clara'], role=role)


# ---------------------------------------------------------------------------
# Reise-Teilnehmende: Sehen ist nicht Verknüpfen
# ---------------------------------------------------------------------------


def test_viewer_participant_cannot_link_trip(world):
    _join(world, TripParticipant.Role.VIEWER)
    clara = _client(world['clara'])
    r = link(clara, 'TRIP', world['trip'].pk, 'HOUSEHOLD_TASK', world['shared_task'].pk)
    assert r.status_code == 403
    assert not Connection.objects.exists()
    # Auch die Assistenten-Schritte verweigern es serverseitig.
    assert clara.get(URL + 'options/', {'object_type': 'TRIP', 'object_id': world['trip'].pk}).status_code == 403
    candidates = clara.get(
        URL + 'candidates/', {'object_type': 'TRIP', 'object_id': world['trip'].pk, 'target_type': 'HOUSEHOLD_TASK'}
    )
    assert candidates.status_code == 403


def test_editor_participant_can_link_trip_with_shared_household_task(world):
    _join(world, TripParticipant.Role.EDITOR)
    r = link(_client(world['clara']), 'HOUSEHOLD_TASK', world['shared_task'].pk, 'TRIP', world['trip'].pk)
    assert r.status_code == 201, r.data
    saved = Connection.objects.get()
    assert (saved.source_type, saved.target_type) == ('TRIP', 'HOUSEHOLD_TASK')  # kanonische Richtung
    assert saved.created_by == world['clara']


def test_viewer_cannot_delete_connection_of_owner_and_sees_can_delete_false(world):
    _join(world, TripParticipant.Role.VIEWER)
    created = link(_client(world['anna']), 'TRIP', world['trip'].pk, 'HOUSEHOLD_TASK', world['shared_task'].pk)
    assert created.status_code == 201

    clara = _client(world['clara'])
    listing = clara.get(URL, {'object_type': 'TRIP', 'object_id': world['trip'].pk})
    assert [row['can_delete'] for row in listing.data] == [False]  # sichtbar, aber nicht lösbar
    assert clara.delete(f'{URL}{created.data["id"]}/').status_code == 403
    assert Connection.objects.count() == 1

    owner_listing = _client(world['anna']).get(URL, {'object_type': 'TRIP', 'object_id': world['trip'].pk})
    assert [row['can_delete'] for row in owner_listing.data] == [True]


def test_editor_who_can_edit_both_sides_may_delete(world):
    _join(world, TripParticipant.Role.EDITOR)
    created = link(_client(world['anna']), 'TRIP', world['trip'].pk, 'HOUSEHOLD_TASK', world['shared_task'].pk)
    assert _client(world['clara']).delete(f'{URL}{created.data["id"]}/').status_code == 204
    assert not Connection.objects.exists()
    assert Trip.objects.filter(pk=world['trip'].pk).exists()  # nur der Zusammenhang ist weg
    assert HouseholdTask.objects.filter(pk=world['shared_task'].pk).exists()


def test_creator_may_delete_own_connection_after_losing_edit_rights(world):
    _join(world, TripParticipant.Role.EDITOR)
    created = link(_client(world['clara']), 'TRIP', world['trip'].pk, 'HOUSEHOLD_TASK', world['shared_task'].pk)
    TripParticipant.objects.filter(user=world['clara']).update(role=TripParticipant.Role.VIEWER)
    assert _client(world['clara']).delete(f'{URL}{created.data["id"]}/').status_code == 204


def test_viewer_accepting_household_suggestion_does_not_link_trip(world):
    _join(world, TripParticipant.Role.VIEWER)
    suggestions._link(world['clara'], world['trip'], ObjectType.HOUSEHOLD_TASK, world['shared_task'].pk)
    assert not Connection.objects.exists()


# ---------------------------------------------------------------------------
# Kein Leck privater Finanzen über eine geteilte Reise oder den Haushalt
# ---------------------------------------------------------------------------


def test_private_savings_goal_on_shared_trip_stays_private(world):
    _join(world, TripParticipant.Role.EDITOR)
    goal = SavingsGoal.objects.create(owner=world['anna'], title='Annas Geheimkonto', target_amount=Decimal('9999.00'),
                                      current_amount=Decimal('1234.00'))
    created = link(_client(world['anna']), 'TRIP', world['trip'].pk, 'SAVINGS_GOAL', goal.pk)
    assert created.status_code == 201

    clara = _client(world['clara'])
    listing = clara.get(URL, {'object_type': 'TRIP', 'object_id': world['trip'].pk})
    assert listing.status_code == 200 and listing.data == []
    body = listing.content.decode()
    assert 'Geheimkonto' not in body and '1.234' not in body and '9.999' not in body
    detail = clara.get(f'{URL}{created.data["id"]}/')
    assert detail.status_code == 404 and 'Geheimkonto' not in detail.content.decode()
    assert clara.delete(f'{URL}{created.data["id"]}/').status_code == 404
    assert clara.get(f'{URL}reisen/{world["trip"].pk}/sparziel/').data == []
    # Und Clara kann Annas Sparziel nicht selbst an die Reise hängen.
    assert link(clara, 'TRIP', world['trip'].pk, 'SAVINGS_GOAL', goal.pk).status_code == 404


def test_household_member_does_not_see_private_goal_linked_to_shared_task(world):
    """Haushaltsaufgabe ↔ privates Sparziel ist kein V1-Paar — aber auch die
    Reise dazwischen öffnet nichts: Clara ist hier nicht einmal Mitreisende."""
    created = link(_client(world['anna']), 'TRIP', world['trip'].pk, 'HOUSEHOLD_TASK', world['shared_task'].pk)
    assert created.status_code == 201
    listing = _client(world['clara']).get(URL, {'object_type': 'HOUSEHOLD_TASK', 'object_id': world['shared_task'].pk})
    assert listing.data == []  # die Reise ist für Clara unsichtbar → Verbindung auch
    assert 'Lissabon' not in listing.content.decode()


# ---------------------------------------------------------------------------
# Fremde IDs: kein Unterschied zwischen „fremd“ und „gibt es nicht“
# ---------------------------------------------------------------------------


def test_cross_user_target_is_indistinguishable_from_missing(world):
    anna = _client(world['anna'])
    foreign = link(anna, 'TRIP', world['trip'].pk, 'HOUSEHOLD_TASK', world['bert_task'].pk)
    missing = link(anna, 'TRIP', world['trip'].pk, 'HOUSEHOLD_TASK', 987654321)
    assert foreign.status_code == missing.status_code == 404
    assert foreign.data == missing.data
    assert 'Bert' not in foreign.content.decode()
    assert not Connection.objects.exists()


def test_cross_user_source_is_rejected(world):
    r = link(_client(world['bert']), 'TRIP', world['trip'].pk, 'HOUSEHOLD_TASK', world['bert_task'].pk)
    assert r.status_code == 404
    assert not Connection.objects.exists()


def test_enumerating_connection_ids_reveals_nothing(world):
    created = link(_client(world['anna']), 'TRIP', world['trip'].pk, 'HOUSEHOLD_TASK', world['shared_task'].pk)
    bert = _client(world['bert'])
    existing = bert.get(f'{URL}{created.data["id"]}/')
    missing = bert.get(f'{URL}{created.data["id"] + 1000}/')
    assert existing.status_code == missing.status_code == 404 and existing.data == missing.data


# ---------------------------------------------------------------------------
# Eingaben: manipuliert, fehlerhaft, unerwartet
# ---------------------------------------------------------------------------


@pytest.mark.parametrize('bad_id', [-1, 0, 'abc', '1; DROP TABLE x', 1.5, None, 2**70])
def test_malformed_ids_are_rejected(world, bad_id):
    r = link(_client(world['anna']), 'TRIP', bad_id, 'HOUSEHOLD_TASK', world['shared_task'].pk)
    assert r.status_code == 400
    assert not Connection.objects.exists()


@pytest.mark.parametrize('bad_type', ['trip', 'Trip', 'BUDGET', 'reisen.Trip', "TRIP' OR 1=1", ''])
def test_unexpected_types_are_rejected(world, bad_type):
    r = link(_client(world['anna']), bad_type, world['trip'].pk, 'HOUSEHOLD_TASK', world['shared_task'].pk)
    assert r.status_code == 400
    assert not Connection.objects.exists()


def test_manipulated_server_fields_are_ignored(world):
    r = link(_client(world['anna']), 'TRIP', world['trip'].pk, 'HOUSEHOLD_TASK', world['shared_task'].pk,
             origin='AUTOMATED', created_by=world['bert'].pk, id=4242, domain='finanzen', created_at='2000-01-01')
    assert r.status_code == 201
    saved = Connection.objects.get()
    assert saved.origin == 'MANUAL' and saved.created_by == world['anna'] and saved.pk != 4242
    assert saved.created_at.year > 2000


def test_unexpected_relation_type_is_rejected(world):
    anna = _client(world['anna'])
    assert link(anna, 'TRIP', world['trip'].pk, 'HOUSEHOLD_TASK', world['shared_task'].pk,
                relation_type='OWNS').status_code == 400
    assert link(anna, 'TRIP', world['trip'].pk, 'HOUSEHOLD_TASK', world['shared_task'].pk,
                relation_type='SCHEDULED_AS').status_code == 400  # gültig, aber nicht für dieses Paar
    assert not Connection.objects.exists()


# ---------------------------------------------------------------------------
# Limit ohne Leck, Duplikate auch im Wettlauf
# ---------------------------------------------------------------------------


def test_limit_counts_only_own_connections(world, monkeypatch):
    """Sonst verriete „Mehr als N Verknüpfungen“, dass es versteckte Verbindungen anderer gibt."""
    monkeypatch.setattr(services, 'MAX_CONNECTIONS_PER_OBJECT', 1)
    _join(world, TripParticipant.Role.EDITOR)
    other = HouseholdTask.objects.create(household=world['shared_task'].household, title='Post holen')
    assert link(_client(world['clara']), 'TRIP', world['trip'].pk, 'HOUSEHOLD_TASK', other.pk).status_code == 201
    assert link(_client(world['anna']), 'TRIP', world['trip'].pk, 'HOUSEHOLD_TASK', world['shared_task'].pk).status_code == 201


def test_database_rejects_duplicate_even_without_service(world):
    Connection.objects.create(source_type='TRIP', source_id=world['trip'].pk,
                              target_type='HOUSEHOLD_TASK', target_id=world['shared_task'].pk)
    with pytest.raises(IntegrityError), transaction.atomic():
        Connection.objects.create(source_type='TRIP', source_id=world['trip'].pk,
                                  target_type='HOUSEHOLD_TASK', target_id=world['shared_task'].pk)


def test_concurrent_duplicate_becomes_409(world, monkeypatch):
    """Zwei gleichzeitige Anfragen: beide bestehen die exists()-Prüfung, die zweite scheitert am
    Unique-Constraint — das wird zu 409, nicht zu 500."""
    trip, task = world['trip'], world['shared_task']
    real_create = Connection.objects.create

    def racing_create(**kwargs):
        real_create(**kwargs)  # die „andere“ Anfrage war schneller
        return real_create(**kwargs)

    monkeypatch.setattr(Connection.objects, 'create', racing_create)
    r = link(_client(world['anna']), 'TRIP', trip.pk, 'HOUSEHOLD_TASK', task.pk)
    assert r.status_code == 409  # sauberer Konflikt statt 500
    # Die simulierte „andere“ Anfrage lief hier in derselben Transaktion und wurde mit zurückgerollt;
    # entscheidend ist: nie zwei gleiche Zeilen.
    assert Connection.objects.count() <= 1


def test_deleted_object_leaves_no_broken_link(world):
    created = link(_client(world['anna']), 'TRIP', world['trip'].pk, 'HOUSEHOLD_TASK', world['shared_task'].pk)
    assert created.status_code == 201
    world['shared_task'].delete()
    assert not Connection.objects.exists()
    listing = _client(world['anna']).get(URL, {'object_type': 'TRIP', 'object_id': world['trip'].pk})
    assert listing.data == []


def test_personal_objects_stay_owner_only(world):
    """Organisation gehört einer Person — auch eine Haushaltsgenossin kann Annas Aufgabe nicht verknüpfen."""
    own = PersonalTask.objects.create(owner=world['anna'], title='Annas Aufgabe')
    goal = SavingsGoal.objects.create(owner=world['clara'], title='Claras Ziel', target_amount=Decimal('10'))
    assert link(_client(world['clara']), 'SAVINGS_GOAL', goal.pk, 'TASK', own.pk).status_code == 404


def test_oversized_path_ids_are_not_found(world):
    anna = _client(world['anna'])
    huge = 2**70
    assert anna.get(f'{URL}{huge}/').status_code == 404
    assert anna.delete(f'{URL}{huge}/').status_code == 404
    assert anna.get(f'{URL}reisen/{huge}/sparziel/').status_code == 404
