"""Connection Engine V1: Regeln, Rechte, Leak-Schutz.

A und B sind zwei Personen; A und C teilen einen Haushalt (für die
Haushaltsaufgabe), B hat einen eigenen."""

from datetime import date, timedelta
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.test import APIClient

from connections.models import Connection, ObjectType, Origin, RelationType
from core.models import Household, HouseholdMembership
from finanzen.models import SavingsGoal
from haushalt.models import Task as HouseholdTask
from organisation.models import PersonalEvent, PersonalTask

pytestmark = pytest.mark.django_db

URL = '/api/v1/connections/'


def _user(name):
    return get_user_model().objects.create_user(username=name, email=f'{name}@example.com', password='x')


def _client(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


@pytest.fixture
def a():
    return _user('a')


@pytest.fixture
def b():
    return _user('b')


@pytest.fixture
def c():
    return _user('c')


@pytest.fixture
def home_ac(a, c):
    home = Household.objects.create(name='A und C')
    for user in (a, c):
        HouseholdMembership.objects.create(user=user, household=home)
    return home


def goal(owner, title='Neue Waschmaschine', target='700.00', current='480.00'):
    return SavingsGoal.objects.create(owner=owner, title=title, target_amount=Decimal(target), current_amount=Decimal(current))


def task(owner, title='Modelle vergleichen', **extra):
    return PersonalTask.objects.create(owner=owner, title=title, **extra)


def event(owner, title='Lieferung'):
    return PersonalEvent.objects.create(owner=owner, title=title, starts_at=timezone.now() + timedelta(days=5))


def link(client, type_a, id_a, type_b, id_b, **extra):
    return client.post(
        URL, {'source_type': type_a, 'source_id': id_a, 'target_type': type_b, 'target_id': id_b, **extra}, format='json'
    )


# ---------------------------------------------------------------------------
# Die neun geforderten Fälle
# ---------------------------------------------------------------------------


def test_1_user_links_two_own_objects(a):
    r = link(_client(a), 'SAVINGS_GOAL', goal(a).pk, 'TASK', task(a).pk)
    assert r.status_code == 201, r.data
    assert r.data['relation_type'] == 'TASK_FOR' and r.data['origin'] == 'MANUAL'
    saved = Connection.objects.get()
    assert saved.created_by == a and saved.created_at is not None and saved.origin == Origin.MANUAL


def test_2_cannot_link_own_object_with_foreign_object(a, b):
    mine, foreign = goal(a), task(b)
    r = link(_client(a), 'SAVINGS_GOAL', mine.pk, 'TASK', foreign.pk)
    assert r.status_code == 404
    assert not Connection.objects.exists()
    # Auch in Gegenrichtung (fremdes Sparziel, eigene Aufgabe)
    assert link(_client(a), 'TASK', task(a).pk, 'SAVINGS_GOAL', goal(b).pk).status_code == 404


def test_3_cannot_read_foreign_connection(a, b):
    theirs = link(_client(b), 'SAVINGS_GOAL', goal(b).pk, 'TASK', task(b).pk).data
    reader = _client(a)
    assert reader.get(f'{URL}{theirs["id"]}/').status_code == 404
    listing = reader.get(URL, {'object_type': 'TASK', 'object_id': theirs['target']['id']})
    assert listing.status_code == 404  # das Objekt selbst ist für A unsichtbar


def test_4_user_deletes_own_connection(a):
    created = link(_client(a), 'TASK', task(a).pk, 'CALENDAR_EVENT', event(a).pk).data
    r = _client(a).delete(f'{URL}{created["id"]}/')
    assert r.status_code == 204
    assert not Connection.objects.exists()


def test_5_duplicate_is_prevented_in_both_directions(a):
    client = _client(a)
    g, t = goal(a), task(a)
    assert link(client, 'SAVINGS_GOAL', g.pk, 'TASK', t.pk).status_code == 201
    assert link(client, 'SAVINGS_GOAL', g.pk, 'TASK', t.pk).status_code == 409
    assert link(client, 'TASK', t.pk, 'SAVINGS_GOAL', g.pk).status_code == 409  # umgekehrt angegeben
    assert Connection.objects.count() == 1


def test_6_invalid_types_are_rejected(a):
    client = _client(a)
    t = task(a)
    assert link(client, 'SPACESHIP', 1, 'TASK', t.pk).status_code == 400
    assert link(client, 'TASK', t.pk, 'CALENDAR_EVENT', event(a).pk, relation_type='SOMETHING').status_code == 400
    # gültige Typen, aber kein erlaubtes Paar in V1
    assert link(client, 'TASK', t.pk, 'TASK', task(a, 'Zweite').pk).status_code == 400
    assert link(client, 'TRIP', 1, 'TASK', t.pk).status_code == 400
    # gültige Relation, aber nicht für dieses Paar
    assert link(client, 'TASK', t.pk, 'CALENDAR_EVENT', event(a).pk, relation_type='FUNDED_BY').status_code == 400
    assert not Connection.objects.exists()


def test_7_nonexistent_target_is_rejected(a):
    r = link(_client(a), 'SAVINGS_GOAL', goal(a).pk, 'TASK', 999999)
    assert r.status_code == 404
    assert not Connection.objects.exists()


def test_8_object_cannot_link_to_itself(a):
    t = task(a)
    r = link(_client(a), 'TASK', t.pk, 'TASK', t.pk)
    assert r.status_code == 400
    assert not Connection.objects.exists()
    # zusätzlich die Datenbank selbst: Constraint gegen Selbstverbindung
    with pytest.raises(IntegrityError), transaction.atomic():
        Connection.objects.create(source_type='TASK', source_id=t.pk, target_type='TASK', target_id=t.pk)


def test_9_visible_source_with_invisible_target_leaks_nothing(a, c, home_ac):
    """A und C teilen einen Haushalt und sehen dieselbe Haushaltsaufgabe. C hängt
    einen PRIVATEN Termin daran. A darf davon nichts erfahren."""
    shared = HouseholdTask.objects.create(household=home_ac, title='Alte Waschmaschine entsorgen')
    secret = PersonalEvent.objects.create(
        owner=c, title='Geheimer Arzttermin', starts_at=timezone.now() + timedelta(days=1), description='vertraulich'
    )
    created = link(_client(c), 'HOUSEHOLD_TASK', shared.pk, 'CALENDAR_EVENT', secret.pk)
    assert created.status_code == 201, created.data

    reader = _client(a)
    listing = reader.get(URL, {'object_type': 'HOUSEHOLD_TASK', 'object_id': shared.pk})
    assert listing.status_code == 200
    assert listing.data == []  # weder maskiert noch als Zähler
    body = listing.content.decode()
    assert 'Geheimer Arzttermin' not in body and 'vertraulich' not in body and str(secret.pk) not in listing.data.__repr__()

    detail = reader.get(f'{URL}{created.data["id"]}/')
    assert detail.status_code == 404 and 'Geheimer' not in detail.content.decode()
    assert reader.delete(f'{URL}{created.data["id"]}/').status_code == 404
    assert Connection.objects.count() == 1  # A konnte sie auch nicht löschen

    candidates = reader.get(
        URL + 'candidates/', {'object_type': 'HOUSEHOLD_TASK', 'object_id': shared.pk, 'target_type': 'CALENDAR_EVENT'}
    )
    assert candidates.data == []

    # C selbst sieht sie weiterhin, von beiden Seiten
    owner = _client(c)
    assert len(owner.get(URL, {'object_type': 'HOUSEHOLD_TASK', 'object_id': shared.pk}).data) == 1
    assert len(owner.get(URL, {'object_type': 'CALENDAR_EVENT', 'object_id': secret.pk}).data) == 1


# ---------------------------------------------------------------------------
# Weitere Regeln
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    'left,right,relation',
    [
        ('SAVINGS_GOAL', 'TASK', 'TASK_FOR'),
        ('TASK', 'CALENDAR_EVENT', 'SCHEDULED_AS'),
        ('HOUSEHOLD_TASK', 'CALENDAR_EVENT', 'SCHEDULED_AS'),
    ],
)
def test_supported_v1_pairs_work_in_either_argument_order(a, home_ac, left, right, relation):
    def make(kind):
        return {
            'SAVINGS_GOAL': lambda: goal(a),
            'TASK': lambda: task(a),
            'CALENDAR_EVENT': lambda: event(a),
            'HOUSEHOLD_TASK': lambda: HouseholdTask.objects.create(household=home_ac, title='Haushalt'),
        }[kind]().pk

    client = _client(a)
    left_id, right_id = make(left), make(right)
    # Umgekehrt angegeben → wird in die feste Richtung gedreht
    r = link(client, right, right_id, left, left_id)
    assert r.status_code == 201, r.data
    assert (r.data['source']['type'], r.data['target']['type'], r.data['relation_type']) == (left, right, relation)
    saved = Connection.objects.get()
    assert (saved.source_type, saved.target_type) == (left, right)


