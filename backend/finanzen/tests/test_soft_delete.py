"""DELETE /api/v1/finanzen/transaktionen/{id}/ ruft soft_delete() auf
(TransactionViewSet.perform_destroy(), finanzen/views.py) statt eines
echten DELETE — Transaction.objects blendet gelöschte Einträge aus,
Transaction.all_objects zeigt weiterhin alle (finanzen/models.py)."""

from datetime import date

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from core.models import Household, HouseholdMembership
from finanzen.models import Account, Category, Transaction

pytestmark = pytest.mark.django_db


def test_deleting_a_transaction_soft_deletes_it_not_hard_deletes():
    User = get_user_model()
    user = User.objects.create_user(username='soft-delete@example.com', password='irrelevant-for-test')
    household = Household.objects.create(name='Testhaushalt')
    HouseholdMembership.objects.create(user=user, household=household)
    account = Account.objects.create(household=household, name='Haushaltskasse')
    category = Category.objects.get(household=household, name='Fixkosten')
    transaction = Transaction.objects.create(
        account=account,
        category=category,
        amount='42.00',
        datum=date(2026, 9, 1),
        created_by=user,
    )

    client = APIClient()
    client.force_authenticate(user=user)
    response = client.delete(f'/api/v1/finanzen/transaktionen/{transaction.id}/')

    assert response.status_code == 204
    # objects (SoftDeleteManager): die gelöschte Transaction ist weg.
    assert not Transaction.objects.filter(id=transaction.id).exists()
    assert Transaction.objects.count() == 0
    # all_objects: der Datensatz existiert weiterhin, nur als gelöscht markiert.
    assert Transaction.all_objects.filter(id=transaction.id).exists()
    stored = Transaction.all_objects.get(id=transaction.id)
    assert stored.deleted_at is not None


def test_soft_deleted_transaction_disappears_from_the_list_and_search_endpoint():
    User = get_user_model()
    user = User.objects.create_user(username='soft-delete-list@example.com', password='irrelevant-for-test')
    household = Household.objects.create(name='Testhaushalt')
    HouseholdMembership.objects.create(user=user, household=household)
    account = Account.objects.create(household=household, name='Haushaltskasse')
    category = Category.objects.get(household=household, name='Fixkosten')
    transaction = Transaction.objects.create(
        account=account,
        category=category,
        amount='17.00',
        description='Wird gelöscht',
        datum=date(2026, 9, 1),
        created_by=user,
    )

    client = APIClient()
    client.force_authenticate(user=user)
    client.delete(f'/api/v1/finanzen/transaktionen/{transaction.id}/')

    list_response = client.get('/api/v1/finanzen/transaktionen/')
    assert transaction.id not in [row['id'] for row in list_response.data['results']]

    search_response = client.get('/api/v1/finanzen/transaktionen/', {'q': 'Wird gelöscht'})
    assert search_response.data['results'] == []
