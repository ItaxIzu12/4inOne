"""„Heute“ aus allen Bereichen: jede Person sieht nur, was sie in der
jeweiligen Domain auch sehen darf (ADR-001)."""

from datetime import timedelta
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import Household, HouseholdMembership
from finanzen.models import MonthlyBudget, Transaction
from haushalt.models import FolderEntry, ShoppingItem, ShoppingList, Task as HouseholdTask
from organisation.models import PersonalTask
from reisen.models import Trip, TripEvent, TripParticipant

pytestmark = pytest.mark.django_db

URL = '/api/v1/today/'


def _user(name):
    return get_user_model().objects.create_user(username=f'{name}@example.com', email=f'{name}@example.com', password='x')


def _get(user, **params):
    client = APIClient()
    client.force_authenticate(user)
    response = client.get(URL, params)
    assert response.status_code == 200, response.data
    return response.data


@pytest.fixture
def world():
    anna, ben, kid, clara = (_user(n) for n in ('anna', 'ben', 'kid', 'clara'))
    home = Household.objects.create(name='Zuhause')
    HouseholdMembership.objects.create(user=anna, household=home)
    HouseholdMembership.objects.create(user=ben, household=home)
    HouseholdMembership.objects.create(user=kid, household=home, role=HouseholdMembership.Role.CHILD_ACCOUNT)
    return {'anna': anna, 'ben': ben, 'kid': kid, 'clara': clara, 'home': home}


def test_today_combines_every_area_for_its_owner(world):
    anna, home = world['anna'], world['home']
    today = timezone.localdate()
    PersonalTask.objects.create(owner=anna, title='Arzt anrufen', due_date=today)
    HouseholdTask.objects.create(household=home, title='Müll', due_date=today, assigned_to=anna)
    HouseholdTask.objects.create(household=home, title='Spülmaschine', due_date=today - timedelta(days=1))
    FolderEntry.objects.create(household=home, kind='geraet', name='Heizung', next_maintenance=today + timedelta(days=5))
    shopping = ShoppingList.objects.create(household=home)
    ShoppingItem.objects.create(shopping_list=shopping, name='Milch')
    MonthlyBudget.objects.create(owner=anna, month=today.replace(day=1), amount=Decimal('1000.00'))
    Transaction.objects.create(owner=anna, type='EXPENSE', amount=Decimal('25.00'), datum=today)
    trip = Trip.objects.create(owner=anna, title='Rom', destination='Rom', start_date=today + timedelta(days=3), end_date=today + timedelta(days=6))

    data = _get(anna)

    assert [i['title'] for i in data['organisation']['items']] == ['Arzt anrufen']
    assert {t['title'] for t in data['haushalt']['tasks']} == {'Müll', 'Spülmaschine'}
    assert next(t for t in data['haushalt']['tasks'] if t['title'] == 'Spülmaschine')['overdue'] is True
    assert data['haushalt']['deadlines'][0]['title'] == 'Wartung: Heizung'
    assert data['haushalt']['shopping_open'] == 1
    assert data['reisen']['upcoming']['id'] == trip.pk
    assert data['reisen']['upcoming']['days_until'] == 3
    assert data['finanzen'] == {
        'month': today.strftime('%Y-%m'), 'budget': '1000.00', 'expenses': '25.00',
        'available': '975.00', 'spent_today': '25.00',
    }
    # Leere Packliste drei Tage vor Abreise → der wichtigste Vorschlag.
    assert data['suggestions'][0]['key'] == f'trip:{trip.pk}:packing'


def test_today_shows_nothing_of_other_people(world):
    anna, ben, clara, home = world['anna'], world['ben'], world['clara'], world['home']
    today = timezone.localdate()
    PersonalTask.objects.create(owner=anna, title='Annas Privates', due_date=today)
    HouseholdTask.objects.create(household=home, title='Bens Aufgabe', due_date=today, assigned_to=ben)
    Transaction.objects.create(owner=anna, type='EXPENSE', amount=Decimal('99.00'), datum=today)
    Trip.objects.create(owner=anna, title='Annas Reise', start_date=today, end_date=today + timedelta(days=2))

    for_ben = _get(ben)
    assert for_ben['organisation']['items'] == []
    assert [t['title'] for t in for_ben['haushalt']['tasks']] == ['Bens Aufgabe']
    assert for_ben['finanzen']['expenses'] == '0.00'
    assert for_ben['reisen'] == {'current': None, 'upcoming': None, 'events': []}
    assert for_ben['suggestions'] == []

    # Ohne Haushalt kein Haushaltsabschnitt, statt einer leeren Karte.
    for_clara = _get(clara)
    assert for_clara['haushalt'] is None
    assert [t['title'] for t in _get(anna)['haushalt']['tasks']] == []


def test_shared_trip_appears_for_the_participant_but_not_my_household(world):
    anna, clara, home = world['anna'], world['clara'], world['home']
    today = timezone.localdate()
    trip = Trip.objects.create(owner=anna, title='Wandern', start_date=today, end_date=today + timedelta(days=2))
    TripParticipant.objects.create(trip=trip, user=clara, role=TripParticipant.Role.VIEWER)
    TripEvent.objects.create(trip=trip, title='Hütte einchecken', starts_at=timezone.now())
    HouseholdTask.objects.create(household=home, title='Annas Haushalt', due_date=today)

    data = _get(clara)

    assert data['reisen']['current']['id'] == trip.pk
    assert [e['title'] for e in data['reisen']['events']] == ['Hütte einchecken']
    assert data['haushalt'] is None


def test_child_accounts_see_tasks_but_no_folder_deadlines(world):
    kid, home = world['kid'], world['home']
    today = timezone.localdate()
    HouseholdTask.objects.create(household=home, title='Zimmer aufräumen', due_date=today, assigned_to=kid)
    FolderEntry.objects.create(household=home, kind='vertrag', name='Strom', contract_end=today + timedelta(days=3))

    data = _get(kid)

    assert [t['title'] for t in data['haushalt']['tasks']] == ['Zimmer aufräumen']
    assert data['haushalt']['deadlines'] == []


def test_unknown_timezone_and_anonymous_are_rejected(world):
    client = APIClient()
    assert client.get(URL).status_code == 401
    client.force_authenticate(world['anna'])
    assert client.get(URL, {'timezone': 'Mars/Olympus'}).status_code == 400
