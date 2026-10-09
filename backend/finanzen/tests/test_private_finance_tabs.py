"""Neue Felder für die Finanz-Reiter: Monatslimit pro Kategorie, wiederkehrende
Buchungen und die Liste der letzten Sparziel-Einzahlungen."""
from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from finanzen.models import Category, MonthlyBudget, SavingsContribution, SavingsGoal, Transaction

pytestmark = pytest.mark.django_db
BASE = '/api/v1/finanzen/private/'


@pytest.fixture
def users():
    a = get_user_model().objects.create_user(username='tabs-a')
    b = get_user_model().objects.create_user(username='tabs-b')
    client = APIClient()
    client.force_authenticate(a)
    return a, b, client


def test_category_limit_can_be_set_and_cleared(users):
    a, _, c = users
    cat = Category.objects.create(owner=a, name='Wohnen')
    r = c.patch(f'{BASE}categories/{cat.id}/', {'monthly_goal': '800.00'}, format='json')
    assert r.status_code == 200, r.data
    assert r.data['monthly_goal'] == '800.00'
    assert c.get(BASE + 'categories/').data[0]['monthly_goal'] == '800.00'
    assert c.patch(f'{BASE}categories/{cat.id}/', {'monthly_goal': None}, format='json').data['monthly_goal'] is None
    assert c.patch(f'{BASE}categories/{cat.id}/', {'monthly_goal': '-1'}, format='json').status_code == 400


def test_foreign_category_limit_is_not_reachable(users):
    a, b, c = users
    other = Category.objects.create(owner=b, name='Wohnen')
    assert c.patch(f'{BASE}categories/{other.id}/', {'monthly_goal': '1.00'}, format='json').status_code == 404
    assert Category.objects.get(pk=other.id).monthly_goal is None


def test_transactions_can_be_marked_recurring(users):
    a, _, c = users
    cat = Category.objects.create(owner=a, name='Wohnen')
    r = c.post(BASE + 'transactions/', {'amount': '500.00', 'type': 'EXPENSE', 'category': cat.id,
                                        'date': date.today().isoformat(), 'note': 'Miete', 'recurring': True}, format='json')
    assert r.status_code == 201, r.data
    assert r.data['recurring'] is True
    plain = c.post(BASE + 'transactions/', {'amount': '5.00', 'type': 'EXPENSE', 'category': cat.id,
                                            'date': date.today().isoformat()}, format='json')
    assert plain.data['recurring'] is False
    assert c.patch(f"{BASE}transactions/{r.data['id']}/", {'recurring': False}, format='json').data['recurring'] is False


def test_contributions_list_is_own_and_newest_first(users):
    a, b, c = users
    MonthlyBudget.objects.create(owner=a, amount=Decimal('100000'), month=date(2000, 1, 1), open_ended=True)
    goal = SavingsGoal.objects.create(owner=a, title='Japan', target_amount=Decimal('3000'))
    SavingsContribution.objects.create(owner=a, goal=goal, amount=Decimal('300'), date=date(2026, 3, 1))
    SavingsContribution.objects.create(owner=a, goal=goal, amount=Decimal('50'), date=date(2026, 3, 5))
    foreign = SavingsGoal.objects.create(owner=b, title='Fremd', target_amount=Decimal('100'))
    SavingsContribution.objects.create(owner=b, goal=foreign, amount=Decimal('10'), date=date(2026, 3, 6))

    rows = c.get(BASE + 'goals/einzahlungen/').data
    assert [(r['goal_title'], r['amount'], r['date']) for r in rows] == [
        ('Japan', '50.00', '2026-03-05'), ('Japan', '300.00', '2026-03-01'),
    ]


def test_contributions_in_a_date_range_are_complete_and_validated(users):
    a, b, c = users
    MonthlyBudget.objects.create(owner=a, amount=Decimal('100000'), month=date(2000, 1, 1), open_ended=True)
    goal = SavingsGoal.objects.create(owner=a, title='Japan', target_amount=Decimal('3000'))
    for day in (1, 5, 6, 7, 20):
        SavingsContribution.objects.create(owner=a, goal=goal, amount=Decimal('10'), date=date(2026, 10, day))
    foreign = SavingsGoal.objects.create(owner=b, title='Fremd', target_amount=Decimal('100'))
    SavingsContribution.objects.create(owner=b, goal=foreign, amount=Decimal('99'), date=date(2026, 10, 6))

    rows = c.get(BASE + 'goals/einzahlungen/', {'von': '2026-10-05', 'bis': '2026-10-07'}).data
    assert [r['date'] for r in rows] == ['2026-10-07', '2026-10-06', '2026-10-05']
    assert c.get(BASE + 'goals/einzahlungen/', {'von': '2026-10-07', 'bis': '2026-10-05'}).status_code == 400
    assert c.get(BASE + 'goals/einzahlungen/', {'von': '2026-01-01', 'bis': '2027-06-01'}).status_code == 400
    assert c.get(BASE + 'goals/einzahlungen/', {'von': 'gestern', 'bis': '2026-10-05'}).status_code == 400


