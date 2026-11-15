"""Wer schuldet wem (15.11.2026): Aufteilung, wenigste Überweisungen, Begleichen, Rechte."""

from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from reisen.models import Trip, TripExpense, TripParticipant, TripSettlement
from reisen.split import split_equally, transfers_for

pytestmark = pytest.mark.django_db
BASE = '/api/v1/reisen/'


def _user(name):
    return get_user_model().objects.create_user(username=name, email=f'{name}@example.com', password='test-secret-234', first_name=name.capitalize())


def _client(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


@pytest.fixture
def berlin():
    sophie, max_, lena, stranger = _user('sophie'), _user('max'), _user('lena'), _user('dora')
    trip = Trip.objects.create(owner=sophie, title='Berlin Wochenende', destination='Berlin', start_date='2026-11-25', end_date='2026-11-27')
    TripParticipant.objects.create(trip=trip, user=sophie, role='OWNER')
    TripParticipant.objects.create(trip=trip, user=max_, role='EDITOR')
    return {'trip': trip, 'sophie': sophie, 'max': max_, 'lena': lena, 'dora': stranger}


def _expense(trip, amount, payer, shared=(), currency='EUR', amount_trip=None):
    expense = TripExpense.objects.create(trip=trip, title='x', amount=Decimal(amount), currency=currency, date='2026-11-25',
                                         paid_by=payer, amount_trip=Decimal(amount_trip) if amount_trip else None)
    expense.shared_with.set(shared)
    return expense


def _balances(user, trip):
    response = _client(user).get(f'{BASE}trips/{trip.pk}/balances/')
    assert response.status_code == 200, response.data
    return response.data


def test_two_people_hotel_and_train_max_owes_sophie_60(berlin):
    trip, sophie, max_ = berlin['trip'], berlin['sophie'], berlin['max']
    _expense(trip, '200.00', sophie)  # Hotelanzahlung
    _expense(trip, '80.00', max_)     # Bahntickets
    data = _balances(sophie, trip)
    people = {p['name']: p for p in data['people']}
    assert people['Sophie'] == {'user': sophie.pk, 'name': 'Sophie', 'paid': '200.00', 'share': '140.00', 'balance': '60.00'}
    assert people['Max']['balance'] == '-60.00'
    assert data['transfers'] == [{'from_user': max_.pk, 'from_name': 'Max', 'to_user': sophie.pk, 'to_name': 'Sophie', 'amount': '60.00'}]
    assert data['currency'] == 'EUR' and data['unassigned'] == 0


def test_only_for_some_people_and_cents_are_split_fairly(berlin):
    trip, sophie, max_ = berlin['trip'], berlin['sophie'], berlin['max']
    _expense(trip, '30.00', sophie, shared=[max_])  # Max allein im Museum, Sophie hat ausgelegt
    assert _balances(sophie, trip)['transfers'][0]['amount'] == '30.00'
    # 10,00 € durch 3: 3,34 + 3,33 + 3,33 – nichts geht verloren
    assert split_equally(Decimal('10.00'), [3, 1, 2]) == {1: Decimal('3.34'), 2: Decimal('3.33'), 3: Decimal('3.33')}
    assert sum(split_equally(Decimal('10.00'), [1, 2, 3]).values()) == Decimal('10.00')


def test_three_people_need_at_most_two_transfers(berlin):
    trip, sophie, max_, lena = berlin['trip'], berlin['sophie'], berlin['max'], berlin['lena']
    TripParticipant.objects.create(trip=trip, user=lena, role='VIEWER')
    _expense(trip, '90.00', sophie)
    data = _balances(sophie, trip)
    assert sorted((t['from_name'], t['to_name'], t['amount']) for t in data['transfers']) == [
        ('Lena', 'Sophie', '30.00'), ('Max', 'Sophie', '30.00'),
    ]
    # allgemein: bei n Personen nie mehr als n − 1 Überweisungen
    moves = transfers_for({1: Decimal('50'), 2: Decimal('-20'), 3: Decimal('-20'), 4: Decimal('-10')})
    assert len(moves) == 3 and sum(m[2] for m in moves) == Decimal('50')


def test_expenses_without_payer_or_rate_are_counted_as_unassigned_not_guessed(berlin):
    trip, sophie = berlin['trip'], berlin['sophie']
    _expense(trip, '50.00', None)
    _expense(trip, '20.00', sophie, currency='USD')  # ohne Kurs in die Reisewährung
    _expense(trip, '40.00', sophie, currency='USD', amount_trip='37.00')  # mit Kurs: zählt in Reisewährung
    data = _balances(sophie, trip)
    assert data['unassigned'] == 2
    assert {p['name']: p['paid'] for p in data['people']}['Sophie'] == '37.00'


def test_marking_as_settled_clears_the_debt_and_can_be_undone(berlin):
    trip, sophie, max_ = berlin['trip'], berlin['sophie'], berlin['max']
    _expense(trip, '200.00', sophie)
    _expense(trip, '80.00', max_)
    response = _client(max_).post(f'{BASE}settlements/', {'trip': trip.pk, 'from_user': max_.pk, 'to_user': sophie.pk, 'amount': '60.00'}, format='json')
    assert response.status_code == 201, response.data
    data = _balances(sophie, trip)
    assert data['transfers'] == [] and {p['balance'] for p in data['people']} == {'0.00'}
    assert data['settlements'][0]['from_name'] == 'Max' and data['settlements'][0]['amount'] == '60.00'
    assert _client(sophie).delete(f"{BASE}settlements/{response.data['id']}/").status_code == 204
    assert _balances(sophie, trip)['transfers'][0]['amount'] == '60.00'


def test_rules_only_travellers_pay_share_or_settle(berlin):
    trip, sophie, dora = berlin['trip'], berlin['sophie'], berlin['dora']
    client = _client(sophie)
    bad_payer = client.post(f'{BASE}expenses/', {'trip': trip.pk, 'title': 'Taxi', 'amount': '20', 'date': '2026-11-25', 'paid_by': dora.pk}, format='json')
    assert bad_payer.status_code == 400 and 'paid_by' in bad_payer.data
    bad_share = client.post(f'{BASE}expenses/', {'trip': trip.pk, 'title': 'Taxi', 'amount': '20', 'date': '2026-11-25', 'paid_by': sophie.pk, 'shared_with': [dora.pk]}, format='json')
    assert bad_share.status_code == 400 and 'shared_with' in bad_share.data
    ok = client.post(f'{BASE}expenses/', {'trip': trip.pk, 'title': 'Taxi', 'amount': '20', 'date': '2026-11-25', 'paid_by': sophie.pk, 'shared_with': []}, format='json')
    assert ok.status_code == 201 and ok.data['paid_by_name'] == 'Sophie' and ok.data['shared_with'] == []
    assert client.post(f'{BASE}settlements/', {'trip': trip.pk, 'from_user': sophie.pk, 'to_user': sophie.pk, 'amount': '5'}, format='json').status_code == 400
    assert client.post(f'{BASE}settlements/', {'trip': trip.pk, 'from_user': berlin['max'].pk, 'to_user': sophie.pk, 'amount': '0'}, format='json').status_code == 400


def test_viewers_see_balances_but_cannot_settle_and_strangers_see_nothing(berlin):
    trip, sophie, lena, dora = berlin['trip'], berlin['sophie'], berlin['lena'], berlin['dora']
    TripParticipant.objects.create(trip=trip, user=lena, role='VIEWER')
    _expense(trip, '90.00', sophie)
    assert _client(lena).get(f'{BASE}trips/{trip.pk}/balances/').status_code == 200
    assert _client(lena).post(f'{BASE}settlements/', {'trip': trip.pk, 'from_user': lena.pk, 'to_user': sophie.pk, 'amount': '30'}, format='json').status_code == 400
    settlement = TripSettlement.objects.create(trip=trip, from_user=lena, to_user=sophie, amount=Decimal('30'))
    assert _client(lena).delete(f'{BASE}settlements/{settlement.pk}/').status_code == 403
    assert _client(dora).get(f'{BASE}trips/{trip.pk}/balances/').status_code == 404
    assert _client(dora).get(f'{BASE}settlements/?trip={trip.pk}').data == []
