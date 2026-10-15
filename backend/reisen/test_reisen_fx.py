"""Reisebudget + Währungen (docs/REISEN_V1.md, Abschnitt Budget): Originalbetrag bleibt, Umrechnung als Richtkurs,
historischer Schnappschuss je Ausgabe, kein direktes Addieren verschiedener Währungen, kein geratener Kurs."""

from datetime import timedelta
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from core.fx import get_rate, latest_table, parse_ecb
from core.models import ExchangeRate, UserPreference
from reisen.models import Trip, TripExpense

pytestmark = pytest.mark.django_db


def day(offset: int) -> str:
    """Datum relativ zu heute — neue Reisen dürfen nicht vor heute beginnen."""
    return (timezone.localdate() + timedelta(days=offset)).isoformat()
BASE = '/api/v1/reisen/'


@pytest.fixture
def anna():
    return get_user_model().objects.create_user(username='anna', email='anna@example.com', password='test-secret-234')


def api(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


def rates(day=None, **values):
    day = day or timezone.localdate()
    for code, value in (values or {'JPY': '174.50', 'USD': '1.10', 'CHF': '0.94'}).items():
        ExchangeRate.objects.create(currency=code, rate=Decimal(value), rate_date=day)


def japan(owner, **kwargs):
    return Trip.objects.create(owner=owner, title='Japan', destination='Tokio, Japan', start_date='2027-05-01', end_date='2027-05-10', currency='JPY', **kwargs)


def trip_data(client, trip):
    return client.get(f'{BASE}trips/{trip.pk}/').data


# ---------- Kursdienst ----------

ECB_XML = b"""<?xml version="1.0" encoding="UTF-8"?>
<gesmes:Envelope xmlns:gesmes="http://www.gesmes.org/xml/2002-08-01" xmlns="http://www.ecb.int/vocabulary/2002-08-01/eurofxref">
  <Cube><Cube time="2026-10-09"><Cube currency="USD" rate="1.0950"/><Cube currency="JPY" rate="174.50"/>
  <Cube currency="XXX" rate="2"/><Cube currency="CHF" rate="0.9400"/></Cube></Cube>
</gesmes:Envelope>"""


def test_ecb_table_is_parsed_and_only_supported_currencies_are_kept():
    day, table = parse_ecb(ECB_XML)
    assert day.isoformat() == '2026-10-09'
    assert table == {'USD': Decimal('1.0950'), 'JPY': Decimal('174.50'), 'CHF': Decimal('0.9400')}


def test_ecb_parser_refuses_dtds_and_entities():
    with pytest.raises(ValueError):
        parse_ecb(b'<?xml version="1.0"?><!DOCTYPE x [<!ENTITY a "b">]><x>&a;</x>')


def test_cross_rates_run_through_eur_in_decimal():
    rates()
    rate = get_rate('JPY', 'EUR')
    assert rate.rate == Decimal('0.0057306590')
    assert get_rate('JPY', 'USD').rate == (Decimal('1.10') / Decimal('174.50')).quantize(Decimal('0.0000000001'))
    assert get_rate('EUR', 'EUR').rate == Decimal('1')


def test_no_rate_is_ever_guessed_when_the_table_is_missing_or_too_old():
    assert latest_table() is None
    assert get_rate('JPY', 'EUR') is None
    rates(day=timezone.localdate() - timedelta(days=8))
    assert latest_table() is None and get_rate('JPY', 'EUR') is None


def test_rates_endpoint_needs_login_and_says_honestly_when_nothing_is_available(anna):
    assert APIClient().get('/api/v1/fx/rates/').status_code == 401
    assert api(anna).get('/api/v1/fx/rates/').data == {'available': False, 'base': 'EUR', 'rate_date': None, 'rates': {}}
    rates()
    data = api(anna).get('/api/v1/fx/rates/').data
    assert data['available'] is True and data['rates']['JPY'] == '174.50000000' and data['rates']['EUR'] == '1'
    assert data['rate_date'] == timezone.localdate().isoformat()


def test_home_currency_is_one_central_setting(anna):
    client = api(anna)
    assert client.get('/api/v1/auth/me/').data['home_currency'] == 'EUR'
    assert client.patch('/api/v1/auth/me/', {'home_currency': 'CHF'}, format='json').data['home_currency'] == 'CHF'
    assert UserPreference.objects.get(user=anna).home_currency == 'CHF'
    assert client.patch('/api/v1/auth/me/', {'home_currency': 'XYZ'}, format='json').status_code == 400
    assert client.patch('/api/v1/auth/me/', {}, format='json').status_code == 400


# ---------- Budget und Ausgaben (Testfälle 46–50) ----------

def test_46_budget_in_jpy_is_stored_exactly(anna):
    rates()
    client = api(anna)
    trip = japan(anna)
    response = client.patch(f'{BASE}trips/{trip.pk}/', {'budget_amount': '250000.00'}, format='json')
    assert response.status_code == 200
    assert (response.data['budget_amount'], response.data['currency']) == ('250000.00', 'JPY')
    assert Trip.objects.get(pk=trip.pk).budget_amount == Decimal('250000.00')


def test_47_expense_without_budget_in_trip_currency_by_default(anna):
    rates()
    client = api(anna)
    trip = japan(anna)
    response = client.post(f'{BASE}expenses/', {'trip': trip.pk, 'title': 'Restaurant', 'amount': '8500', 'date': '2027-05-04', 'category': 'ESSEN'}, format='json')
    assert response.status_code == 201, response.data
    assert (response.data['amount'], response.data['currency'], response.data['amount_trip']) == ('8500.00', 'JPY', '8500.00')
    assert (response.data['home_currency'], response.data['amount_home']) == ('EUR', '48.71')
    data = trip_data(client, trip)
    assert data['budget_amount'] is None and data['budget_spent'] == '8500.00'


def test_48_budget_after_existing_expenses(anna):
    client = api(anna)
    trip = japan(anna)
    client.post(f'{BASE}expenses/', {'trip': trip.pk, 'title': 'Hotel', 'amount': '50000', 'date': '2027-05-01'}, format='json')
    client.patch(f'{BASE}trips/{trip.pk}/', {'budget_amount': '250000.00'}, format='json')
    data = trip_data(client, trip)
    assert Decimal(data['budget_amount']) - Decimal(data['budget_spent']) == Decimal('200000.00')


def test_49_multi_currency_is_summed_in_the_trip_currency_never_added_raw(anna):
    rates()
    client = api(anna)
    trip = japan(anna, budget_amount=Decimal('250000'))
    a = client.post(f'{BASE}expenses/', {'trip': trip.pk, 'title': 'Restaurant', 'amount': '8500', 'currency': 'JPY', 'date': '2027-05-04'}, format='json').data
    b = client.post(f'{BASE}expenses/', {'trip': trip.pk, 'title': 'Flug', 'amount': '100', 'currency': 'EUR', 'date': '2026-11-15'}, format='json').data
    assert (a['amount'], a['currency']) == ('8500.00', 'JPY') and (b['amount'], b['currency']) == ('100.00', 'EUR')
    assert b['amount_trip'] == '17450.00' and b['amount_home'] == '100.00'
    assert trip_data(client, trip)['budget_spent'] == '25950.00'  # 8.500 + 17.450 JPY — nicht 8.600


def test_50_historical_conversion_does_not_follow_later_rates(anna):
    rates(day=timezone.localdate() - timedelta(days=1))
    client = api(anna)
    trip = japan(anna)
    expense = client.post(f'{BASE}expenses/', {'trip': trip.pk, 'title': 'Restaurant', 'amount': '8500', 'date': '2027-05-04'}, format='json').data
    assert expense['amount_home'] == '48.71'
    rates(JPY='160.00')  # neuer, anderer Tageskurs
    client.patch(f'{BASE}expenses/{expense["id"]}/', {'title': 'Ramen'}, format='json')
    again = client.get(f'{BASE}expenses/{expense["id"]}/').data
    assert (again['amount'], again['currency'], again['amount_home']) == ('8500.00', 'JPY', '48.71')
    assert again['rate_date'] == (timezone.localdate() - timedelta(days=1)).isoformat()
    # Ändert sich die Zahlung selbst, gilt ein neuer Schnappschuss mit dem dann aktuellen Kurs.
    changed = client.patch(f'{BASE}expenses/{expense["id"]}/', {'amount': '16000'}, format='json').data
    assert changed['amount_home'] == '100.00' and changed['rate_date'] == timezone.localdate().isoformat()


def test_fx_outage_still_saves_the_payment_without_inventing_a_rate(anna):
    client = api(anna)
    trip = japan(anna)
    response = client.post(f'{BASE}expenses/', {'trip': trip.pk, 'title': 'Flug', 'amount': '350', 'currency': 'EUR', 'date': '2026-11-15'}, format='json')
    assert response.status_code == 201
    assert (response.data['amount'], response.data['currency']) == ('350.00', 'EUR')
    assert response.data['amount_trip'] is None and response.data['rate_to_trip'] is None
    assert response.data['amount_home'] == '350.00'  # gleiche Währung wie die Heimatwährung — keine Umrechnung nötig
    assert trip_data(client, trip)['budget_spent'] == '0.00'


def test_conversion_values_from_the_client_are_ignored(anna):
    rates()
    client = api(anna)
    trip = japan(anna)
    data = client.post(
        f'{BASE}expenses/',
        {'trip': trip.pk, 'title': 'Taxi', 'amount': '3000', 'date': '2027-05-02', 'amount_home': '9999', 'amount_trip': '1', 'rate_to_home': '5'},
        format='json',
    ).data
    assert (data['amount_trip'], data['amount_home']) == ('3000.00', '17.19')


def test_amount_and_currency_are_validated(anna):
    client = api(anna)
    trip = japan(anna)
    for bad in [{'amount': '0'}, {'amount': '-5'}, {'currency': 'XYZ'}]:
        payload = {'trip': trip.pk, 'title': 'x', 'amount': '10', 'date': '2027-05-02', **bad}
        assert client.post(f'{BASE}expenses/', payload, format='json').status_code == 400, bad


def test_home_value_uses_the_home_currency_of_whoever_records_it(anna):
    rates()
    UserPreference.objects.create(user=anna, home_currency='CHF')
    trip = japan(anna)
    data = api(anna).post(f'{BASE}expenses/', {'trip': trip.pk, 'title': 'Bahn', 'amount': '17450', 'date': '2027-05-02'}, format='json').data
    assert (data['home_currency'], data['amount_home']) == ('CHF', '94.00')


def test_changing_the_trip_currency_recomputes_only_the_trip_values(anna):
    rates()
    client = api(anna)
    trip = japan(anna)
    expense = client.post(f'{BASE}expenses/', {'trip': trip.pk, 'title': 'Restaurant', 'amount': '8500', 'date': '2027-05-04'}, format='json').data
    client.patch(f'{BASE}trips/{trip.pk}/', {'currency': 'EUR'}, format='json')
    stored = TripExpense.objects.get(pk=expense['id'])
    assert (stored.amount, stored.currency, stored.amount_trip, stored.amount_home) == (Decimal('8500.00'), 'JPY', Decimal('48.71'), Decimal('48.71'))
    assert trip_data(client, trip)['budget_spent'] == '48.71'


def test_a_new_trip_without_currency_uses_the_creators_home_currency_not_a_fixed_one(anna):
    UserPreference.objects.create(user=anna, home_currency='CHF')
    data = api(anna).post(f'{BASE}trips/', {'title': 'Bern', 'destination': 'Bern', 'start_date': day(42), 'end_date': day(45)}, format='json').data
    assert data['currency'] == 'CHF'


def test_three_currencies_home_eur_budget_jpy_expense_usd(anna):
    rates()
    client = api(anna)
    trip = japan(anna, budget_amount=Decimal('250000'))
    data = client.post(f'{BASE}expenses/', {'trip': trip.pk, 'title': 'Hotel', 'amount': '350', 'currency': 'USD', 'date': '2027-05-02'}, format='json').data
    assert (data['amount'], data['currency']) == ('350.00', 'USD')
    assert (data['home_currency'], data['amount_home']) == ('EUR', '318.18')  # 350 / 1,10
    assert data['amount_trip'] == '55522.73'  # 350 × 174,5 / 1,10
    assert trip_data(client, trip)['budget_spent'] == '55522.73'


def test_home_currency_jpy_converts_euro_expenses_to_yen(anna):
    rates()
    UserPreference.objects.create(user=anna, home_currency='JPY')
    trip = Trip.objects.create(owner=anna, title='Lissabon', destination='Lissabon', start_date='2026-11-12', end_date='2026-11-15', currency='EUR')
    data = api(anna).post(f'{BASE}expenses/', {'trip': trip.pk, 'title': 'Essen', 'amount': '100', 'date': '2026-11-12'}, format='json').data
    assert (data['home_currency'], data['amount_home'], data['amount_trip']) == ('JPY', '17450.00', '100.00')


def test_expenses_saved_during_an_outage_are_counted_once_a_rate_is_back(anna):
    client = api(anna)
    trip = japan(anna)
    saved = client.post(f'{BASE}expenses/', {'trip': trip.pk, 'title': 'Flug', 'amount': '100', 'currency': 'EUR', 'date': '2026-11-15'}, format='json').data
    assert saved['amount_trip'] is None and trip_data(client, trip)['budget_spent'] == '0.00'

    rates()  # Kurs wieder verfügbar
    assert trip_data(client, trip)['budget_spent'] == '17450.00'
    again = client.get(f'{BASE}expenses/{saved["id"]}/').data
    assert (again['amount'], again['currency'], again['amount_trip']) == ('100.00', 'EUR', '17450.00')
    assert again['amount_home'] == '100.00' and again['rate_date'] == timezone.localdate().isoformat()


def test_backfill_never_touches_migrated_expenses_or_invents_their_home_value(anna):
    rates()
    trip = japan(anna)
    legacy = TripExpense.objects.create(trip=trip, title='Alt', amount=Decimal('5000'), date='2027-05-01')  # wie nach 0011
    assert (legacy.amount_trip, legacy.amount_home) == (Decimal('5000'), None)
    api(anna).get(f'{BASE}expenses/?trip={trip.pk}')
    legacy.refresh_from_db()
    assert (legacy.amount_trip, legacy.amount_home, legacy.rate_date) == (Decimal('5000.00'), None, None)


def test_expense_list_also_backfills(anna):
    client = api(anna)
    trip = japan(anna)
    client.post(f'{BASE}expenses/', {'trip': trip.pk, 'title': 'Taxi', 'amount': '10', 'currency': 'USD', 'date': '2027-05-02'}, format='json')
    rates()
    listed = client.get(f'{BASE}expenses/?trip={trip.pk}').data
    assert listed[0]['amount_trip'] == '1586.36'  # 10 × 174,5 / 1,10
