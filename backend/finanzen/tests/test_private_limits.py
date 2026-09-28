"""Konto löschen und Plausibilitätsgrenzen im privaten Finanzbereich.

1. Ein Konto mit Daten muss sich löschen lassen (DSGVO Art. 17). Vorher
   blockierte Transaction.created_by (PROTECT) das Löschen, sobald jemand eine
   Buchung erfasst hatte.
2. Offensichtliche Tippfehler werden abgelehnt: Buchungen im Jahr 1900 oder
   2099, Beträge ab einer Million."""

from datetime import date, timedelta
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import Household, HouseholdMembership
from finanzen.models import Account, Category, MonthlyBudget, SavingsContribution, SavingsGoal, Transaction
from finanzen.private_api import BOOKING_YEARS_BACK, booking_date_bounds

pytestmark = pytest.mark.django_db
BASE = '/api/v1/finanzen/private/'


@pytest.fixture
def user_client():
    user = get_user_model().objects.create_user(username='grenzen@example.com')
    client = APIClient()
    client.force_authenticate(user)
    return user, client


# ---------------------------------------------------------------- Konto löschen

def test_an_account_with_data_in_every_area_can_be_deleted():
    from haushalt.models import ShoppingItem, ShoppingList, Task
    from organisation.models import CalendarEvent, PersonalEvent, PersonalTask

    User = get_user_model()
    leaving = User.objects.create_user(username='geht@example.com')
    staying = User.objects.create_user(username='bleibt@example.com')
    home = Household.objects.create(name='WG')
    for person in (leaving, staying):
        HouseholdMembership.objects.create(user=person, household=home)
    now = timezone.now()

    # Privat
    cat = Category.objects.create(owner=leaving, name='Privat')
    Transaction.objects.create(owner=leaving, category=cat, amount=Decimal('5'), created_by=leaving, updated_by=leaving)
    MonthlyBudget.objects.create(owner=leaving, month=date(2026, 9, 1), amount=Decimal('100'))
    goal = SavingsGoal.objects.create(owner=leaving, title='Ziel', target_amount=Decimal('100'), current_amount=Decimal('10'))
    SavingsContribution.objects.create(owner=leaving, goal=goal, amount=Decimal('10'), date=date(2026, 9, 1))
    PersonalEvent.objects.create(owner=leaving, title='Arzt', starts_at=now)
    PersonalTask.objects.create(owner=leaving, title='Anrufen')
    # Gemeinsam im Haushalt
    shared = Transaction.objects.create(account=Account.objects.create(household=home, name='Kasse'),
                                        amount=Decimal('20'), created_by=leaving, updated_by=leaving)
    task = Task.objects.create(household=home, title='Müll', assigned_to=leaving, created_by=leaving, last_done_by=leaving)
    item = ShoppingItem.objects.create(shopping_list=ShoppingList.objects.create(household=home), name='Milch',
                                       added_by=leaving, checked_by=leaving)
    event = CalendarEvent.objects.create(household=home, title='Putzen', starts_at=now, created_by=leaving)

    leaving_id = leaving.pk  # nach delete() ist pk None
    leaving.delete()

    # Private Daten sind weg (auch weich gelöschte Buchungen) …
    assert not Transaction.all_objects.filter(owner_id=leaving_id).exists()
    assert not SavingsGoal.objects.filter(owner_id=leaving_id).exists()
    assert not SavingsContribution.objects.filter(owner_id=leaving_id).exists()
    assert not PersonalEvent.objects.filter(owner_id=leaving_id).exists()
    # … gemeinsame bleiben für die anderen, nur ohne Autor.
    shared.refresh_from_db(); task.refresh_from_db(); item.refresh_from_db(); event.refresh_from_db()
    assert shared.created_by is None and shared.updated_by is None
    assert task.assigned_to is None and task.created_by is None
    assert item.added_by is None
    assert event.created_by is None
    assert HouseholdMembership.objects.filter(household=home, user=staying).exists()


# ---------------------------------------------------------------- Datum

def _book(client, day, amount='5.00'):
    cat = Category.objects.get_or_create(owner=client.handler._force_user, name='X')[0]
    return client.post(BASE + 'transactions/', {'amount': amount, 'type': 'EXPENSE', 'category': cat.id, 'date': day}, format='json')


@pytest.mark.parametrize('day', ['1900-01-01', '2099-12-31'])
def test_booking_dates_far_in_the_past_or_future_are_rejected(user_client, day):
    _, client = user_client
    response = _book(client, day)
    assert response.status_code == 400
    assert 'date' in response.data


def test_booking_date_bounds_are_inclusive(user_client):
    _, client = user_client
    earliest, latest = booking_date_bounds()
    assert _book(client, earliest.isoformat()).status_code == 201
    assert _book(client, latest.isoformat()).status_code == 201
    assert _book(client, (earliest - timedelta(days=1)).isoformat()).status_code == 400
    assert _book(client, (latest + timedelta(days=1)).isoformat()).status_code == 400
    # Geplante Ausgabe im nächsten Monat bleibt möglich.
    assert _book(client, (timezone.localdate() + timedelta(days=32)).isoformat()).status_code == 201


def test_booking_bounds_survive_the_29th_of_february():
    earliest, latest = booking_date_bounds(date(2028, 2, 29))
    assert earliest == date(2028 - BOOKING_YEARS_BACK, 2, 28)
    assert latest == date(2029, 2, 28)


# ---------------------------------------------------------------- Beträge

def test_amounts_from_one_million_are_rejected_everywhere(user_client):
    _, client = user_client
    today = timezone.localdate()
    MonthlyBudget.objects.create(owner=user_client[0], month=today.replace(day=1), open_ended=True, amount=Decimal('5000'))

    booking = _book(client, today.isoformat(), '1000000.00')
    assert booking.status_code == 400
    assert booking.data['amount'] == ['Der Betrag darf höchstens 999.999,99 € betragen.']
    assert _book(client, today.isoformat(), '999999.99').status_code == 201

    budget = client.post(BASE + 'budgets/', {'amount': '1000000.00', 'month': '2030-01-01'}, format='json')
    assert budget.status_code == 400 and 'amount' in budget.data

    for field in ('target_amount', 'current_amount', 'monthly_amount'):
        payload = {'title': 'Zu viel', 'target_amount': '500.00', field: '1000000.00'}
        response = client.post(BASE + 'goals/', payload, format='json')
        assert response.status_code == 400 and field in response.data, field
