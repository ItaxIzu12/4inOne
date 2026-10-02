"""OnboardingStatusView (finanzen/views.py, gemountet unter
/api/v1/onboarding/status/) — aggregierter Status für den Onboarding-Block
im Dashboard (siehe frontend shared/onboarding)."""

from datetime import date

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from core.models import Household, HouseholdMembership
from finanzen.models import Account, Category, Transaction

pytestmark = pytest.mark.django_db


def test_onboarding_status_all_false_for_a_brand_new_household():
    User = get_user_model()
    user = User.objects.create_user(username='fresh@example.com', password='irrelevant-for-test')
    household = Household.objects.create(name='Testhaushalt')
    HouseholdMembership.objects.create(user=user, household=household)

    client = APIClient()
    client.force_authenticate(user=user)
    response = client.get('/api/v1/onboarding/status/')

    assert response.status_code == 200
    # ADR-001: gezählt werden die PRIVATEN Finanzen. Die automatischen
    # Kategorien des (eingefrorenen) Haushalts zählen nicht.
    assert response.data == {
        'has_transaction': False,
        'has_category': False,
        'member_count': 1,
        'mfa_enabled': False,
    }


def test_onboarding_status_reflects_real_progress():
    User = get_user_model()
    user = User.objects.create_user(username='progressed@example.com', password='irrelevant-for-test')
    other_member = User.objects.create_user(username='partner@example.com', password='irrelevant-for-test')
    household = Household.objects.create(name='Testhaushalt')
    HouseholdMembership.objects.create(user=user, household=household)
    HouseholdMembership.objects.create(user=other_member, household=household)

    category = Category.objects.create(owner=user, name='Lebensmittel')
    Transaction.objects.create(owner=user, category=category, amount='10.00', datum=date(2026, 9, 1))

    client = APIClient()
    client.force_authenticate(user=user)
    response = client.get('/api/v1/onboarding/status/')

    assert response.status_code == 200
    assert response.data['has_transaction'] is True
    assert response.data['has_category'] is True
    assert response.data['member_count'] == 2
    assert response.data['mfa_enabled'] is False


def test_onboarding_status_without_a_household_does_not_crash():
    User = get_user_model()
    user = User.objects.create_user(username='no-household-onboarding@example.com', password='irrelevant-for-test')

    client = APIClient()
    client.force_authenticate(user=user)
    response = client.get('/api/v1/onboarding/status/')

    assert response.status_code == 200
    assert response.data['has_transaction'] is False
    assert response.data['member_count'] == 1


def test_onboarding_status_ignores_frozen_household_finances_and_other_people():
    User = get_user_model()
    user = User.objects.create_user(username='me-onboarding@example.com', password='irrelevant-for-test')
    partner = User.objects.create_user(username='partner-onboarding@example.com', password='irrelevant-for-test')
    household = Household.objects.create(name='Testhaushalt')
    HouseholdMembership.objects.create(user=user, household=household)
    HouseholdMembership.objects.create(user=partner, household=household)
    account = Account.objects.create(household=household, name='Haushaltskasse')
    Transaction.objects.create(account=account, amount='10.00', datum=date(2026, 9, 1))
    Category.objects.create(owner=partner, name='Privat von Partner')

    client = APIClient()
    client.force_authenticate(user=user)
    response = client.get('/api/v1/onboarding/status/')

    assert response.data['has_transaction'] is False
    assert response.data['has_category'] is False
