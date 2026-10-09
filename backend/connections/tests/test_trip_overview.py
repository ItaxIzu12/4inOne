"""Reiter „Erinnerungen“ und „Budget“ (Sparbetrag) einer Reise sowie die neuen Reise-Felder."""

from datetime import datetime, time, timedelta
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from connections.models import Connection, ObjectType
from core.models import Household, HouseholdMembership
from finanzen.models import SavingsGoal
from haushalt.models import Task as HouseholdTask
from organisation.models import PersonalEvent, PersonalTask
from reisen.models import PackingItem, Trip, TripEvent, TripExpense, TripParticipant, TripTask

pytestmark = pytest.mark.django_db
BASE = '/api/v1/connections/reisen/'
REISEN = '/api/v1/reisen/'


def _user(name):
    return get_user_model().objects.create_user(username=f'{name}@example.com', email=f'{name}@example.com', password='x')


def _client(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


@pytest.fixture
def people():
    anna, ben, fremd = (_user(n) for n in ('anna', 'ben', 'fremd'))
    home = Household.objects.create(name='Zuhause')
    HouseholdMembership.objects.create(user=anna, household=home)
    ben_home = Household.objects.create(name='Bens Haushalt')
    HouseholdMembership.objects.create(user=ben, household=ben_home)
    today = timezone.localdate()
    trip = Trip.objects.create(owner=anna, title='Berlin Wochenende', start_date=today + timedelta(days=3),
                               end_date=today + timedelta(days=5), status=Trip.Status.CONFIRMED)
    TripParticipant.objects.create(trip=trip, user=anna, role=TripParticipant.Role.OWNER)
    TripParticipant.objects.create(trip=trip, user=ben, role=TripParticipant.Role.EDITOR)
    return {'anna': anna, 'ben': ben, 'fremd': fremd, 'home': home, 'ben_home': ben_home, 'trip': trip, 'today': today}


def test_reminders_combine_trip_items_with_own_household_and_calendar(people):
    anna, trip, today = people['anna'], people['trip'], people['today']
    TripTask.objects.create(trip=trip, title='Online Check-in öffnen', due_date=today + timedelta(days=1), due_time=time(18))
    TripTask.objects.create(trip=trip, title='Erledigt', due_date=today, status=TripTask.Status.DONE)
    tz = timezone.get_current_timezone()
    TripEvent.objects.create(trip=trip, title='Abreise', location='Hauptbahnhof',
                             starts_at=datetime.combine(today + timedelta(days=3), time(8), tzinfo=tz))
    HouseholdTask.objects.create(household=people['home'], title='Pflanzen gießen', due_date=today + timedelta(days=4))
    HouseholdTask.objects.create(household=people['home'], title='Nach der Reise', due_date=today + timedelta(days=9))
    HouseholdTask.objects.create(household=people['home'], title='Für Ben', due_date=today + timedelta(days=4),
                                 assigned_to=people['ben'])
    PersonalEvent.objects.create(owner=anna, title='Zahnarzt', starts_at=datetime.combine(today + timedelta(days=2), time(9), tzinfo=tz))
    PersonalTask.objects.create(owner=anna, title='Steuer', due_date=today + timedelta(days=4))

    response = _client(anna).get(f'{BASE}{trip.pk}/erinnerungen/')
    assert response.status_code == 200, response.data
    items = {i['title']: i for i in response.data['items']}
    assert set(items) == {'Online Check-in öffnen', 'Erledigt', 'Abreise', 'Pflanzen gießen', 'Zahnarzt', 'Steuer'}
    checkin = items['Online Check-in öffnen']
    assert (checkin['area'], checkin['time'], checkin['place'], checkin['done']) == ('REISEN', '18:00', 'Berlin Wochenende', False)
    assert items['Erledigt']['done'] is True
    assert items['Abreise']['place'] == 'Hauptbahnhof'
    assert items['Abreise']['time'] == '08:00'
    assert items['Pflanzen gießen']['area'] == 'HAUSHALT'
    assert items['Pflanzen gießen']['place'] == 'Zuhause'
    assert items['Zahnarzt']['area'] == 'ORGANISATION'
    # sortiert nach Tag und Uhrzeit
    days = [i['date'] for i in response.data['items']]
    assert days == sorted(days)


def test_fellow_traveller_sees_trip_reminders_but_never_others_private_items(people):
    anna, ben, trip, today = people['anna'], people['ben'], people['trip'], people['today']
    TripTask.objects.create(trip=trip, title='Tickets ausdrucken', due_date=today + timedelta(days=1))
    HouseholdTask.objects.create(household=people['home'], title='Annas Pflanzen', due_date=today + timedelta(days=4))
    PersonalTask.objects.create(owner=anna, title='Annas Steuer', due_date=today + timedelta(days=4))
    HouseholdTask.objects.create(household=people['ben_home'], title='Bens Müll', due_date=today + timedelta(days=4))

    titles = {i['title'] for i in _client(ben).get(f'{BASE}{trip.pk}/erinnerungen/').data['items']}
    assert titles == {'Tickets ausdrucken', 'Bens Müll'}


def test_reminders_and_savings_of_foreign_trip_are_not_found(people):
    client = _client(people['fremd'])
    assert client.get(f"{BASE}{people['trip'].pk}/erinnerungen/").status_code == 404
    assert client.get(f"{BASE}{people['trip'].pk}/sparziel/").status_code == 404
    assert APIClient().get(f"{BASE}{people['trip'].pk}/erinnerungen/").status_code in (401, 403)


def test_savings_shows_only_own_linked_goals(people):
    anna, ben, trip = people['anna'], people['ben'], people['trip']
    mine = SavingsGoal.objects.create(owner=anna, title='Reise: Berlin', target_amount=Decimal('300'), current_amount=Decimal('150'))
    bens = SavingsGoal.objects.create(owner=ben, title='Bens Reisekasse', target_amount=Decimal('200'))
    SavingsGoal.objects.create(owner=anna, title='Nicht verknüpft', target_amount=Decimal('50'))
    for goal in (mine, bens):
        Connection.objects.create(source_type=ObjectType.TRIP, source_id=trip.pk, target_type=ObjectType.SAVINGS_GOAL, target_id=goal.pk)

    assert _client(anna).get(f'{BASE}{trip.pk}/sparziel/').data == [
        {'id': mine.pk, 'title': 'Reise: Berlin', 'current_amount': '150.00', 'target_amount': '300.00'}
    ]
    assert [g['title'] for g in _client(ben).get(f'{BASE}{trip.pk}/sparziel/').data] == ['Bens Reisekasse']


def test_trip_details_status_and_expense_category(people):
    client, trip = _client(people['anna']), people['trip']
    response = client.patch(f'{REISEN}trips/{trip.pk}/', {
        'status': 'CONFIRMED', 'accommodation': 'Hotel Central', 'accommodation_area': 'Berlin Mitte', 'transport_note': 'Hin- und Rückfahrt gebucht',
    }, format='json')
    assert response.status_code == 200, response.data
    assert response.data['accommodation'] == 'Hotel Central'
    assert client.patch(f'{REISEN}trips/{trip.pk}/', {'status': 'GEBUCHT'}, format='json').status_code == 400
    expense = client.post(f'{REISEN}expenses/', {'trip': trip.pk, 'title': 'Hotel', 'amount': '200.00',
                                                  'date': str(trip.start_date), 'category': 'UNTERKUNFT'}, format='json')
    assert expense.status_code == 201, expense.data
    assert TripExpense.objects.get(pk=expense.data['id']).category == 'UNTERKUNFT'
    default = client.post(f'{REISEN}expenses/', {'trip': trip.pk, 'title': 'Snack', 'amount': '3.00', 'date': str(trip.start_date)}, format='json')
    assert default.data['category'] == 'SONSTIGES'


def test_task_time_needs_a_date(people):
    client, trip = _client(people['anna']), people['trip']
    assert client.post(f'{REISEN}tasks/', {'trip': trip.pk, 'title': 'X', 'due_time': '18:00'}, format='json').status_code == 400
    ok = client.post(f'{REISEN}tasks/', {'trip': trip.pk, 'title': 'X', 'due_date': str(trip.start_date), 'due_time': '18:00'}, format='json')
    assert ok.status_code == 201
    cleared = client.patch(f"{REISEN}tasks/{ok.data['id']}/", {'due_date': None}, format='json')
    assert cleared.data['due_time'] is None


def test_packed_at_follows_the_checkbox_and_reset_needs_write_access(people):
    anna, trip = people['anna'], people['trip']
    client = _client(anna)
    item = client.post(f'{REISEN}packing-items/', {'trip': trip.pk, 'title': 'Reisepass', 'category': 'UNTERWEGS'}, format='json').data
    assert item['packed_at'] is None
    packed = client.patch(f"{REISEN}packing-items/{item['id']}/", {'is_packed': True}, format='json').data
    assert packed['packed_at'] is not None
    # ein erneutes Speichern ohne Änderung des Häkchens lässt das Datum stehen
    again = client.patch(f"{REISEN}packing-items/{item['id']}/", {'title': 'Reisepass (gültig)'}, format='json').data
    assert again['packed_at'] == packed['packed_at']
    # Zuschauer dürfen nicht zurücksetzen, Fremde sehen die Reise gar nicht
    viewer = _user('vera')
    TripParticipant.objects.create(trip=trip, user=viewer, role=TripParticipant.Role.VIEWER)
    assert _client(viewer).post(f'{REISEN}packing-items/zuruecksetzen/?trip={trip.pk}').status_code == 403
    assert _client(people['fremd']).post(f'{REISEN}packing-items/zuruecksetzen/?trip={trip.pk}').status_code == 404
    assert PackingItem.objects.get(pk=item['id']).is_packed is True
    response = client.post(f'{REISEN}packing-items/zuruecksetzen/?trip={trip.pk}')
    assert response.data == {'reset': 1}
    reset = PackingItem.objects.get(pk=item['id'])
    assert (reset.is_packed, reset.packed_at) == (False, None)


def test_a_cancelled_trip_gets_no_suggestions_but_a_confirmed_trip_does(people):
    anna, trip = people['anna'], people['trip']
    HouseholdTask.objects.create(household=people['home'], title='Pflanzen gießen', due_date=trip.start_date)
    url = '/api/v1/connections/suggestions/'
    assert any(s['kind'] == 'TRIP_HOUSEHOLD_TASK' for s in _client(anna).get(url, {'trip': trip.pk}).data)
    Trip.objects.filter(pk=trip.pk).update(status=Trip.Status.CANCELLED)
    assert _client(anna).get(url, {'trip': trip.pk}).data == []
