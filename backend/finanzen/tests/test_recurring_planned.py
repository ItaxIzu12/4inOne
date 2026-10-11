"""„Kommt jeden Monat wieder“: wiederkehrende Ausgaben werden in jedem Folgemonat vom Restbudget abgezogen
(vorgemerkt), ohne dass eine Buchung angelegt wird — und nie doppelt, wenn man sie im Monat selbst bucht."""
from datetime import date, timedelta
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from finanzen.models import Category, MonthlyBudget, Transaction

pytestmark = pytest.mark.django_db
BASE = '/api/v1/finanzen/private/'


def _month(offset: int) -> date:
    first = timezone.localdate().replace(day=1)
    year, month = divmod(first.month - 1 + offset, 12)
    return date(first.year + year, month + 1, 1)


@pytest.fixture
def anna():
    user = get_user_model().objects.create_user(username='wiederkehrend')
    MonthlyBudget.objects.create(owner=user, month=_month(-24), open_ended=True, amount=Decimal('2000'))
    client = APIClient()
    client.force_authenticate(user)
    user.client = client
    user.wohnen = Category.objects.create(owner=user, name='Wohnen')
    return user


def tx(user, amount, day, note='Miete', recurring=True, category=None, type_='EXPENSE'):
    return Transaction.objects.create(owner=user, amount=Decimal(amount), datum=day, description=note,
                                      recurring=recurring, category=category or user.wohnen, type=type_)


def summary(user, month: date) -> dict:
    r = user.client.get(BASE + f'summary/?month={month:%Y-%m}')
    assert r.status_code == 200, r.data
    return r.data


def test_recurring_expense_is_planned_in_current_and_future_months(anna):
    tx(anna, '900.00', _month(-1) + timedelta(days=2))
    for offset in (0, 1, 3):
        data = summary(anna, _month(offset))
        assert data['planned'] == '900.00'
        assert [i['title'] for i in data['planned_items']] == ['Miete']
        assert data['available'] == '1100.00'  # 2000 − 900 vorgemerkt
    assert Transaction.objects.count() == 1  # nichts automatisch gebucht


def test_booking_it_this_month_replaces_the_reservation(anna):
    tx(anna, '900.00', _month(-1) + timedelta(days=2))
    tx(anna, '900.00', _month(0), recurring=True)  # diesen Monat gebucht
    data = summary(anna, _month(0))
    assert data['planned'] == '0.00' and data['planned_items'] == []
    assert data['available'] == '1100.00'  # nur einmal abgezogen
    assert summary(anna, _month(1))['planned'] == '900.00'  # nächster Monat wieder vorgemerkt


def test_latest_amount_counts(anna):
    tx(anna, '900.00', _month(-3))
    tx(anna, '950.00', _month(-1))  # Mieterhöhung
    assert summary(anna, _month(0))['planned'] == '950.00'


def test_unmarking_the_latest_ends_the_reservation(anna):
    tx(anna, '900.00', _month(-2))
    tx(anna, '900.00', _month(-1), recurring=False)  # zuletzt nicht mehr als wiederkehrend markiert
    assert summary(anna, _month(0))['planned'] == '0.00'


def test_past_months_stay_as_they_were(anna):
    tx(anna, '900.00', _month(-3))
    past = summary(anna, _month(-1))
    assert past['planned'] == '0.00' and past['available'] == '2000.00'


def test_one_off_and_income_are_not_planned(anna):
    tx(anna, '120.00', _month(-1), note='Konzert', recurring=False)
    tx(anna, '3000.00', _month(-1), note='Gehalt', type_='INCOME')
    assert summary(anna, _month(0))['planned'] == '0.00'


def test_items_are_kept_apart_by_note_and_category(anna):
    abos = Category.objects.create(owner=anna, name='Abos')
    tx(anna, '900.00', _month(-1))
    tx(anna, '12.99', _month(-1), note='Streaming', category=abos)
    tx(anna, '9.99', _month(-1), note='Musik', category=abos)
    tx(anna, '9.99', _month(0), note='musik ', category=abos)  # gleiche Notiz, andere Schreibweise: gebucht
    data = summary(anna, _month(0))
    assert sorted(i['title'] for i in data['planned_items']) == ['Miete', 'Streaming']
    assert data['planned'] == '912.99'


def test_other_users_recurring_costs_never_count(anna):
    bert = get_user_model().objects.create_user(username='bert-wiederkehrend')
    tx(bert, '500.00', _month(-1), category=Category.objects.create(owner=bert, name='Wohnen'))
    data = summary(anna, _month(0))
    assert data['planned'] == '0.00' and data['planned_items'] == []


def test_today_overview_uses_the_same_available_amount(anna):
    tx(anna, '900.00', _month(-1))
    today = anna.client.get('/api/v1/today/').data['finanzen']
    assert today['available'] == summary(anna, _month(0))['available'] == '1100.00'
