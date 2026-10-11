"""Geplante Ausgaben nachvollziehbar: jede geplante Summe hat konkrete Posten (Datum, Kategorie, Betrag), Kategorie-
Budgets zeigen ausgegeben/geplant/verfügbar, und nichts wird doppelt gezählt."""
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
    user = get_user_model().objects.create_user(username='geplant-anna')
    client = APIClient()
    client.force_authenticate(user)
    user.client = client
    user.freizeit = Category.objects.create(owner=user, name='Freizeit', monthly_goal=Decimal('300'))
    user.mobil = Category.objects.create(owner=user, name='Mobilität', monthly_goal=Decimal('100'))
    return user


def budget(user, amount='2000'):
    MonthlyBudget.objects.create(owner=user, month=_month(-24), open_ended=True, amount=Decimal(amount))


def tx(user, amount, day, note='', category=None, recurring=False, type_='EXPENSE'):
    return Transaction.objects.create(owner=user, amount=Decimal(amount), datum=day, description=note,
                                      category=category or user.freizeit, recurring=recurring, type=type_)


def summary(user, month: date) -> dict:
    r = user.client.get(BASE + f'summary/?month={month:%Y-%m}')
    assert r.status_code == 200, r.data
    return r.data


def cat(data, name):
    return next(c for c in data['budget_categories'] if c['name'] == name)


def test_future_transaction_is_planned_with_its_details(anna):
    budget(anna)
    day = _month(1) + timedelta(days=2)
    t = tx(anna, '14.99', day, note='Netflix')
    data = summary(anna, _month(1))
    assert data['planned'] == '14.99' and data['spent'] == '0.00'
    assert data['planned_items'] == [{'kind': 'TRANSACTION', 'key': 'netflix|%d' % anna.freizeit.pk, 'id': t.pk,
                                      'source_id': None, 'title': 'Netflix', 'category': anna.freizeit.pk,
                                      'amount': '14.99', 'date': day.isoformat()}]
    assert data['available'] == '1985.01'


def test_breakdown_adds_up_exactly(anna):
    budget(anna)
    today = timezone.localdate()
    tx(anna, '120.00', today, note='Restaurant')  # ausgegeben
    tx(anna, '45.00', today + timedelta(days=40), note='Konzert')  # ggf. anderer Monat
    tx(anna, '29.99', _month(-1) + timedelta(days=4), note='Fitnessstudio', recurring=True)  # Regel aus Vormonat
    for offset in (0, 1):
        d = summary(anna, _month(offset))
        total = Decimal(d['budget']) - Decimal(d['spent']) - Decimal(d['planned']) - Decimal(d['saved'])
        assert Decimal(d['available']) == total
        assert Decimal(d['planned']) == sum(Decimal(i['amount']) for i in d['planned_items'])


def test_other_month_does_not_see_it(anna):
    budget(anna)
    tx(anna, '50.00', _month(2) + timedelta(days=1), note='Zug')
    assert summary(anna, _month(1))['planned'] == '0.00'
    assert summary(anna, _month(2))['planned'] == '50.00'


def test_date_change_moves_planned_between_months(anna):
    budget(anna)
    t = tx(anna, '50.00', _month(1) + timedelta(days=1), note='Zug')
    r = anna.client.patch(f'{BASE}transactions/{t.pk}/', {'date': (_month(2) + timedelta(days=1)).isoformat()}, format='json')
    assert r.status_code == 200, r.data
    assert summary(anna, _month(1))['planned'] == '0.00'
    assert summary(anna, _month(2))['planned'] == '50.00'


