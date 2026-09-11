"""OnboardingStatusView (finanzen/views.py, gemountet unter
/api/v1/onboarding/status/) — aggregierter Status für den Onboarding-Block
im Dashboard (siehe frontend shared/onboarding)."""

from datetime import datetime, timezone as dt_timezone

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from core.models import Household, HouseholdMembership
from finanzen.models import Account, Transaction

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
    # has_category ist jetzt True: jeder neue Haushalt bekommt automatisch
    # drei Standard-Kategorien (finanzen/signals.py) — der "Kategorie
    # anlegen"-Onboarding-Schritt greift dadurch nur noch, wenn alle drei
    # manuell wieder entfernt wurden, nicht mehr direkt nach Registrierung.
    assert response.data == {
        'has_transaction': False,
        'has_category': True,
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

    account = Account.objects.create(household=household, name='Haushaltskasse')
    # Kategorie existiert bereits automatisch (finanzen/signals.py) — hier
    # nicht erneut anlegen, sonst UniqueConstraint-Verletzung.
    Transaction.objects.create(
        account=account, amount='10.00', occurred_at=datetime(2026, 9, 1, tzinfo=dt_timezone.utc)
    )

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
