"""Ü1: Rückgängig nach dem Löschen – dieselbe Buchung kommt zurück, nur die eigene und nur kurz danach."""

from datetime import timedelta
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from finanzen.models import Category, Transaction

pytestmark = pytest.mark.django_db
URL = '/api/v1/finanzen/private/transactions/'


def _client(user):
    c = APIClient()
    c.force_authenticate(user)
    return c


def _user(name):
    return get_user_model().objects.create_user(username=f'{name}@example.com', email=f'{name}@example.com', password='x')


def test_deleted_transaction_comes_back_with_the_same_id():
    anna = _user('anna')
    cat = Category.objects.create(owner=anna, name='Lebensmittel', color='#000000')
    tx = Transaction.objects.create(owner=anna, type='EXPENSE', amount=Decimal('12.50'), datum=timezone.localdate(), description='REWE', category=cat)
    assert _client(anna).delete(f'{URL}{tx.pk}/').status_code == 204
    assert not Transaction.objects.filter(pk=tx.pk).exists()

    r = _client(anna).post(f'{URL}{tx.pk}/wiederherstellen/')
    assert r.status_code == 200 and r.data['id'] == tx.pk and r.data['note'] == 'REWE'
    assert Transaction.objects.filter(pk=tx.pk).exists()
    assert Transaction.all_objects.filter(owner=anna).count() == 1


def test_only_own_and_only_shortly_after_deleting():
    anna, ben = _user('anna'), _user('ben')
    tx = Transaction.objects.create(owner=anna, type='EXPENSE', amount=Decimal('5'), datum=timezone.localdate(), description='Kiosk')
    tx.soft_delete()
    assert _client(ben).post(f'{URL}{tx.pk}/wiederherstellen/').status_code == 404
    Transaction.all_objects.filter(pk=tx.pk).update(deleted_at=timezone.now() - timedelta(minutes=11))
    assert _client(anna).post(f'{URL}{tx.pk}/wiederherstellen/').status_code == 404
    live = Transaction.objects.create(owner=anna, type='EXPENSE', amount=Decimal('5'), datum=timezone.localdate(), description='Bäcker')
    assert _client(anna).post(f'{URL}{live.pk}/wiederherstellen/').status_code == 404
