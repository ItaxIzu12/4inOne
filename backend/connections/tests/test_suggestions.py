"""Vorschläge V1 — „Reise planen“: Sparziel, Haushaltsfolgen, Packliste.

Schwerpunkt: Datenschutz und Berechtigungen (ADR-001). Ein Vorschlag darf
nie etwas zeigen oder ändern, was die Person in der Domain nicht darf."""

from datetime import date, timedelta
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from connections import suggestions
from connections.models import Connection, ObjectType, Origin, RelationType, SuggestionDismissal
from core.models import Household, HouseholdMembership
from finanzen.models import MonthlyBudget, SavingsGoal
from haushalt.models import Task as HouseholdTask
from reisen.models import PackingItem, Trip, TripBudgetCategory, TripParticipant

pytestmark = pytest.mark.django_db

URL = '/api/v1/connections/suggestions/'


def _user(name):
    return get_user_model().objects.create_user(
        username=f'{name}@example.com', email=f'{name}@example.com', password='x', first_name=name.capitalize()
    )


def _client(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


def _today():
    return timezone.localdate()


@pytest.fixture
def people():
    anna, ben, clara, fremd = (_user(n) for n in ('anna', 'ben', 'clara', 'fremd'))
    home = Household.objects.create(name='Zuhause')
    HouseholdMembership.objects.create(user=anna, household=home)
    HouseholdMembership.objects.create(user=ben, household=home)
    clara_home = Household.objects.create(name='Claras Haushalt')
    HouseholdMembership.objects.create(user=clara, household=clara_home)
    return {'anna': anna, 'ben': ben, 'clara': clara, 'fremd': fremd, 'home': home, 'clara_home': clara_home}


def _trip(owner, start_in=60, days=7, **extra):
    start = _today() + timedelta(days=start_in)
    defaults = {'title': 'Lissabon', 'destination': 'Lissabon', 'start_date': start, 'end_date': start + timedelta(days=days)}
    defaults.update(extra)
    return Trip.objects.create(owner=owner, **defaults)


def _keys(client, trip):
    response = client.get(URL, {'trip': trip.pk})
    assert response.status_code == 200, response.data
    return {s['key']: s for s in response.data}


def _budget_for_every_month(user):
    MonthlyBudget.objects.create(owner=user, month=_today().replace(day=1), open_ended=True, amount=Decimal('3000.00'))


# ---------------------------------------------------------------------------
# Sparziel
# ---------------------------------------------------------------------------


def test_trip_with_budget_suggests_a_savings_goal_with_monthly_rate(people):
    anna = people['anna']
    _budget_for_every_month(anna)
    trip = _trip(anna, start_in=95, budget_amount=Decimal('1200.00'))

    found = _keys(_client(anna), trip)[f'trip:{trip.pk}:goal']

    months = found['detail']['months']
    assert months >= 3
    assert Decimal(found['detail']['target_amount']) == Decimal('1200.00')
    assert Decimal(found['detail']['monthly_amount']) * months >= Decimal('1200.00')
    assert 'pro Monat' in found['reason']


def test_accepting_the_goal_creates_a_private_goal_and_a_suggested_connection(people):
    anna = people['anna']
    _budget_for_every_month(anna)
    trip = _trip(anna, start_in=95, budget_amount=Decimal('900.00'))
    client = _client(anna)

    response = client.post(URL + 'accept/', {'key': f'trip:{trip.pk}:goal', 'action': 'create_goal'}, format='json')

    assert response.status_code == 200, response.data
    goal = SavingsGoal.objects.get(pk=response.data['savings_goal_id'])
    assert goal.owner == anna
    assert goal.target_amount == Decimal('900.00')
    assert goal.monthly_amount is not None
    assert goal.target_date == trip.start_date
    connection = Connection.objects.get()
    assert (connection.source_type, connection.source_id) == (ObjectType.TRIP, trip.pk)
    assert (connection.target_type, connection.target_id) == (ObjectType.SAVINGS_GOAL, goal.pk)
    assert connection.relation_type == RelationType.FUNDED_BY
    assert connection.origin == Origin.SUGGESTED
    # Der Anlass ist weg — der Vorschlag auch.
    assert f'trip:{trip.pk}:goal' not in _keys(client, trip)


def test_without_monthly_budgets_the_goal_has_no_rate_and_says_why(people):
    anna = people['anna']
    trip = _trip(anna, start_in=95, budget_amount=Decimal('600.00'))
    client = _client(anna)

    found = _keys(client, trip)[f'trip:{trip.pk}:goal']
    assert found['detail']['monthly_amount'] is None
    assert 'Budget' in found['reason']

    response = client.post(URL + 'accept/', {'key': found['key'], 'action': 'create_goal'}, format='json')
    assert response.status_code == 200, response.data
    assert SavingsGoal.objects.get(owner=anna).monthly_amount is None


def test_trip_without_budget_suggests_setting_one_only_to_people_who_may_edit(people):
    anna, clara = people['anna'], people['clara']
    trip = _trip(anna)
    TripParticipant.objects.create(trip=trip, user=clara, role=TripParticipant.Role.VIEWER)

    assert f'trip:{trip.pk}:budget' in _keys(_client(anna), trip)
    assert _keys(_client(clara), trip) == {}


def test_budget_categories_count_when_no_total_is_set(people):
    anna = people['anna']
    trip = _trip(anna)
    TripBudgetCategory.objects.create(trip=trip, category='UNTERKUNFT', planned_amount=Decimal('400.00'))
    TripBudgetCategory.objects.create(trip=trip, category='TRANSPORT', planned_amount=Decimal('200.00'))

    found = _keys(_client(anna), trip)[f'trip:{trip.pk}:goal']
    assert Decimal(found['detail']['target_amount']) == Decimal('600.00')


def test_shared_trip_splits_the_budget_and_each_goal_stays_private(people):
    anna, clara = people['anna'], people['clara']
    trip = _trip(anna, budget_amount=Decimal('1000.00'))
    TripParticipant.objects.create(trip=trip, user=clara, role=TripParticipant.Role.EDITOR)

    for_clara = _keys(_client(clara), trip)[f'trip:{trip.pk}:goal']
    assert Decimal(for_clara['detail']['target_amount']) == Decimal('500.00')
    assert 'geteilt durch 2 Personen' in for_clara['reason']

    _client(anna).post(URL + 'accept/', {'key': f'trip:{trip.pk}:goal', 'action': 'create_goal'}, format='json')
    anna_goal = SavingsGoal.objects.get(owner=anna)

    # Annas Sparziel ist für Clara weder als Verbindung noch als Objekt sichtbar,
    # und Clara bekommt ihren eigenen Vorschlag weiterhin.
    connections = _client(clara).get('/api/v1/connections/', {'object_type': 'TRIP', 'object_id': trip.pk})
    assert connections.status_code == 200
    assert connections.data == []
    assert _client(clara).get(f'/api/v1/finanzen/private/goals/{anna_goal.pk}/').status_code == 404
    assert f'trip:{trip.pk}:goal' in _keys(_client(clara), trip)


def test_no_goal_for_started_or_cancelled_trips(people):
    anna = people['anna']
    started = _trip(anna, start_in=0, budget_amount=Decimal('100.00'))
    cancelled = _trip(anna, budget_amount=Decimal('100.00'), status=Trip.Status.CANCELLED)
    client = _client(anna)
    for trip in (started, cancelled):
        assert not any(key.endswith(('goal', 'budget', 'goal-foreign')) for key in _keys(client, trip))


def test_foreign_currency_trip_explains_and_points_to_finance(people):
    anna = people['anna']
    trip = _trip(anna, budget_amount=Decimal('800.00'), currency=Trip.Currency.USD)
    client = _client(anna)

    found = _keys(client, trip)
    assert f'trip:{trip.pk}:goal' not in found
    hint = found[f'trip:{trip.pk}:goal-foreign']
    assert 'USD' in hint['reason'] and 'Euro' in hint['reason']
    assert hint['actions'] == [{'action': 'open_finance', 'label': 'Sparziel in Finanzen anlegen', 'navigate': True}]
    # Nur eine Ansicht — nichts wird gespeichert.
    response = client.post(URL + 'accept/', {'key': hint['key'], 'action': 'open_finance'}, format='json')
    assert response.status_code == 400
    assert not SavingsGoal.objects.exists()


# ---------------------------------------------------------------------------
# Haushaltsfolgen
# ---------------------------------------------------------------------------


def test_household_tasks_inside_the_trip_window_are_suggested(people):
    anna, home = people['anna'], people['home']
    trip = _trip(anna, start_in=10, days=7)
    inside = HouseholdTask.objects.create(household=home, title='Müll', due_date=trip.start_date + timedelta(days=2), assigned_to=anna)
    weekly = HouseholdTask.objects.create(household=home, title='Blumen', due_date=_today() + timedelta(days=1), recurrence_days=7)
    HouseholdTask.objects.create(household=home, title='Danach', due_date=trip.end_date + timedelta(days=3), assigned_to=anna)
    HouseholdTask.objects.create(household=home, title='Bens Sache', due_date=trip.start_date, assigned_to=people['ben'])

    found = _keys(_client(anna), trip)

    task_keys = {k for k in found if ':htask:' in k}
    assert task_keys == {f'trip:{trip.pk}:htask:{inside.pk}', f'trip:{trip.pk}:htask:{weekly.pk}'}
    one_off = found[f'trip:{trip.pk}:htask:{inside.pk}']
    assert [a['action'] for a in one_off['actions']] == ['postpone', 'hand_over', 'link']
    assert one_off['detail']['members'] == [{'id': people['ben'].pk, 'name': 'Ben'}]
    # Der nächste Termin liegt VOR der Reise: Verschieben würde ihn überspringen.
    recurring = found[f'trip:{trip.pk}:htask:{weekly.pk}']
    assert [a['action'] for a in recurring['actions']] == ['hand_over', 'link']
    assert 'jede Woche' in recurring['reason']


def test_postpone_moves_the_task_after_the_trip_and_links_it(people):
    anna, home = people['anna'], people['home']
    trip = _trip(anna, start_in=10, days=5)
    task = HouseholdTask.objects.create(household=home, title='Müll', due_date=trip.start_date + timedelta(days=1))
    client = _client(anna)

    response = client.post(URL + 'accept/', {'key': f'trip:{trip.pk}:htask:{task.pk}', 'action': 'postpone'}, format='json')

    assert response.status_code == 200, response.data
    task.refresh_from_db()
    assert task.due_date == trip.end_date + timedelta(days=1)
    connection = Connection.objects.get()
    assert connection.relation_type == RelationType.AFFECTS
    assert connection.origin == Origin.SUGGESTED
    assert not any(':htask:' in key for key in _keys(client, trip))


def test_hand_over_only_to_a_member_of_the_same_household(people):
    anna, home = people['anna'], people['home']
    trip = _trip(anna, start_in=10)
    task = HouseholdTask.objects.create(household=home, title='Katze füttern', due_date=trip.start_date, assigned_to=anna)
    client = _client(anna)
    key = f'trip:{trip.pk}:htask:{task.pk}'

    stranger = client.post(URL + 'accept/', {'key': key, 'action': 'hand_over', 'member_id': people['clara'].pk}, format='json')
    assert stranger.status_code == 400
    task.refresh_from_db()
    assert task.assigned_to == anna

    ok = client.post(URL + 'accept/', {'key': key, 'action': 'hand_over', 'member_id': people['ben'].pk}, format='json')
    assert ok.status_code == 200, ok.data
    task.refresh_from_db()
    assert task.assigned_to == people['ben']


def test_a_fellow_traveller_never_sees_or_touches_my_household(people):
    anna, clara, home = people['anna'], people['clara'], people['home']
    trip = _trip(anna, start_in=10)
    TripParticipant.objects.create(trip=trip, user=clara, role=TripParticipant.Role.EDITOR)
    task = HouseholdTask.objects.create(household=home, title='Annas Müll', due_date=trip.start_date)
    own = HouseholdTask.objects.create(household=people['clara_home'], title='Claras Pflanzen', due_date=trip.start_date)

    for_clara = _keys(_client(clara), trip)
    assert f'trip:{trip.pk}:htask:{task.pk}' not in for_clara
    assert f'trip:{trip.pk}:htask:{own.pk}' in for_clara

    attempt = _client(clara).post(
        URL + 'accept/', {'key': f'trip:{trip.pk}:htask:{task.pk}', 'action': 'postpone'}, format='json'
    )
    assert attempt.status_code == 404
    task.refresh_from_db()
    assert task.due_date == trip.start_date

    # Annas Verknüpfung zu ihrer Haushaltsaufgabe bleibt für Clara unsichtbar.
    _client(anna).post(URL + 'accept/', {'key': f'trip:{trip.pk}:htask:{task.pk}', 'action': 'link'}, format='json')
    assert _client(clara).get('/api/v1/connections/', {'object_type': 'TRIP', 'object_id': trip.pk}).data == []


def test_occurs_between_handles_daily_weekly_and_monthly_tasks():
    start, end = date(2026, 11, 10), date(2026, 11, 16)
    def task(**kw):
        return HouseholdTask(title='x', **kw)
    assert suggestions.occurs_between(task(due_date=date(2026, 11, 1), recurrence_days=7), start, end) == date(2026, 11, 15)
    assert suggestions.occurs_between(task(due_date=date(2026, 11, 1), recurrence_days=30), start, end) is None
    assert suggestions.occurs_between(task(due_date=date(2026, 10, 12), recurrence_months=1), start, end) == date(2026, 11, 12)
    assert suggestions.occurs_between(task(due_date=date(2026, 10, 20), recurrence_months=1), start, end) is None
    assert suggestions.occurs_between(task(due_date=date(2026, 11, 20)), start, end) is None
    assert suggestions.occurs_between(task(due_date=None, recurrence_days=1), start, end) is None


# ---------------------------------------------------------------------------
# Packliste, Ablehnen, Zugriff
# ---------------------------------------------------------------------------


def test_empty_packing_list_shortly_before_departure(people):
    anna = people['anna']
    soon = _trip(anna, start_in=3)
    later = _trip(anna, start_in=30)
    packed = _trip(anna, start_in=2)
    PackingItem.objects.create(trip=packed, title='Pass')
    client = _client(anna)

    assert _keys(client, soon)[f'trip:{soon.pk}:packing']['reason'].endswith('noch leer.')
    assert f'trip:{later.pk}:packing' not in _keys(client, later)
    assert f'trip:{packed.pk}:packing' not in _keys(client, packed)
    navigate = client.post(URL + 'accept/', {'key': f'trip:{soon.pk}:packing', 'action': 'open_packing'}, format='json')
    assert navigate.status_code == 400


def test_dismissed_suggestions_do_not_come_back(people):
    anna = people['anna']
    trip = _trip(anna, start_in=3)
    client = _client(anna)
    key = f'trip:{trip.pk}:packing'

    assert client.post(URL + 'dismiss/', {'key': key}, format='json').status_code == 204
    assert key not in _keys(client, trip)
    assert SuggestionDismissal.objects.filter(user=anna, key=key).exists()
    # Nur für Anna — Ben (Mitreisender mit Schreibrecht) sieht ihn weiter.
    TripParticipant.objects.create(trip=trip, user=people['ben'], role=TripParticipant.Role.EDITOR)
    assert key in _keys(_client(people['ben']), trip)


def test_foreign_trips_and_made_up_keys_look_like_nothing(people):
    anna, fremd = people['anna'], people['fremd']
    trip = _trip(anna, start_in=3, budget_amount=Decimal('500.00'))
    client = _client(fremd)

    assert client.get(URL, {'trip': trip.pk}).status_code == 404
    assert client.get(URL, {'trip': 999999}).status_code == 404
    for key in (f'trip:{trip.pk}:goal', f'trip:{trip.pk}:packing', 'trip:abc:goal', 'nonsense'):
        assert client.post(URL + 'accept/', {'key': key, 'action': 'create_goal'}, format='json').status_code == 404
        assert client.post(URL + 'dismiss/', {'key': key}, format='json').status_code == 404
    assert not SavingsGoal.objects.exists()
    assert not SuggestionDismissal.objects.exists()
    assert APIClient().get(URL).status_code == 401


def test_action_must_match_the_suggestion(people):
    anna = people['anna']
    trip = _trip(anna, start_in=95, budget_amount=Decimal('300.00'))
    response = _client(anna).post(URL + 'accept/', {'key': f'trip:{trip.pk}:goal', 'action': 'postpone'}, format='json')
    assert response.status_code == 400
    assert not SavingsGoal.objects.exists()


def test_without_trip_param_all_upcoming_trips_are_covered(people):
    anna = people['anna']
    soon = _trip(anna, start_in=2)
    _trip(anna, start_in=-30, days=3)  # vorbei
    response = _client(anna).get(URL)
    assert response.status_code == 200
    assert {s['trip']['id'] for s in response.data} == {soon.pk}
