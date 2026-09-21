"""Rechenlogik zwischen Übersicht und Analysen (finanzen/services.py,
FinanzenTab.md §3.4/§4). Beispielwerte stehen so auch in ARCHITEKTUR.md §2.3.

Ausgangslage (ein Haushalt, zwei Mitglieder):
  Einkommen        3000,00 (ich) + 2200,00 (andere Person) = 5200,00
  Feste Abzüge     Miete 900,00 + Versicherung 65,00 (beide Fixkosten, aktiv)
                   + Pausiertes Abo 50,00 (inaktiv, zählt nirgends)
  Transaktionen    Wocheneinkauf 186,00 + Drogerie 74,00 (Haushalt)
                   + Restaurant 68,50 (Sonstiges)            = 328,50
                   (nicht mitgezählt: Vormonat 999,00, gelöscht 500,00,
                   fremder Haushalt 4000,00)
  Puffer           300,00
"""

from datetime import datetime, timedelta, timezone as dt_timezone
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import Household, HouseholdMembership
from finanzen.models import Account, Category, RecurringDeduction, Transaction
from finanzen.services import month_bounds

pytestmark = pytest.mark.django_db

ME_INCOME = Decimal('3000.00')
OTHER_INCOME = Decimal('2200.00')


@pytest.fixture
def setup():
    User = get_user_model()
    me = User.objects.create_user(username='me@example.com', password='irrelevant-for-test')
    other = User.objects.create_user(username='other@example.com', password='irrelevant-for-test')
    household = Household.objects.create(name='Testhaushalt', monthly_buffer=Decimal('300.00'))
    HouseholdMembership.objects.create(user=me, household=household, monthly_income=ME_INCOME)
    HouseholdMembership.objects.create(user=other, household=household, monthly_income=OTHER_INCOME)
    account = Account.objects.create(household=household, name='Haushaltskasse')

    fixkosten = Category.objects.get(household=household, name='Fixkosten')
    haushalt = Category.objects.get(household=household, name='Haushalt')
    sonstiges = Category.objects.get(household=household, name='Sonstiges')
    Category.objects.filter(pk=fixkosten.pk).update(monthly_goal='1000.00')
    Category.objects.filter(pk=haushalt.pk).update(monthly_goal='300.00')

    RecurringDeduction.objects.create(household=household, name='Miete', amount='900.00', category=fixkosten)
    RecurringDeduction.objects.create(household=household, name='Versicherung', amount='65.00', category=fixkosten)
    RecurringDeduction.objects.create(
        household=household, name='Pausiertes Abo', amount='50.00', category=fixkosten, active=False
    )

    now = timezone.now()
    for amount, category, description in [
        ('186.00', haushalt, 'Wocheneinkauf'),
        ('74.00', haushalt, 'Drogerie'),
        ('68.50', sonstiges, 'Restaurant'),
    ]:
        Transaction.objects.create(
            account=account, category=category, amount=amount, description=description, occurred_at=now, created_by=me
        )

    start, _ = month_bounds()
    Transaction.objects.create(
        account=account, category=fixkosten, amount='999.00', occurred_at=start - timedelta(days=1), description='Vormonat'
    )
    deleted = Transaction.objects.create(
        account=account, category=haushalt, amount='500.00', occurred_at=now, description='Gelöscht'
    )
    deleted.soft_delete()

    other_household = Household.objects.create(name='Fremder Haushalt')
    other_account = Account.objects.create(household=other_household, name='Fremdkonto')
    Transaction.objects.create(
        account=other_account,
        category=Category.objects.get(household=other_household, name='Haushalt'),
        amount='4000.00',
        occurred_at=now,
        description='Fremd',
    )

    client_me = APIClient()
    client_me.force_authenticate(user=me)
    client_other = APIClient()
    client_other.force_authenticate(user=other)
    return {
        'household': household,
        'account': account,
        'categories': {'Fixkosten': fixkosten, 'Haushalt': haushalt, 'Sonstiges': sonstiges},
        'me': client_me,
        'other': client_other,
    }


def _categories(response):
    return {c['name']: Decimal(c['amount']) for c in response.data['categories']}


# Kategorie "ausgegeben" (Übersicht) -------------------------------------------


def test_category_spent_is_transactions_plus_assigned_active_deductions(setup):
    response = setup['me'].get('/api/v1/finanzen/uebersicht/')

    assert response.status_code == 200
    spent = _categories(response)
    assert spent['Fixkosten'] == Decimal('965.00')  # 0 Transaktionen + Miete 900 + Versicherung 65 (Pausiertes zählt nicht)
    assert spent['Haushalt'] == Decimal('260.00')  # 186 + 74 (gelöschte 500 und fremde 4000 zählen nicht)
    assert spent['Sonstiges'] == Decimal('68.50')


