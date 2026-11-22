"""O4 – Globale Suche: findet aus allen Bereichen, aber nur, was die Person auch in der Domain sehen darf."""

from datetime import timedelta
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.core.cache import caches
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import Household, HouseholdMembership
from finanzen.models import Category, SavingsGoal, Transaction
from haushalt.models import FolderEntry, Task as HouseholdTask
from organisation.models import PersonalEvent, PersonalNote, PersonalTask
from reisen.models import Trip, TripParticipant

pytestmark = pytest.mark.django_db

URL = '/api/v1/search/'


@pytest.fixture(autouse=True)
def _fresh_throttle():
    caches['throttle'].clear()


def _user(name):
    return get_user_model().objects.create_user(username=f'{name}@example.com', email=f'{name}@example.com', password='x')


def _search(user, q):
    client = APIClient()
    client.force_authenticate(user)
    response = client.get(URL, {'q': q})
    assert response.status_code == 200, response.data
    return response.data


def _titles(data):
    return {g['type']: [i['title'] for i in g['items']] for g in data['groups']}


@pytest.fixture
def world():
    anna, ben, kid, clara = (_user(n) for n in ('anna', 'ben', 'kid', 'clara'))
    home = Household.objects.create(name='Zuhause')
    HouseholdMembership.objects.create(user=anna, household=home)
    HouseholdMembership.objects.create(user=ben, household=home)
    HouseholdMembership.objects.create(user=kid, household=home, role=HouseholdMembership.Role.CHILD_ACCOUNT)
    return {'anna': anna, 'ben': ben, 'kid': kid, 'clara': clara, 'home': home}


def test_finds_across_areas_with_links(world):
    anna, home = world['anna'], world['home']
    today = timezone.localdate()
    PersonalTask.objects.create(owner=anna, title='Berlin Hotel bezahlen')
    PersonalEvent.objects.create(owner=anna, title='Zug nach Berlin', starts_at=timezone.now(), ends_at=timezone.now() + timedelta(hours=1))
    PersonalNote.objects.create(owner=anna, title='', body='Restaurants in Berlin\nMitte')
    HouseholdTask.objects.create(household=home, title='Pflanzen gießen vor Berlin')
    trip = Trip.objects.create(owner=anna, title='Berlin Wochenende', start_date=today, end_date=today + timedelta(days=2))
    SavingsGoal.objects.create(owner=anna, title='Berlin-Reise', target_amount=Decimal('500'), current_amount=Decimal('0'))
    category = Category.objects.create(owner=anna, name='Reisen', color='#000000')
    Transaction.objects.create(owner=anna, type='EXPENSE', amount=Decimal('39.90'), datum=today, description='Bahn Berlin', category=category)

    data = _search(anna, 'berlin')

    assert _titles(data) == {
        'CALENDAR_EVENT': ['Zug nach Berlin'],
        'TASK': ['Berlin Hotel bezahlen'],
        'NOTE': ['Restaurants in Berlin'],
        'HOUSEHOLD_TASK': ['Pflanzen gießen vor Berlin'],
        'TRIP': ['Berlin Wochenende'],
        'SAVINGS_GOAL': ['Berlin-Reise'],
        'TRANSACTION': ['Bahn Berlin'],
    }
    trip_item = next(g for g in data['groups'] if g['type'] == 'TRIP')['items'][0]
    assert trip_item['link'] == {'path': '/reisen', 'query': {'trip': str(trip.pk)}}
    tx = next(g for g in data['groups'] if g['type'] == 'TRANSACTION')['items'][0]
    assert '39,90 €' in tx['subtitle'] and 'Reisen' in tx['subtitle']


def test_never_shows_other_peoples_private_things(world):
    anna, ben, clara = world['anna'], world['ben'], world['clara']
    PersonalTask.objects.create(owner=anna, title='Geheim Geschenk')
    PersonalNote.objects.create(owner=anna, title='Geheim')
    Transaction.objects.create(owner=anna, type='EXPENSE', amount=Decimal('5'), datum=timezone.localdate(), description='Geheim Kauf')
    Trip.objects.create(owner=anna, title='Geheim Trip', start_date=timezone.localdate(), end_date=timezone.localdate())

    assert _search(ben, 'geheim')['groups'] == []
    assert _search(clara, 'geheim')['groups'] == []


def test_shared_trip_found_by_participant_and_contracts_hidden_from_children(world):
    anna, clara, kid, home = world['anna'], world['clara'], world['kid'], world['home']
    trip = Trip.objects.create(owner=anna, title='Wandern Alpen', start_date=timezone.localdate(), end_date=timezone.localdate())
    TripParticipant.objects.create(trip=trip, user=clara, role=TripParticipant.Role.VIEWER)
    FolderEntry.objects.create(household=home, kind='vertrag', name='Strom Alpenwerk')
    HouseholdTask.objects.create(household=home, title='Alpenveilchen gießen')

    assert _titles(_search(clara, 'alpen')) == {'TRIP': ['Wandern Alpen']}
    assert _titles(_search(kid, 'alpen')) == {'HOUSEHOLD_TASK': ['Alpenveilchen gießen']}
    assert _titles(_search(anna, 'alpen'))['CONTRACT'] == ['Strom Alpenwerk']


def test_deleted_transactions_and_too_short_queries_are_ignored(world):
    anna = world['anna']
    tx = Transaction.objects.create(owner=anna, type='EXPENSE', amount=Decimal('5'), datum=timezone.localdate(), description='Kiosk')
    tx.soft_delete()

    assert _search(anna, 'kiosk')['groups'] == []
    assert _search(anna, 'k')['groups'] == []


def test_requires_login():
    assert APIClient().get(URL, {'q': 'abc'}).status_code == 401
