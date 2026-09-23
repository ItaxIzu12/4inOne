"""Fairness-Feld im /uebersicht/-Response existiert NUR ab 2 Mitgliedern
(nicht null/0 bei einer Person, siehe finanzen/views.py OverviewView), und
jeder neue Haushalt bekommt automatisch drei Standard-Kategorien
(finanzen/signals.py)."""

from datetime import datetime, timezone as dt_timezone

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from core.models import Household, HouseholdMembership
from finanzen.models import Account, Category, Transaction

pytestmark = pytest.mark.django_db


def test_household_gets_three_default_categories_with_exact_colors_on_creation():
    household = Household.objects.create(name='Neuer Haushalt')

    categories = {c.name: c for c in Category.objects.filter(household=household)}
    assert set(categories) == {'Fixkosten', 'Haushalt', 'Sonstiges'}
    assert categories['Fixkosten'].color == '#164c49'
    assert categories['Fixkosten'].icon_key == 'fixkosten'
    assert categories['Haushalt'].color == '#8a5a23'
    assert categories['Haushalt'].icon_key == 'haushalt'
    assert categories['Sonstiges'].color == '#a8452f'
    assert categories['Sonstiges'].icon_key == 'sonstiges'


def test_fairness_field_is_entirely_absent_with_exactly_one_member():
    User = get_user_model()
    user = User.objects.create_user(username='solo@example.com', password='irrelevant-for-test')
    household = Household.objects.create(name='Solo-Haushalt')
    HouseholdMembership.objects.create(user=user, household=household)

    client = APIClient()
    client.force_authenticate(user=user)
    response = client.get('/api/v1/finanzen/uebersicht/')

    assert response.status_code == 200
    assert response.data['member_count'] == 1
    assert 'fairness' not in response.data


def test_fairness_field_appears_and_sums_to_100_percent_with_two_members():
    User = get_user_model()
    user_a = User.objects.create_user(username='fair-a@example.com', password='irrelevant-for-test', first_name='Anna')
    user_b = User.objects.create_user(username='fair-b@example.com', password='irrelevant-for-test', first_name='Jonas')
    household = Household.objects.create(name='Zu-zweit-Haushalt')
    HouseholdMembership.objects.create(user=user_a, household=household)
    HouseholdMembership.objects.create(user=user_b, household=household)
    account = Account.objects.create(household=household, name='Haushaltskasse')
    category = Category.objects.get(household=household, name='Fixkosten')

    now = datetime(2026, 9, 5, tzinfo=dt_timezone.utc)
    Transaction.objects.create(account=account, category=category, amount='75.00', datum=now, created_by=user_a)
    Transaction.objects.create(account=account, category=category, amount='25.00', datum=now, created_by=user_b)

    client = APIClient()
    client.force_authenticate(user=user_a)
    response = client.get('/api/v1/finanzen/uebersicht/')

    assert response.status_code == 200
    assert response.data['member_count'] == 2
    fairness_by_name = {row['name']: row['percentage'] for row in response.data['fairness']}
    assert fairness_by_name == {'Anna': 75.0, 'Jonas': 25.0}