def test_budget_head_is_all_spending_versus_sum_of_category_goals(setup):
    response = setup['me'].get('/api/v1/finanzen/uebersicht/')

    assert Decimal(response.data['budget']['planned']) == Decimal('1293.50')  # 965 + 328,50
    assert Decimal(response.data['budget']['total']) == Decimal('1300.00')  # 1000 + 300 (Sonstiges ohne Ziel)


def test_uncategorised_deduction_counts_in_budget_head_but_in_no_category(setup):
    RecurringDeduction.objects.create(household=setup['household'], name='Ohne Kategorie', amount='10.00')

    overview = setup['me'].get('/api/v1/finanzen/uebersicht/')

    assert Decimal(overview.data['budget']['planned']) == Decimal('1303.50')
    assert sum(_categories(overview).values()) == Decimal('1293.50')  # Kategorien-Summe unverändert


# Verfügbares Einkommen (Analysen) ---------------------------------------------


def test_verfuegbares_einkommen_subtracts_deductions_all_transactions_and_buffer(setup):
    response = setup['me'].get('/api/v1/finanzen/analysen/')

    assert response.status_code == 200
    assert Decimal(response.data['transactions_total']) == Decimal('328.50')
    # 5200 − 965 (aktive Abzüge) − 328,50 (alle Transaktionen des Monats) − 300 (Puffer)
    assert Decimal(response.data['verfuegbares_einkommen']) == Decimal('3606.50')


def test_deductions_are_never_counted_twice(setup):
    # Zusammenhang der beiden Tabs: Einkommen − Hero-"ausgegeben" − Puffer.
    overview = setup['me'].get('/api/v1/finanzen/uebersicht/')
    analysen = setup['me'].get('/api/v1/finanzen/analysen/')

    assert Decimal(analysen.data['verfuegbares_einkommen']) == (
        Decimal('5200.00') - Decimal(overview.data['budget']['planned']) - Decimal('300.00')
    )


def test_verfuegbares_einkommen_can_go_negative(setup):
    setup['me'].patch('/api/v1/finanzen/analysen/puffer/', {'monthly_buffer': '9000.00'}, format='json')

    response = setup['me'].get('/api/v1/finanzen/analysen/')

    assert Decimal(response.data['verfuegbares_einkommen']) == Decimal('5200.00') - Decimal('965.00') - Decimal('328.50') - Decimal('9000.00')


# Synchronität: eine Schreiboperation verändert BEIDE Endpunkte ---------------


def test_adding_a_transaction_changes_category_amount_and_verfuegbares_einkommen_together(setup):
    before_overview = setup['me'].get('/api/v1/finanzen/uebersicht/')
    before_analysen = setup['me'].get('/api/v1/finanzen/analysen/')

    created = setup['me'].post(
        '/api/v1/finanzen/transaktionen/',
        {
            'amount': '30.00',
            'description': 'Wochenende',
            'category_id': setup['categories']['Sonstiges'].id,
            'occurred_at': timezone.now().isoformat(),
        },
        format='json',
    )
    assert created.status_code == 201

    after_overview = setup['me'].get('/api/v1/finanzen/uebersicht/')
    after_analysen = setup['me'].get('/api/v1/finanzen/analysen/')

    assert _categories(after_overview)['Sonstiges'] - _categories(before_overview)['Sonstiges'] == Decimal('30.00')
    assert Decimal(before_analysen.data['verfuegbares_einkommen']) - Decimal(after_analysen.data['verfuegbares_einkommen']) == Decimal('30.00')


def test_editing_and_deleting_a_transaction_change_both_endpoints(setup):
    transaction = Transaction.objects.get(description='Restaurant')

    setup['me'].patch(f'/api/v1/finanzen/transaktionen/{transaction.id}/', {'amount': '100.00'}, format='json')
    analysen = setup['me'].get('/api/v1/finanzen/analysen/')
    assert Decimal(analysen.data['verfuegbares_einkommen']) == Decimal('3606.50') - Decimal('31.50')  # 68,50 → 100

    setup['me'].delete(f'/api/v1/finanzen/transaktionen/{transaction.id}/')
    overview = setup['me'].get('/api/v1/finanzen/uebersicht/')
    analysen = setup['me'].get('/api/v1/finanzen/analysen/')
    assert _categories(overview)['Sonstiges'] == Decimal('0.00')
    assert Decimal(analysen.data['verfuegbares_einkommen']) == Decimal('3606.50') + Decimal('68.50')


