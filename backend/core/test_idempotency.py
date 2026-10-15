"""Idempotente Anlage (core/idempotency.py): dieselbe Anfrage zweimal = genau ein Objekt."""

from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import IdempotencyRecord
from finanzen.models import Category, SavingsGoal, Transaction
from reisen.models import Trip, TripExpense

pytestmark = pytest.mark.django_db
URL = '/api/v1/finanzen/private/transactions/'


def person(name):
    return get_user_model().objects.create_user(username=f'{name}@example.com', email=f'{name}@example.com', password='x')


def api(user, key=None):
    client = APIClient()
    client.force_authenticate(user)
    if key:
        client.credentials(HTTP_IDEMPOTENCY_KEY=key)
    return client


@pytest.fixture
def anna():
    return person('anna')


def payload(user, amount='12.30'):
    category = Category.objects.get_or_create(owner=user, name='Lebensmittel')[0]
    return {'amount': amount, 'type': 'EXPENSE', 'date': '2026-10-13', 'category': category.pk, 'description': 'Markt'}


def test_retry_with_the_same_key_creates_one_transaction_and_replays_the_answer(anna):
    client = api(anna, 'form-1234-abcd')
    first = client.post(URL, payload(anna), format='json')
    second = client.post(URL, payload(anna), format='json')
    assert first.status_code == second.status_code == 201
    assert first.data == second.data and second['Idempotent-Replay'] == 'true'
    assert Transaction.objects.filter(owner=anna).count() == 1


def test_without_key_nothing_changes_and_a_new_key_is_a_new_transaction(anna):
    api(anna).post(URL, payload(anna), format='json')
    api(anna).post(URL, payload(anna), format='json')
    api(anna, 'form-0000-0001').post(URL, payload(anna), format='json')
    api(anna, 'form-0000-0002').post(URL, payload(anna), format='json')
    assert Transaction.objects.filter(owner=anna).count() == 4


def test_same_key_with_different_content_is_rejected(anna):
    client = api(anna, 'form-same-key')
    assert client.post(URL, payload(anna, '1.00'), format='json').status_code == 201
    response = client.post(URL, payload(anna, '2.00'), format='json')
    assert response.status_code == 422
    assert Transaction.objects.filter(owner=anna).count() == 1


def test_failed_request_can_be_retried_with_the_same_key(anna):
    client = api(anna, 'form-after-error')
    assert client.post(URL, {**payload(anna), 'amount': '-5'}, format='json').status_code == 400
    assert client.post(URL, {**payload(anna), 'amount': '-5'}, format='json').status_code == 400  # kein „Replay“ eines Fehlers
    assert not IdempotencyRecord.objects.exists()


def test_keys_are_per_person_and_cannot_read_foreign_answers(anna):
    eve = person('eve')
    api(anna, 'shared-key-1234').post(URL, payload(anna), format='json')
    response = api(eve, 'shared-key-1234').post(URL, payload(eve), format='json')
    assert response.status_code == 201 and 'Idempotent-Replay' not in response
    assert Transaction.objects.filter(owner=eve).count() == 1


def test_in_flight_duplicate_gets_409_and_old_keys_expire(anna):
    IdempotencyRecord.objects.create(user=anna, scope='finanzen.transaction.create', key='busy-key-1234', fingerprint='x')
    assert api(anna, 'busy-key-1234').post(URL, payload(anna), format='json').status_code in (409, 422)
    IdempotencyRecord.objects.update(created_at=timezone.now() - timedelta(days=2))
    assert api(anna, 'busy-key-1234').post(URL, payload(anna), format='json').status_code == 201


def test_invalid_keys_are_rejected(anna):
    assert api(anna, 'kurz').post(URL, payload(anna), format='json').status_code == 400
    assert api(anna, 'mit leerzeichen 1234').post(URL, payload(anna), format='json').status_code == 400


def test_savings_goals_and_trip_expenses_are_idempotent_too(anna):
    client = api(anna, 'goal-form-1234')
    for _ in range(2):
        client.post('/api/v1/finanzen/private/goals/', {'title': 'Rad', 'target_amount': '300'}, format='json')
    assert SavingsGoal.objects.filter(owner=anna).count() == 1
    trip = Trip.objects.create(owner=anna, title='Rom', destination='Rom', start_date=timezone.localdate(),
                               end_date=timezone.localdate() + timedelta(days=2))
    client = api(anna, 'expense-form-1234')
    for _ in range(2):
        client.post('/api/v1/reisen/expenses/', {'trip': trip.pk, 'title': 'Hotel', 'amount': '280.00',
                                                 'date': timezone.localdate().isoformat()}, format='json')
    assert TripExpense.objects.filter(trip=trip).count() == 1


def test_import_with_the_same_key_imports_once(anna):
    rows = [{'date': '2026-10-01', 'amount': '9.99', 'type': 'EXPENSE', 'note': 'Kino', 'category': ''}]
    client = api(anna, 'import-run-1234')
    first = client.post(URL + 'import/', {'rows': rows, 'dry_run': False}, format='json')
    second = client.post(URL + 'import/', {'rows': rows, 'dry_run': False}, format='json')
    assert first.data['created'] == 1 and second.data == first.data
    assert Transaction.objects.filter(owner=anna).count() == 1
