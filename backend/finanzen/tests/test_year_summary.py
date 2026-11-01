"""summary/year/: das Budgetjahr je Monat — gleiche Rechnung wie summary/, nur eigene Daten, nur lesend."""
from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from finanzen.models import MonthlyBudget, SavingsGoal, Transaction

pytestmark = pytest.mark.django_db
URL = '/api/v1/finanzen/private/summary/year/'


@pytest.fixture
def users():
    a = get_user_model().objects.create_user(username='year-a')
    b = get_user_model().objects.create_user(username='year-b')
    client = APIClient()
    client.force_authenticate(a)
    return a, b, client


def _spend(owner, day, amount):
    Transaction.objects.create(owner=owner, type='EXPENSE', amount=Decimal(amount), datum=day, description='Test')


def test_past_year_matches_the_monthly_summary(users):
    a, _, client = users
    year = timezone.localdate().year - 1
    MonthlyBudget.objects.create(owner=a, month=date(year, 3, 1), open_ended=True, amount=Decimal('1000'))
    _spend(a, date(year, 3, 10), '400.00')
    _spend(a, date(year, 4, 10), '1200.00')
    data = client.get(URL, {'year': year}).data
    months = {m['month']: m for m in data['months']}
    assert len(data['months']) == 12
    assert months[f'{year}-01']['budget'] is None and months[f'{year}-01']['has_data'] is False
    assert months[f'{year}-03']['available'] == '600.00' and months[f'{year}-03']['has_data'] is True
    assert months[f'{year}-04']['available'] == '-200.00'
    assert months[f'{year}-05']['has_data'] is False and months[f'{year}-05']['budget'] == '1000.00'
    assert {m['state'] for m in data['months']} == {'past'}
    for month in (f'{year}-03', f'{year}-04'):
        assert client.get('/api/v1/finanzen/private/summary/', {'month': month}).data['available'] == months[month]['available']


def test_future_months_only_carry_the_planned_budget(users):
    a, _, client = users
    year = timezone.localdate().year + 1
    MonthlyBudget.objects.create(owner=a, month=date(year, 1, 1), open_ended=True, amount=Decimal('900'))
    _spend(a, date(year, 2, 1), '50.00')
    data = client.get(URL, {'year': year}).data
    assert all(m['state'] == 'future' for m in data['months'])
    assert data['months'][1] == {'month': f'{year}-02', 'budget': '900.00', 'expenses': None, 'saved': None,
                                 'available': None, 'has_data': False, 'state': 'future'}


def test_current_month_is_marked(users):
    _, _, client = users
    today = timezone.localdate()
    data = client.get(URL).data
    assert data['year'] == str(today.year)
    assert data['months'][today.month - 1]['state'] == 'current'


def test_other_users_data_never_counts(users):
    a, b, client = users
    year = timezone.localdate().year - 1
    MonthlyBudget.objects.create(owner=b, month=date(year, 1, 1), open_ended=True, amount=Decimal('5000'))
    _spend(b, date(year, 1, 5), '999.00')
    months = client.get(URL, {'year': year}).data['months']
    assert all(m['budget'] is None and m['expenses'] == '0.00' and not m['has_data'] for m in months)


@pytest.mark.parametrize('year', ['1999', '2101', '20x6', '26', '-2026', ''])
def test_invalid_year_is_rejected(users, year):
    assert users[2].get(URL, {'year': year}).status_code == 400


def test_requires_login_and_is_read_only(users):
    assert APIClient().get(URL).status_code in (401, 403)
    assert users[2].post(URL, {}).status_code == 405