def test_changing_a_deduction_changes_category_amount_and_verfuegbares_einkommen(setup):
    miete = RecurringDeduction.objects.get(name='Miete')

    setup['me'].patch(f'/api/v1/finanzen/abzuege/{miete.id}/', {'active': False}, format='json')

    overview = setup['me'].get('/api/v1/finanzen/uebersicht/')
    analysen = setup['me'].get('/api/v1/finanzen/analysen/')
    assert _categories(overview)['Fixkosten'] == Decimal('65.00')
    assert Decimal(analysen.data['verfuegbares_einkommen']) == Decimal('3606.50') + Decimal('900.00')


def test_changing_own_income_and_buffer_change_verfuegbares_einkommen(setup):
    setup['me'].patch('/api/v1/finanzen/analysen/einkommen/', {'monthly_income': '3500.00'}, format='json')
    setup['me'].patch('/api/v1/finanzen/analysen/puffer/', {'monthly_buffer': '400.00'}, format='json')

    analysen = setup['me'].get('/api/v1/finanzen/analysen/')

    assert Decimal(analysen.data['household_total_income']) == Decimal('5700.00')
    assert Decimal(analysen.data['verfuegbares_einkommen']) == Decimal('3606.50') + Decimal('500.00') - Decimal('100.00')


# Monatsgrenzen -----------------------------------------------------------------


def test_transactions_dated_in_the_future_do_not_count_for_the_current_month(setup):
    _, end = month_bounds()
    Transaction.objects.create(
        account=setup['account'],
        category=setup['categories']['Sonstiges'],
        amount='777.00',
        occurred_at=end,
        description='Nächster Monat',
    )

    analysen = setup['me'].get('/api/v1/finanzen/analysen/')

    assert Decimal(analysen.data['transactions_total']) == Decimal('328.50')


def test_month_bounds_roll_over_december():
    start, end = month_bounds(datetime(2026, 12, 15, 12, 0, tzinfo=dt_timezone.utc))

    assert (start.year, start.month, start.day) == (2026, 12, 1)
    assert (end.year, end.month, end.day) == (2027, 1, 1)


# Privates Einkommen -------------------------------------------------------------


def test_individual_income_never_appears_in_any_other_members_responses(setup):
    for path in (
        '/api/v1/finanzen/analysen/',
        '/api/v1/finanzen/uebersicht/',
        '/api/v1/finanzen/transaktionen/',
        '/api/v1/finanzen/kategorien/',
        '/api/v1/finanzen/abzuege/',
    ):
        response_me = setup['me'].get(path)
        response_other = setup['other'].get(path)

        assert '2200' not in response_me.content.decode(), path  # Einkommen der anderen Person
        assert '3000' not in response_other.content.decode(), path  # mein Einkommen, aus Sicht der anderen Person

    # Positiv-Gegenprobe: jede Person sieht das EIGENE Einkommen und die Summe.
    assert setup['me'].get('/api/v1/finanzen/analysen/').data['monthly_income'] == '3000.00'
    assert setup['other'].get('/api/v1/finanzen/analysen/').data['monthly_income'] == '2200.00'
    assert setup['other'].get('/api/v1/finanzen/analysen/').data['household_total_income'] == '5200.00'


# Solo-Haushalt ------------------------------------------------------------------


def test_solo_household_total_income_equals_own_income_and_overview_has_no_fairness():
    # Bei genau einem Mitglied fallen "mein Einkommen" und "Haushalts-
    # Gesamteinkommen" zusammen, das Verfügbare Einkommen ist direkt
    # nachrechenbar — und die Übersicht liefert KEIN fairness-Feld.
    User = get_user_model()
    user = User.objects.create_user(username='solo@example.com', password='irrelevant-for-test')
    household = Household.objects.create(name='Anna', monthly_buffer=Decimal('300.00'))
    HouseholdMembership.objects.create(user=user, household=household, monthly_income=Decimal('1800.00'))
    account = Account.objects.create(household=household, name='Haushaltskasse')
    fixkosten = Category.objects.get(household=household, name='Fixkosten')
    haushalt = Category.objects.get(household=household, name='Haushalt')
    RecurringDeduction.objects.create(household=household, name='Miete', amount='900.00', category=fixkosten)
    Transaction.objects.create(
        account=account, category=haushalt, amount='100.00', occurred_at=timezone.now(), created_by=user
    )
    client = APIClient()
    client.force_authenticate(user=user)

    analysen = client.get('/api/v1/finanzen/analysen/')
    overview = client.get('/api/v1/finanzen/uebersicht/')

    assert analysen.data['monthly_income'] == analysen.data['household_total_income'] == '1800.00'
    assert analysen.data['verfuegbares_einkommen'] == '500.00'  # 1800 − 900 − 100 − 300
    assert overview.data['member_count'] == 1
    assert 'fairness' not in overview.data
