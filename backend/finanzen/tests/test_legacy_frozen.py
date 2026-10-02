"""ADR-001: Die alten Haushaltsfinanzen sind eingefroren — lesbar, aber
nicht mehr beschreibbar. Nichts wird gelöscht."""

from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from core.models import Household, HouseholdMembership
from finanzen.models import Account, Category, RecurringDeduction, Transaction

pytestmark = [pytest.mark.django_db, pytest.mark.legacy_frozen]

BASE = '/api/v1/finanzen/'


@pytest.fixture
def setup():
    user = get_user_model().objects.create_user(username='frozen@example.com', password='irrelevant-for-test')
    household = Household.objects.create(name='Alter Haushalt')
    HouseholdMembership.objects.create(user=user, household=household)
    account = Account.objects.create(household=household, name='Haushaltskasse')
    category = Category.objects.filter(household=household).first()
    transaction = Transaction.objects.create(account=account, category=category, amount='12.00', datum=date(2026, 9, 1))
    deduction = RecurringDeduction.objects.create(household=household, name='Miete', amount=Decimal('900.00'))
    client = APIClient()
    client.force_authenticate(user=user)
    return {'client': client, 'category': category, 'transaction': transaction, 'deduction': deduction}


def test_legacy_household_finances_stay_readable(setup):
    client = setup['client']
    assert client.get(f'{BASE}uebersicht/').status_code == 200
    assert client.get(f'{BASE}analysen/').status_code == 200
    assert client.get(f'{BASE}transaktionen/').status_code == 200
    assert client.get(f'{BASE}kategorien/').status_code == 200
    assert client.get(f'{BASE}abzuege/').status_code == 200


@pytest.mark.parametrize(
    'method, path, body',
    [
        ('post', 'transaktionen/', {'amount': '5.00', 'datum': '2026-09-02'}),
        ('patch', 'transaktionen/{transaction}/', {'amount': '1.00'}),
        ('delete', 'transaktionen/{transaction}/', None),
        ('post', 'kategorien/', {'name': 'Neu'}),
        ('patch', 'kategorien/{category}/', {'name': 'Umbenannt'}),
        ('delete', 'kategorien/{category}/', None),
        ('post', 'abzuege/', {'name': 'Strom', 'amount': '80.00'}),
        ('patch', 'abzuege/{deduction}/', {'active': False}),
        ('delete', 'abzuege/{deduction}/', None),
        ('patch', 'analysen/einkommen/', {'monthly_income': '3000.00'}),
        ('patch', 'analysen/puffer/', {'monthly_buffer': '100.00'}),
    ],
)
def test_legacy_household_finances_reject_every_write(setup, method, path, body):
    url = BASE + path.format(
        transaction=setup['transaction'].pk, category=setup['category'].pk, deduction=setup['deduction'].pk
    )
    response = getattr(setup['client'], method)(url, body, format='json')

    assert response.status_code == 403
    assert 'eingefroren' in str(response.data['detail'])
    # Nichts wurde verändert oder gelöscht.
    assert Transaction.objects.filter(pk=setup['transaction'].pk, amount='12.00').exists()
    assert Category.objects.filter(pk=setup['category'].pk, name=setup['category'].name).exists()
    assert RecurringDeduction.objects.filter(pk=setup['deduction'].pk, active=True).exists()
