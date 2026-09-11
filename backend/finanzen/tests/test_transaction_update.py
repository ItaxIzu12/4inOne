"""PATCH /api/v1/finanzen/transaktionen/{id}/ — Bearbeiten (finanzen/views.py
TransactionViewSet). Kein perform_update()-Override nötig: get_queryset()
nutzt bereits Transaction.objects (SoftDeleteManager), eine bereits weich
gelöschte Transaction ist darin schlicht nicht mehr auffindbar — PATCH/DELETE
darauf laufen automatisch auf 404, nicht stillschweigend durch."""

from datetime import datetime, timezone as dt_timezone

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from core.models import Household, HouseholdMembership
from finanzen.models import Account, Category, Transaction

pytestmark = pytest.mark.django_db


def _client_with_transaction():
    User = get_user_model()
    user = User.objects.create_user(username='editor@example.com', password='irrelevant-for-test')
    household = Household.objects.create(name='Testhaushalt')
    HouseholdMembership.objects.create(user=user, household=household)
    account = Account.objects.create(household=household, name='Haushaltskasse')
    category = Category.objects.get(household=household, name='Fixkosten')
    transaction = Transaction.objects.create(
        account=account,
        category=category,
        amount='50.00',
        description='Ursprünglich',
        occurred_at=datetime(2026, 9, 1, tzinfo=dt_timezone.utc),
        created_by=user,
    )
    client = APIClient()
    client.force_authenticate(user=user)
    return client, transaction, category


def test_patching_an_existing_transaction_updates_amount_and_description():
    client, transaction, _ = _client_with_transaction()

    response = client.patch(
        f'/api/v1/finanzen/transaktionen/{transaction.id}/', {'amount': '75.00', 'description': 'Geändert'}, format='json'
    )

    assert response.status_code == 200
    assert response.data['amount'] == '75.00'
    assert response.data['description'] == 'Geändert'
    transaction.refresh_from_db()
    assert str(transaction.amount) == '75.00'


def test_patching_an_already_deleted_transaction_returns_404_not_silent_success():
    client, transaction, _ = _client_with_transaction()
    client.delete(f'/api/v1/finanzen/transaktionen/{transaction.id}/')

    response = client.patch(f'/api/v1/finanzen/transaktionen/{transaction.id}/', {'amount': '999.00'}, format='json')

    assert response.status_code == 404
    transaction.refresh_from_db()
    assert str(transaction.amount) == '50.00'  # unverändert


def test_patching_a_transaction_with_a_different_households_category_is_rejected():
    client, transaction, _ = _client_with_transaction()
    User = get_user_model()
    other_user = User.objects.create_user(username='other-household@example.com', password='irrelevant-for-test')
    other_household = Household.objects.create(name='Anderer Haushalt')
    HouseholdMembership.objects.create(user=other_user, household=other_household)
    other_category = Category.objects.get(household=other_household, name='Fixkosten')

    response = client.patch(
        f'/api/v1/finanzen/transaktionen/{transaction.id}/', {'category_id': other_category.id}, format='json'
    )

    assert response.status_code == 400
