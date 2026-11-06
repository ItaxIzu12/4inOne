"""Bestehende bereichsübergreifende Regeln aus dem Entwicklungsplan, ausdrücklich abgesichert (Connection Engine V2,
Phase 2): CON-05 Einkauf → Finanzen und CON-06 Reisen ↔ Finanzen. CON-08/09 (Reisevorschläge) prüft
connections/tests/test_suggestions.py."""

from datetime import timedelta
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import Household, HouseholdMembership
from finanzen.models import Transaction
from reisen.models import Trip, TripExpense

pytestmark = pytest.mark.django_db

ITEMS = '/api/v1/haushalt/einkauf/eintraege/'
COMPLETE = '/api/v1/haushalt/einkauf/eintraege/abschliessen/'
SUMMARY = '/api/v1/finanzen/private/summary/'


@pytest.fixture
def anna():
    user = get_user_model().objects.create_user(username='anna@example.com', email='anna@example.com', password='irrelevant-1A', first_name='Anna')
    HouseholdMembership.objects.create(user=user, household=Household.objects.create(name='Zuhause'), role=HouseholdMembership.Role.ADMIN)
    return user


@pytest.fixture
def client(anna):
    c = APIClient()
    c.force_authenticate(anna)
    return c


def test_con05_ticking_items_is_never_a_booking(client):
    for name in ('Milch', 'Brot'):
        item = client.post(ITEMS, {'name': name}, format='json').data
        assert client.patch(f"{ITEMS}{item['id']}/", {'is_checked': True}, format='json').status_code == 200
    assert not Transaction.all_objects.exists()
    # Abschließen OHNE Betrag ist ebenfalls keine Buchung
    assert client.post(COMPLETE, {}, format='json').status_code in (200, 201)
    assert not Transaction.all_objects.exists()


def test_con05_completing_books_exactly_once_even_when_repeated(client):
    item = client.post(ITEMS, {'name': 'Käse'}, format='json').data
    client.patch(f"{ITEMS}{item['id']}/", {'is_checked': True}, format='json')
    first = client.post(COMPLETE, {'amount': '7.80'}, format='json')
    assert first.status_code == 201
    again = client.post(COMPLETE, {'amount': '7.80'}, format='json')  # z. B. erneut gesendet nach Netzwerkfehler
    assert again.status_code != 201
    assert Transaction.objects.count() == 1 and Transaction.objects.get().amount == Decimal('7.80')


def test_con06_trip_budget_and_expenses_never_appear_in_finance(client, anna):
    today = timezone.localdate()
    trip = Trip.objects.create(owner=anna, title='Rom', destination='Rom', start_date=today, end_date=today + timedelta(days=4),
                               budget_amount=Decimal('1200.00'))
    r = client.post('/api/v1/reisen/expenses/', {'trip': trip.pk, 'title': 'Flug', 'amount': '320.00', 'date': today.isoformat(),
                                                 'category': 'TRANSPORT'}, format='json')
    assert r.status_code == 201, r.data
    assert TripExpense.objects.count() == 1
    assert not Transaction.all_objects.exists()  # keine Doppelzählung: Reisekosten bleiben bei der Reise
    summary = client.get(SUMMARY, {'month': today.strftime('%Y-%m')}).data
    assert summary['spent'] == '0.00' and summary['planned'] == '0.00' and summary['planned_items'] == []
