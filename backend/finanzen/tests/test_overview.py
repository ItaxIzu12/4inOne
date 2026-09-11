"""Übersichts-Endpunkt für Budget-Block + Kategorien-Donut auf der
Finanzen-Startseite (siehe finanzen/views.py OverviewView-Docstring für die
bewusste Auslassung von "Faire Aufteilung"/"Abo-Radar")."""

from datetime import datetime, timezone as dt_timezone
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import Household, HouseholdMembership
from finanzen.models import Account, Budget, Category, Transaction

pytestmark = pytest.mark.django_db


def _current_month_start():
    return timezone.now().date().replace(day=1)


def _previous_month_start(month_start):
    return (month_start.replace(day=1) - timezone.timedelta(days=1)).replace(day=1)


def test_overview_aggregates_budget_and_category_totals_for_current_month_only():
    User = get_user_model()
    user = User.objects.create_user(username='overview@example.com', password='irrelevant-for-test')
    household = Household.objects.create(name='Testhaushalt')
    HouseholdMembership.objects.create(user=user, household=household)
    account = Account.objects.create(household=household, name='Girokonto')

    # Fixkosten/Haushalt/Sonstiges existieren bereits automatisch (finanzen/
    # signals.py post_save-Receiver auf Household) — hier nur abgeholt statt
    # erneut angelegt, sonst UniqueConstraint-Verletzung (household, name).
    fixkosten = Category.objects.get(household=household, name='Fixkosten')
    haushalt = Category.objects.get(household=household, name='Haushalt')

    month_start = _current_month_start()
    Budget.objects.create(household=household, category=fixkosten, amount='1000.00', month=month_start)
    Budget.objects.create(household=household, category=haushalt, amount='300.00', month=month_start)

    Transaction.objects.create(
        account=account, category=fixkosten, amount='680.00', occurred_at=timezone.now(), description='Miete'
    )
    Transaction.objects.create(
        account=account, category=haushalt, amount='64.20', occurred_at=timezone.now(), description='Einkauf'
    )

    # Eine Transaktion aus dem VORMONAT darf nicht mitgezählt werden.
    last_month = _previous_month_start(month_start)
    old_datetime = timezone.make_aware(datetime.combine(last_month, datetime.min.time()), dt_timezone.utc)
    Transaction.objects.create(
        account=account, category=fixkosten, amount='999.00', occurred_at=old_datetime, description='Alte Miete'
    )

    client = APIClient()
    client.force_authenticate(user=user)
    response = client.get('/api/v1/finanzen/uebersicht/')

    assert response.status_code == 200
    assert Decimal(response.data['budget']['total']) == Decimal('1300.00')
    assert Decimal(response.data['budget']['planned']) == Decimal('744.20')

    categories_by_name = {c['name']: c for c in response.data['categories']}
    assert Decimal(categories_by_name['Fixkosten']['amount']) == Decimal('680.00')
    assert Decimal(categories_by_name['Haushalt']['amount']) == Decimal('64.20')
    assert categories_by_name['Fixkosten']['color'] == '#5b3fd6'
    assert categories_by_name['Fixkosten']['icon_key'] == 'fixkosten'


def test_overview_never_includes_another_households_data():
    User = get_user_model()
    user_a = User.objects.create_user(username='overview-a@example.com', password='irrelevant-for-test-a')
    user_b = User.objects.create_user(username='overview-b@example.com', password='irrelevant-for-test-b')

    household_a = Household.objects.create(name='Haushalt A')
    household_b = Household.objects.create(name='Haushalt B')
    HouseholdMembership.objects.create(user=user_a, household=household_a)
    HouseholdMembership.objects.create(user=user_b, household=household_b)

    account_b = Account.objects.create(household=household_b, name='Konto B')
    category_b = Category.objects.create(household=household_b, name='Geheimkategorie', color='#000000', icon_key='sonstiges')
    Budget.objects.create(household=household_b, category=category_b, amount='5000.00', month=_current_month_start())
    Transaction.objects.create(
        account=account_b, category=category_b, amount='4000.00', occurred_at=timezone.now(), description='Geheim'
    )

    client = APIClient()
    client.force_authenticate(user=user_a)
    response = client.get('/api/v1/finanzen/uebersicht/')

    assert response.status_code == 200
    assert Decimal(response.data['budget']['total']) == Decimal('0')
    assert Decimal(response.data['budget']['planned']) == Decimal('0')
    # household_a hat seine eigenen (automatisch angelegten) Kategorien mit
    # 0 € Ausgaben — die "Geheimkategorie" aus household_b darf darin NICHT
    # auftauchen.
    names = {c['name'] for c in response.data['categories']}
    assert names == {'Fixkosten', 'Haushalt', 'Sonstiges'}
    assert all(Decimal(c['amount']) == Decimal('0') for c in response.data['categories'])
    assert 'Geheimkategorie' not in names