def test_a_planned_savings_rate_alone_is_no_activity(users):
    """Eine Sparrate reserviert Geld, auch ohne Einzahlung — das macht einen leeren Monat nicht zu „im Budget geblieben“."""
    a, _, client = users
    year = timezone.localdate().year - 1
    MonthlyBudget.objects.create(owner=a, month=date(year, 1, 1), open_ended=True, amount=Decimal('1000'))
    SavingsGoal.objects.create(owner=a, title='Reise', target_amount=Decimal('5000'), monthly_amount=Decimal('200'),
                               status='ACTIVE', plan_month=date(year, 1, 1), plan_open_ended=True)
    _spend(a, date(year, 3, 4), '100.00')
    months = {m['month']: m for m in client.get(URL, {'year': year}).data['months']}
    assert months[f'{year}-02']['has_data'] is False
    assert months[f'{year}-02']['saved'] == '200.00'  # die Reservierung bleibt sichtbar und zieht vom Budget ab
    assert months[f'{year}-03']['has_data'] is True
    assert months[f'{year}-03']['available'] == '700.00'


def test_savings_warnings_count_recurring_costs_like_the_summary(users):
    """Die Warn-Rechnung (available_for_month) und „Noch verfügbar“ (summary) ergeben für künftige Monate dasselbe —
    auch mit einer wiederkehrenden Ausgabe, die im Monat noch nicht gebucht ist."""
    from finanzen.savings import available_for_month
    a, _, client = users
    today = timezone.localdate()
    this_month = today.replace(day=1)
    MonthlyBudget.objects.create(owner=a, month=this_month, open_ended=True, amount=Decimal('1000'))
    Transaction.objects.create(owner=a, type='EXPENSE', amount=Decimal('600'), datum=date(this_month.year - 1, 12, 1),
                               description='Miete', recurring=True)
    nxt = date(this_month.year + (this_month.month == 12), this_month.month % 12 + 1, 1)
    summary = client.get('/api/v1/finanzen/private/summary/', {'month': nxt.strftime('%Y-%m')}).data
    assert summary['available'] == '400.00'
    assert available_for_month(a, nxt)[0] == Decimal('400.00')


def test_year_summary_loads_the_savings_plan_once(users):
    """Zwölf Monate rechnen, aber Ziele und Einzahlungen nur einmal laden (ein SavingsPlanner je Anfrage)."""
    a, _, client = users
    year = timezone.localdate().year - 1
    MonthlyBudget.objects.create(owner=a, month=date(year, 1, 1), open_ended=True, amount=Decimal('1000'))
    from unittest import mock
    from finanzen import private_api
    with mock.patch.object(private_api, 'SavingsPlanner', wraps=private_api.SavingsPlanner) as planner:
        assert client.get(URL, {'year': year}).status_code == 200
    assert planner.call_count == 1


def test_summary_endpoints_are_rate_limited(users, settings):
    """Monats- und Jahresstand haben ein eigenes Limit pro Nutzer (gegen Dauerabfragen durch Bugs oder Skripte)."""
    from finanzen.private_api import PrivateSummaryView, PrivateYearSummaryView, SavingsGoalViewSet
    from finanzen.throttling import FinanceSummaryRateThrottle
    assert PrivateSummaryView.throttle_classes == [FinanceSummaryRateThrottle]
    assert PrivateYearSummaryView.throttle_classes == [FinanceSummaryRateThrottle]
    assert SavingsGoalViewSet.preview_new.kwargs['throttle_classes'] == [FinanceSummaryRateThrottle]
    _, _, client = users
    rest = settings.REST_FRAMEWORK
    settings.REST_FRAMEWORK = {**rest, 'DEFAULT_THROTTLE_RATES': {**rest['DEFAULT_THROTTLE_RATES'], 'finanzen_summary': '2/min'}}
    from rest_framework.settings import api_settings
    api_settings.reload()
    try:
        FinanceSummaryRateThrottle.THROTTLE_RATES = api_settings.DEFAULT_THROTTLE_RATES
        codes = [client.get(URL).status_code for _ in range(3)]
    finally:
        settings.REST_FRAMEWORK = rest
        api_settings.reload()
        FinanceSummaryRateThrottle.THROTTLE_RATES = api_settings.DEFAULT_THROTTLE_RATES
    assert codes == [200, 200, 429]
