"""Startleitfaden je Bereich (core/onboarding_views.py › OnboardingGuideView, seit 21.11.2026)."""

import datetime

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import Household, HouseholdMembership, OnboardingProfile
from finanzen.models import MonthlyBudget, SavingsGoal, Transaction
from haushalt.models import FolderEntry, ShoppingItem, ShoppingList, Task
from organisation.models import PersonalEvent, PersonalNote, PersonalTask
from reisen.models import PackingItem, Trip

pytestmark = pytest.mark.django_db
URL = '/api/v1/onboarding/guide/'


def _user(name):
    user = get_user_model().objects.create_user(username=name, email=f'{name}@example.com', password='irrelevant')
    home = Household.objects.create(name=f'Zuhause {name}')
    HouseholdMembership.objects.create(user=user, household=home)
    client = APIClient()
    client.force_authenticate(user)
    return user, home, client


def _all_false(areas):
    return all(v in (False, None) for steps in areas.values() for v in steps.values())


def test_authentication_required():
    client = APIClient()
    assert client.get(URL).status_code == 401
    assert client.put(URL, {'area': 'start', 'hidden': True}, format='json').status_code == 401


def test_new_account_has_no_step_done_and_nothing_hidden():
    _, _, client = _user('sophie')
    data = client.get(URL).json()
    assert set(data['areas']) == {'finanzen', 'haushalt', 'organisation', 'reisen'}
    assert _all_false(data['areas'])
    assert data['dismissed'] == []


def test_steps_tick_off_from_real_data():
    user, home, client = _user('sophie')
    today = timezone.localdate()
    MonthlyBudget.objects.create(owner=user, month=today.replace(day=1), amount='800')
    Transaction.objects.create(owner=user, amount='12.40', datum=today)
    SavingsGoal.objects.create(owner=user, title='Urlaub', target_amount='500')
    Task.objects.create(household=home, title='Bad putzen', created_by=user)
    ShoppingItem.objects.create(shopping_list=ShoppingList.objects.create(household=home), added_by=user, name='Milch')
    FolderEntry.objects.create(household=home, kind=FolderEntry._meta.get_field('kind').choices[0][0], name='Waschmaschine')
    PersonalEvent.objects.create(owner=user, title='Elternabend', starts_at=timezone.now())
    PersonalTask.objects.create(owner=user, title='Steuer')
    PersonalNote.objects.create(owner=user, body='Ideen')
    trip = Trip.objects.create(owner=user, title='Lissabon', start_date=today, end_date=today + datetime.timedelta(days=3), budget_amount='900')
    PackingItem.objects.create(trip=trip, title='Pass')

    areas = client.get(URL).json()['areas']
    assert areas['finanzen'] == {'budget': True, 'transaction': True, 'goal': True}
    assert areas['haushalt'] == {'task': True, 'shopping': True, 'folder': True}
    assert areas['organisation'] == {'event': True, 'task': True, 'note': True}
    assert areas['reisen'] == {'trip': True, 'packing': True, 'budget': True, 'trip_id': trip.id}


def test_data_of_other_people_never_counts_and_no_foreign_trip_id_leaks():
    other, other_home, _ = _user('max')
    today = timezone.localdate()
    Task.objects.create(household=other_home, title='Fremde Aufgabe', created_by=other)
    PersonalTask.objects.create(owner=other, title='Fremd')
    MonthlyBudget.objects.create(owner=other, month=today.replace(day=1), amount='800')
    Trip.objects.create(owner=other, title='Fremde Reise', start_date=today, end_date=today)

    _, _, client = _user('sophie')
    areas = client.get(URL).json()['areas']
    assert _all_false(areas)
    assert areas['reisen']['trip_id'] is None


def test_hiding_is_stored_in_the_account_and_can_be_undone():
    user, _, client = _user('sophie')
    assert client.put(URL, {'area': 'organisation', 'hidden': True}, format='json').json()['dismissed'] == ['organisation']
    client.put(URL, {'area': 'start', 'hidden': True}, format='json')
    assert sorted(OnboardingProfile.objects.get(user=user).dismissed_guides) == ['organisation', 'start']

    second_device = APIClient()
    second_device.force_authenticate(user)
    assert sorted(second_device.get(URL).json()['dismissed']) == ['organisation', 'start']

    assert client.put(URL, {'area': 'organisation', 'hidden': False}, format='json').json()['dismissed'] == ['start']


def test_hiding_twice_does_not_duplicate_and_unknown_areas_are_rejected():
    _, _, client = _user('sophie')
    client.put(URL, {'area': 'reisen', 'hidden': True}, format='json')
    assert client.put(URL, {'area': 'reisen', 'hidden': True}, format='json').json()['dismissed'] == ['reisen']
    assert client.put(URL, {'area': 'admin', 'hidden': True}, format='json').status_code == 400
    assert client.put(URL, {'area': 'reisen'}, format='json').status_code == 400


def test_hiding_does_not_complete_onboarding_or_change_preferences():
    user, _, client = _user('sophie')
    client.put(URL, {'area': 'start', 'hidden': True}, format='json')
    profile = OnboardingProfile.objects.get(user=user)
    assert profile.completed_at is None
    assert profile.domains == []
