"""Kontoauszug-Import (CSV): Vorschau, Dubletten, Fehler, Kategorien und Privatsphäre."""

from datetime import timedelta
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from finanzen.models import Category, Transaction

pytestmark = pytest.mark.django_db
URL = '/api/v1/finanzen/private/transactions/import/'


@pytest.fixture
def people():
    model = get_user_model()
    return model.objects.create_user(username='import-a'), model.objects.create_user(username='import-b')


def api(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


def row(**kwargs):
    base = {'date': str(timezone.localdate() - timedelta(days=3)), 'amount': '12.50', 'type': 'EXPENSE', 'note': 'REWE', 'category': ''}
    return {**base, **kwargs}


def test_dry_run_previews_without_saving(people):
    a, _ = people
    response = api(a).post(URL, {'rows': [row(), row(note='Gehalt', type='INCOME', amount='3100.00')], 'dry_run': True}, format='json')
    assert response.status_code == 200, response.data
    assert (response.data['new'], response.data['duplicates'], response.data['invalid'], response.data['created']) == (2, 0, 0, 0)
    assert Transaction.objects.filter(owner=a).count() == 0


def test_import_saves_valid_rows_atomically_with_decimal_amounts(people):
    a, _ = people
    response = api(a).post(URL, {'rows': [row(), row(note='Miete', amount='850.00')]}, format='json')
    assert response.status_code == 201, response.data
    assert response.data['created'] == 2
    saved = Transaction.objects.filter(owner=a).order_by('amount')
    assert [t.amount for t in saved] == [Decimal('12.50'), Decimal('850.00')]
    assert all(t.created_by == a and t.currency == 'EUR' for t in saved)


def test_duplicates_in_the_file_and_already_booked_are_skipped(people):
    a, _ = people
    client = api(a)
    client.post(URL, {'rows': [row()]}, format='json')
    response = client.post(URL, {'rows': [row(), row(note='rewe'), row(note='Bäcker'), row(note='Bäcker')]}, format='json')
    statuses = [r['status'] for r in response.data['rows']]
    assert statuses == ['duplicate', 'duplicate', 'new', 'duplicate']
    assert response.data['created'] == 1
    assert Transaction.objects.filter(owner=a).count() == 2


def test_invalid_rows_are_reported_and_the_rest_is_imported(people):
    a, _ = people
    far_past = str(timezone.localdate() - timedelta(days=365 * 11))
    rows = [row(), row(amount='0'), row(amount='abc'), row(date=far_past), row(type='TRANSFER'), row(amount='1000000')]
    response = api(a).post(URL, {'rows': rows}, format='json')
    assert response.data['created'] == 1
    assert response.data['invalid'] == 5
    messages = [r['message'] for r in response.data['rows'] if r['status'] == 'invalid']
    assert messages[0].startswith('Betrag:')
    assert any(m.startswith('Datum:') and '10 Jahre' in m for m in messages)
    assert any(m.startswith('Art:') for m in messages)
    assert any('999.999,99' in m for m in messages)


def test_known_category_is_matched_by_name_unknown_goes_to_sonstiges_and_none_is_created(people):
    a, b = people
    food = Category.objects.create(owner=a, name='Lebensmittel', color='#123456')
    Category.objects.create(owner=b, name='Haustier', color='#123456')
    response = api(a).post(URL, {'rows': [row(category='lebensmittel'), row(note='Futter', category='Haustier'), row(note='Kiosk')]}, format='json')
    assert [r['category'] for r in response.data['rows']] == ['Lebensmittel', 'Sonstiges', 'Sonstiges']
    names = set(Category.objects.filter(owner=a).values_list('name', flat=True))
    assert names == {'Lebensmittel', 'Sonstiges'}  # „Haustier“ von b wird weder genutzt noch für a angelegt
    assert Transaction.objects.get(owner=a, description='REWE').category == food


def test_import_only_ever_books_for_yourself(people):
    a, b = people
    response = api(a).post(URL, {'rows': [row(owner=b.pk, household=1)]}, format='json')
    assert response.status_code == 201
    assert Transaction.objects.filter(owner=b).count() == 0
    assert Transaction.objects.filter(owner=a).count() == 1
    # Dubletten werden nur gegen die EIGENEN Buchungen geprüft — b's gleiche Buchung verrät nichts.
    assert api(b).post(URL, {'rows': [row()], 'dry_run': True}, format='json').data['new'] == 1


def test_limits_and_login(people):
    a, _ = people
    assert api(a).post(URL, {'rows': []}, format='json').status_code == 400
    assert api(a).post(URL, {'rows': [row()] * 1001}, format='json').status_code == 400
    assert APIClient().post(URL, {'rows': [row()]}, format='json').status_code in (401, 403)