def test_contributions_need_login():
    assert APIClient().get(BASE + 'goals/einzahlungen/').status_code in (401, 403)


def test_existing_transactions_default_to_not_recurring(users):
    a, _, _ = users
    t = Transaction.objects.create(owner=a, amount=Decimal('1.00'))
    assert t.recurring is False


def test_own_category_can_be_created_with_trimmed_unique_name(users):
    a, b, c = users
    Category.objects.create(owner=b, name='Hund')  # fremder Name blockiert nicht
    r = c.post(BASE + 'categories/', {'name': '  Hund   Bello ', 'monthly_goal': '60.00'}, format='json')
    assert r.status_code == 201, r.data
    assert r.data['name'] == 'Hund Bello'
    assert r.data['color'].startswith('#')
    assert r.data['monthly_goal'] == '60.00'
    assert c.post(BASE + 'categories/', {'name': 'hund bello'}, format='json').status_code == 400
    assert c.post(BASE + 'categories/', {'name': '   '}, format='json').status_code == 400
    assert c.post(BASE + 'categories/', {'name': 'x' * 41}, format='json').status_code == 400
    assert Category.objects.filter(owner=a).count() == 1


def test_category_can_be_renamed_and_keeps_its_color(users):
    a, _, c = users
    cat = Category.objects.create(owner=a, name='Wohnen', color='#123456')
    Category.objects.create(owner=a, name='Freizeit')
    r = c.patch(f'{BASE}categories/{cat.id}/', {'name': 'Miete & Wohnen'}, format='json')
    assert r.status_code == 200, r.data
    assert r.data['color'] == '#123456'
    assert c.patch(f'{BASE}categories/{cat.id}/', {'name': 'freizeit'}, format='json').status_code == 400
    # Umbenennen in die eigene Schreibweise ist erlaubt
    assert c.patch(f'{BASE}categories/{cat.id}/', {'name': 'miete & wohnen'}, format='json').status_code == 200


def test_fallback_category_keeps_name_and_cannot_be_deleted(users):
    a, _, c = users
    fallback = Category.objects.create(owner=a, name='Sonstiges')
    assert c.patch(f'{BASE}categories/{fallback.id}/', {'name': 'Rest'}, format='json').status_code == 400
    assert c.delete(f'{BASE}categories/{fallback.id}/').status_code == 400
    assert Category.objects.filter(pk=fallback.id).exists()


def test_deleting_category_moves_transactions_to_fallback(users):
    a, _, c = users
    dog = Category.objects.create(owner=a, name='Hund')
    for amount in ('12.00', '30.00'):
        Transaction.objects.create(owner=a, category=dog, type='EXPENSE', amount=Decimal(amount), datum=date(2026, 9, 3))
    impact = c.get(f'{BASE}categories/{dog.id}/impact/')
    assert impact.status_code == 200
    assert impact.data == {'transactions': 2, 'fallback': 'Sonstiges'}
    assert c.delete(f'{BASE}categories/{dog.id}/').status_code == 204
    fallback = Category.objects.get(owner=a, name='Sonstiges')  # bei Bedarf neu angelegt
    assert Transaction.objects.filter(owner=a, category=fallback).count() == 2
    assert not Category.objects.filter(pk=dog.id).exists()


def test_deleting_unused_category_does_not_create_fallback(users):
    a, _, c = users
    cat = Category.objects.create(owner=a, name='Hobby')
    assert c.delete(f'{BASE}categories/{cat.id}/').status_code == 204
    assert not Category.objects.filter(owner=a).exists()


def test_foreign_category_cannot_be_renamed_deleted_or_inspected(users):
    a, b, c = users
    other = Category.objects.create(owner=b, name='Hund')
    Transaction.objects.create(owner=b, category=other, type='EXPENSE', amount=Decimal('5.00'), datum=date(2026, 9, 3))
    assert c.patch(f'{BASE}categories/{other.id}/', {'name': 'Katze'}, format='json').status_code == 404
    assert c.delete(f'{BASE}categories/{other.id}/').status_code == 404
    assert c.get(f'{BASE}categories/{other.id}/impact/').status_code == 404
    assert Category.objects.get(pk=other.id).name == 'Hund'
    assert not Category.objects.filter(owner=a).exists()


def test_category_changes_need_login():
    cat = Category.objects.create(owner=get_user_model().objects.create_user(username='tabs-anon'), name='Hund')
    client = APIClient()
    assert client.post(BASE + 'categories/', {'name': 'X'}, format='json').status_code in (401, 403)
    assert client.delete(f'{BASE}categories/{cat.id}/').status_code in (401, 403)