def test_object_shows_the_connection_from_both_sides(a):
    client = _client(a)
    g, t = goal(a), task(a, due_date=date(2030, 10, 12))
    link(client, 'SAVINGS_GOAL', g.pk, 'TASK', t.pk)

    from_goal = client.get(URL, {'object_type': 'SAVINGS_GOAL', 'object_id': g.pk}).data
    from_task = client.get(URL, {'object_type': 'TASK', 'object_id': t.pk}).data
    assert from_goal[0]['other'] == {'type': 'TASK', 'id': t.pk, 'title': 'Modelle vergleichen',
                                      'subtitle': 'Fällig 12.10.2030', 'domain': 'organisation'}
    assert from_task[0]['other']['title'] == 'Neue Waschmaschine'
    assert from_task[0]['other']['subtitle'] == '480,00 € von 700,00 €'
    assert from_goal[0]['id'] == from_task[0]['id']


def test_own_relation_choice_is_accepted_when_valid(a):
    r = link(_client(a), 'SAVINGS_GOAL', goal(a).pk, 'TASK', task(a).pk, relation_type='RELATED_TO')
    assert r.status_code == 201 and r.data['relation_type'] == 'RELATED_TO'


def test_client_cannot_choose_origin_or_creator(a, b):
    r = _client(a).post(
        URL,
        {'source_type': 'SAVINGS_GOAL', 'source_id': goal(a).pk, 'target_type': 'TASK', 'target_id': task(a).pk,
         'origin': 'AUTOMATED', 'created_by': b.pk},
        format='json',
    )
    assert r.status_code == 201
    saved = Connection.objects.get()
    assert saved.origin == Origin.MANUAL and saved.created_by == a