def test_category_change_moves_planned_between_category_budgets(anna):
    budget(anna)
    t = tx(anna, '45.00', _month(1) + timedelta(days=3), note='Konzert')
    before = summary(anna, _month(1))
    assert cat(before, 'Freizeit')['planned'] == '45.00' and cat(before, 'Mobilität')['planned'] == '0.00'
    assert anna.client.patch(f'{BASE}transactions/{t.pk}/', {'category': anna.mobil.pk}, format='json').status_code == 200
    after = summary(anna, _month(1))
    assert cat(after, 'Freizeit')['planned'] == '0.00' and cat(after, 'Mobilität')['planned'] == '45.00'
    assert cat(after, 'Mobilität')['available'] == '55.00'


def test_delete_updates_totals(anna):
    budget(anna)
    t = tx(anna, '45.00', _month(1) + timedelta(days=3))
    assert anna.client.delete(f'{BASE}transactions/{t.pk}/').status_code == 204
    data = summary(anna, _month(1))
    assert data['planned'] == '0.00' and data['planned_items'] == []


def test_booked_transaction_is_spent_not_planned(anna):
    budget(anna)
    tx(anna, '42.00', timezone.localdate(), note='Restaurant')
    data = summary(anna, _month(0))
    assert data['spent'] == '42.00' and data['planned'] == '0.00'
    assert cat(data, 'Freizeit') == {'id': anna.freizeit.pk, 'name': 'Freizeit', 'color': anna.freizeit.color,
                                     'limit': '300.00', 'spent': '42.00', 'planned': '0.00', 'available': '258.00'}


def test_planned_and_booked_are_never_counted_twice(anna):
    budget(anna)
    tx(anna, '14.99', _month(-1) + timedelta(days=2), note='Netflix', recurring=True)
    future = tx(anna, '14.99', _month(1) + timedelta(days=2), note='Netflix', recurring=True)  # schon eingetragen
    data = summary(anna, _month(1))
    assert data['planned'] == '14.99'  # einmal, nicht 29,98
    assert [(i['kind'], i['id']) for i in data['planned_items']] == [('TRANSACTION', future.pk)]
    assert cat(data, 'Freizeit')['planned'] == '14.99'


def test_no_monthly_budget_keeps_planned_without_fake_overrun(anna):
    tx(anna, '220.00', _month(1) + timedelta(days=1))
    data = summary(anna, _month(1))
    assert data['budget'] is None and data['available'] is None
    assert data['planned'] == '220.00'


def test_category_without_budget_is_not_listed_as_over(anna):
    budget(anna)
    ohne = Category.objects.create(owner=anna, name='Sonstiges')
    tx(anna, '45.00', _month(1) + timedelta(days=1), category=ohne)
    data = summary(anna, _month(1))
    assert 'Sonstiges' not in [c['name'] for c in data['budget_categories']]
    assert [i['category'] for i in data['planned_items']] == [ohne.pk]


def test_other_currency_is_not_mixed_in(anna):
    budget(anna)
    Transaction.objects.create(owner=anna, amount=Decimal('99.00'), datum=_month(1) + timedelta(days=1),
                               category=anna.freizeit, currency='USD')
    assert summary(anna, _month(1))['planned'] == '0.00'


def test_amounts_stay_decimal_strings(anna):
    budget(anna)
    tx(anna, '0.10', _month(1) + timedelta(days=1))
    tx(anna, '0.20', _month(1) + timedelta(days=2))
    assert summary(anna, _month(1))['planned'] == '0.30'  # kein 0.30000000000000004


def test_user_never_sees_planned_items_of_others(anna):
    bert = get_user_model().objects.create_user(username='geplant-bert')
    secret = Transaction.objects.create(owner=bert, amount=Decimal('500'), datum=_month(1) + timedelta(days=1),
                                        description='Geheim', category=Category.objects.create(owner=bert, name='X'))
    data = summary(anna, _month(1))
    assert data['planned_items'] == [] and 'Geheim' not in str(data)
    assert anna.client.get(f'{BASE}transactions/{secret.pk}/').status_code == 404
    assert anna.client.patch(f'{BASE}transactions/{secret.pk}/', {'amount': '1'}, format='json').status_code == 404
