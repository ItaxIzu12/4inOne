"""Beweist ARCHITEKTUR.md §3.2: ein Nutzer aus Haushalt A darf keine
Transaction aus Haushalt B abrufen, auch nicht über eine erratene ID
(IDOR/Broken Object Level Authorization)."""

from datetime import datetime, timezone

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from core.models import Household, HouseholdMembership
from core.permissions import HouseholdScopedPermission
from finanzen.models import Account, Transaction


@pytest.fixture
def two_households_with_transactions(db):
    User = get_user_model()
    user_a = User.objects.create_user(username='a@example.com', password='irrelevant-for-test-1')
    user_b = User.objects.create_user(username='b@example.com', password='irrelevant-for-test-2')

    household_a = Household.objects.create(name='Haushalt A')
    household_b = Household.objects.create(name='Haushalt B')
    HouseholdMembership.objects.create(user=user_a, household=household_a)
    HouseholdMembership.objects.create(user=user_b, household=household_b)

    account_b = Account.objects.create(household=household_b, name='Konto B')
    transaction_b = Transaction.objects.create(
        account=account_b,
        amount='42.00',
        occurred_at=datetime(2026, 8, 1, tzinfo=timezone.utc),
    )

    return {'user_a': user_a, 'user_b': user_b, 'transaction_b': transaction_b}


def test_user_from_other_household_cannot_access_transaction(two_households_with_transactions):
    client = APIClient()
    client.force_authenticate(user=two_households_with_transactions['user_a'])

    response = client.get(f"/api/finanzen/transaktionen/{two_households_with_transactions['transaction_b'].id}/")

    assert response.status_code in (403, 404)


def test_owning_household_member_can_access_transaction(two_households_with_transactions):
    client = APIClient()
    client.force_authenticate(user=two_households_with_transactions['user_b'])

    response = client.get(f"/api/finanzen/transaktionen/{two_households_with_transactions['transaction_b'].id}/")

    assert response.status_code == 200


@pytest.mark.django_db
def test_household_scoped_permission_denies_foreign_household_object():
    """Direkter Unit-Test der Permission-Klasse selbst, unabhängig von der
    zusätzlichen Queryset-Filterung im ViewSet."""

    User = get_user_model()
    outsider = User.objects.create_user(username='outsider@example.com', password='irrelevant-for-test-3')
    household = Household.objects.create(name='Haushalt B')
    account = Account.objects.create(household=household, name='Konto B')
    transaction = Transaction.objects.create(
        account=account, amount='10.00', occurred_at=datetime(2026, 8, 1, tzinfo=timezone.utc)
    )

    class DummyRequest:
        user = outsider

    class DummyView:
        household_field = 'account__household'

    permission = HouseholdScopedPermission()

    assert permission.has_object_permission(DummyRequest(), DummyView(), transaction) is False