def test_deleting_connection_keeps_both_objects(a):
    g, t = goal(a), task(a)
    created = link(_client(a), 'SAVINGS_GOAL', g.pk, 'TASK', t.pk).data
    _client(a).delete(f'{URL}{created["id"]}/')
    assert SavingsGoal.objects.filter(pk=g.pk).exists() and PersonalTask.objects.filter(pk=t.pk).exists()


def test_deleting_an_object_removes_its_connections(a):
    g, t = goal(a), task(a)
    link(_client(a), 'SAVINGS_GOAL', g.pk, 'TASK', t.pk)
    t.delete()
    assert not Connection.objects.exists()


def test_deleting_a_user_removes_connections_of_their_objects(a, b):
    link(_client(a), 'SAVINGS_GOAL', goal(a).pk, 'TASK', task(a).pk)
    other = link(_client(b), 'SAVINGS_GOAL', goal(b).pk, 'TASK', task(b).pk)
    a.delete()
    assert list(Connection.objects.values_list('pk', flat=True)) == [other.data['id']]


def test_household_member_of_other_household_cannot_link_household_task(a, b, home_ac):
    shared = HouseholdTask.objects.create(household=home_ac, title='Nur A und C')
    assert link(_client(b), 'HOUSEHOLD_TASK', shared.pk, 'CALENDAR_EVENT', event(b).pk).status_code == 404


def test_orphaned_connection_is_not_listed(a):
    g, t = goal(a), task(a)
    link(_client(a), 'SAVINGS_GOAL', g.pk, 'TASK', t.pk)
    PersonalTask.objects.filter(pk=t.pk)._raw_delete(PersonalTask.objects.db)  # ohne Signal, wie ein Altbestand
    assert _client(a).get(URL, {'object_type': 'SAVINGS_GOAL', 'object_id': g.pk}).data == []


def test_limit_per_object(a, monkeypatch):
    from connections import services

    monkeypatch.setattr(services, 'MAX_CONNECTIONS_PER_OBJECT', 2)
    client = _client(a)
    g = goal(a)
    assert link(client, 'SAVINGS_GOAL', g.pk, 'TASK', task(a, 'T1').pk).status_code == 201
    assert link(client, 'SAVINGS_GOAL', g.pk, 'TASK', task(a, 'T2').pk).status_code == 201
    assert link(client, 'SAVINGS_GOAL', g.pk, 'TASK', task(a, 'T3').pk).status_code == 400


# ---------------------------------------------------------------------------
# Optionen und Kandidaten (Wizard-Schritte 1 und 2)
# ---------------------------------------------------------------------------


def test_options_list_only_supported_partners(a):
    client = _client(a)
    assert [o['type'] for o in client.get(URL + 'options/', {'object_type': 'SAVINGS_GOAL'}).data] == ['TASK']
    assert sorted(o['type'] for o in client.get(URL + 'options/', {'object_type': 'TASK'}).data) == [
        'CALENDAR_EVENT', 'SAVINGS_GOAL',
    ]
    assert client.get(URL + 'options/', {'object_type': 'TRIP'}).data == []
    assert client.get(URL + 'options/', {'object_type': 'NOPE'}).status_code == 400


def test_candidates_are_scoped_searchable_and_exclude_already_linked(a, b):
    g = goal(a)
    mine_open, mine_linked = task(a, 'Modelle vergleichen'), task(a, 'Angebot einholen')
    task(b, 'Fremde Aufgabe')
    link(_client(a), 'SAVINGS_GOAL', g.pk, 'TASK', mine_linked.pk)

    client = _client(a)
    params = {'object_type': 'SAVINGS_GOAL', 'object_id': g.pk, 'target_type': 'TASK'}
    titles = [c['title'] for c in client.get(URL + 'candidates/', params).data]
    assert titles == ['Modelle vergleichen']
    assert [c['title'] for c in client.get(URL + 'candidates/', {**params, 'q': 'modell'}).data] == ['Modelle vergleichen']
    assert client.get(URL + 'candidates/', {**params, 'q': 'zzz'}).data == []
    assert client.get(URL + 'candidates/', {**params, 'target_type': 'CALENDAR_EVENT'}).status_code == 400
    # für ein fremdes Sparziel: 404, keine Kandidatenliste
    assert _client(b).get(URL + 'candidates/', params).status_code == 404
    del mine_open


# ---------------------------------------------------------------------------
# Zugang
# ---------------------------------------------------------------------------


@pytest.mark.parametrize('path', ['', 'options/?object_type=TASK', 'candidates/', '1/'])
def test_authentication_required(path):
    assert APIClient().get(URL + path).status_code == 401
    assert APIClient().post(URL, {}, format='json').status_code == 401


def test_responses_are_not_cached_and_list_needs_valid_query(a):
    client = _client(a)
    assert client.get(URL).status_code == 400
    assert client.get(URL, {'object_type': 'TASK', 'object_id': 'abc'}).status_code == 400
    t = task(a)
    r = client.get(URL, {'object_type': 'TASK', 'object_id': t.pk})
    assert r['Cache-Control'] == 'no-store'


def test_write_rate_limit(a, settings):
    from django.core.cache import caches
    from rest_framework.settings import api_settings  # noqa: F401

    from connections.throttling import ConnectionsWriteRateThrottle

    caches['throttle'].clear()
    client = _client(a)
    # Rate im Test klein halten
    ConnectionsWriteRateThrottle.THROTTLE_RATES = {'connections_write': '2/min'}
    try:
        statuses = [link(client, 'TASK', 1, 'TASK', 1).status_code for _ in range(4)]
    finally:
        del ConnectionsWriteRateThrottle.THROTTLE_RATES
    assert 429 in statuses


# ---------------------------------------------------------------------------
# Verwaiste Verbindungen (Löschungen an den Signalen vorbei)
# ---------------------------------------------------------------------------


def _bypass_signals_delete(model, pk):
    """Wie Raw-SQL oder ein Direkteingriff: keine post_delete-Signale."""
    model.objects.filter(pk=pk)._raw_delete(model.objects.db)


def test_prune_finds_and_removes_orphans_but_keeps_valid_connections(a):
    g1, t1 = goal(a, 'Eins'), task(a, 'Aufgabe eins')
    g2, t2 = goal(a, 'Zwei'), task(a, 'Aufgabe zwei')
    orphan = link(_client(a), 'SAVINGS_GOAL', g1.pk, 'TASK', t1.pk).data['id']
    keep = link(_client(a), 'SAVINGS_GOAL', g2.pk, 'TASK', t2.pk).data['id']
    _bypass_signals_delete(PersonalTask, t1.pk)

    from connections import services

    assert services.find_orphans() == [orphan]
    assert Connection.objects.count() == 2  # finden löscht nicht
    assert services.prune_orphans() == 1
    assert list(Connection.objects.values_list('pk', flat=True)) == [keep]
    assert services.prune_orphans() == 0  # idempotent


def test_prune_covers_the_source_side_too(a):
    g, t = goal(a), task(a)
    link(_client(a), 'SAVINGS_GOAL', g.pk, 'TASK', t.pk)
    _bypass_signals_delete(SavingsGoal, g.pk)

    from connections import services

    assert services.prune_orphans() == 1
    assert not Connection.objects.exists()


def test_prune_handles_more_rows_than_one_sqlite_batch(a):
    from connections import services

    g = goal(a)
    tasks = [task(a, f'T{i}') for i in range(3)]
    for t in tasks:
        Connection.objects.create(source_type='SAVINGS_GOAL', source_id=g.pk, target_type='TASK', target_id=t.pk)
    PersonalTask.objects.all()._raw_delete(PersonalTask.objects.db)
    assert services.prune_orphans() == 3


def test_management_command_reports_and_supports_dry_run(a):
    from io import StringIO

    from django.core.management import call_command

    g, t = goal(a), task(a)
    link(_client(a), 'SAVINGS_GOAL', g.pk, 'TASK', t.pk)
    _bypass_signals_delete(PersonalTask, t.pk)

    dry = StringIO()
    call_command('prune_connections', '--dry-run', stdout=dry)
    assert '1 verwaiste Verbindung' in dry.getvalue() and Connection.objects.count() == 1

    real = StringIO()
    call_command('prune_connections', stdout=real)
    assert '1 verwaiste Verbindung(en) entfernt' in real.getvalue() and Connection.objects.count() == 0
