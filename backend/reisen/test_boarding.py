"""Bordkarte (Schritt 1): echter Code wird gelesen, verschlüsselt gespeichert und nur der eigenen Person gezeigt."""

import io
import json
import zipfile
from datetime import date, timedelta

import pytest
from django.contrib.auth import get_user_model
from django.core.cache import caches
from django.core.management import call_command
from django.utils import timezone
from rest_framework.test import APIClient

from reisen import boarding
from reisen.models import BoardingPass, Trip, TripParticipant

pytestmark = pytest.mark.django_db
URL = '/api/v1/reisen/boarding-passes/'


def bcbp(name='MUSTER/SOPHIE MS', pnr='K7X2PQ', frm='DUS', to='LIS', carrier='XY', flight='1234', day=338, seat='014C', seq='0067'):
    """Pflichtteil eines IATA-BCBP-Codes (60 Zeichen) mit erfundenen Beispieldaten."""
    code = f"M1{name:<20}E{pnr:<7}{frm}{to}{carrier:<3}{flight.zfill(4):<5}{day:03d}Y{seat:>4}{seq.zfill(5)}100"
    assert len(code) == 60
    return code


@pytest.fixture(autouse=True)
def _fresh_throttle():
    caches['throttle'].clear()


def _user(name):
    return get_user_model().objects.create_user(username=f'{name}@example.com', email=f'{name}@example.com', password='x')


def _client(user):
    c = APIClient()
    c.force_authenticate(user)
    return c


def pkpass(message, fmt='PKBarcodeFormatAztec'):
    payload = {
        'organizationName': 'Beispiel-Airline',
        'barcodes': [{'format': fmt, 'message': message, 'messageEncoding': 'iso-8859-1'}],
        'boardingPass': {
            'transitType': 'PKTransitTypeAir',
            'headerFields': [{'key': 'gate', 'label': 'GATE', 'value': 'B42'}],
            'primaryFields': [{'key': 'origin', 'label': 'Düsseldorf', 'value': 'DUS'}, {'key': 'destination', 'label': 'Lissabon', 'value': 'LIS'}],
            'secondaryFields': [{'key': 'boarding', 'label': 'Boarding', 'value': '06:30'}, {'key': 'departure', 'label': 'Abflug', 'value': '07:10'}],
            'auxiliaryFields': [{'key': 'group', 'label': 'Gruppe', 'value': '3'}],
        },
    }
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w') as z:
        z.writestr('pass.json', json.dumps(payload))
        z.writestr('icon.png', b'x')
    buf.seek(0)
    buf.name = 'bordkarte.pkpass'
    return buf


def test_bcbp_mandatory_fields_are_read():
    data = boarding.parse_bcbp(bcbp(), today=date(2026, 11, 22))
    assert data.passenger_name == 'Sophie Muster'
    assert (data.from_code, data.to_code, data.flight_number, data.seat, data.sequence, data.pnr) == ('DUS', 'LIS', 'XY 1234', '14C', '67', 'K7X2PQ')
    assert data.flight_date == date(2026, 12, 4)  # Tag 338
    assert boarding.parse_bcbp('kein Code') is None
    assert boarding.masked_pnr('K7X2PQ') == 'K7••••'


def test_year_is_chosen_close_to_today():
    assert boarding._julian_to_date(5, today=date(2026, 12, 28)) == date(2027, 1, 5)
    assert boarding._julian_to_date(360, today=date(2027, 1, 3)) == date(2026, 12, 26)


def test_pkpass_import_stores_the_code_encrypted_and_reads_the_fields():
    anna = _user('anna')
    trip = Trip.objects.create(owner=anna, title='Lissabon', start_date=date(2026, 12, 4), end_date=date(2026, 12, 6))
    r = _client(anna).post(URL, {'trip': trip.pk, 'file': pkpass(bcbp())}, format='multipart')
    assert r.status_code == 201, r.data
    assert r.data['format'] == 'AZTEC' and r.data['message'] == bcbp()
    assert (r.data['gate'], r.data['boarding_time'], r.data['departure_time'], r.data['group']) == ('B42', '06:30', '07:10', '3')
    assert (r.data['from_name'], r.data['to_name'], r.data['airline_name']) == ('Düsseldorf', 'Lissabon', 'Beispiel-Airline')
    assert r.data['pnr_hint'] == 'K7••••' and 'K7X2PQ' not in json.dumps({k: v for k, v in r.data.items() if k != 'message'})
    stored = BoardingPass.objects.get()
    assert 'K7X2PQ' not in stored.barcode_ciphertext and boarding.decrypt(stored.barcode_ciphertext) == bcbp()


def test_code_from_a_screenshot_and_validation():
    anna = _user('anna')
    trip = Trip.objects.create(owner=anna, title='Lissabon', start_date=date(2026, 12, 4), end_date=date(2026, 12, 6))
    r = _client(anna).post(URL, {'trip': trip.pk, 'format': 'QR', 'message': bcbp()}, format='json')
    assert r.status_code == 201 and r.data['source'] == 'image' and r.data['seat'] == '14C'
    assert _client(anna).post(URL, {'trip': trip.pk, 'format': 'EAN', 'message': 'x'}, format='json').status_code == 400
    bad = io.BytesIO(b'nicht zip'); bad.name = 'x.pkpass'
    r = _client(anna).post(URL, {'trip': trip.pk, 'file': bad}, format='multipart')
    assert r.status_code == 400 and 'Wallet' in r.data['detail']


def test_only_the_owner_sees_and_deletes_even_on_a_shared_trip():
    anna, ben, eve = _user('anna'), _user('ben'), _user('eve')
    trip = Trip.objects.create(owner=anna, title='Lissabon', start_date=date(2026, 12, 4), end_date=date(2026, 12, 6))
    TripParticipant.objects.create(trip=trip, user=ben, role=TripParticipant.Role.EDITOR)
    pass_id = _client(anna).post(URL, {'trip': trip.pk, 'format': 'QR', 'message': bcbp()}, format='json').data['id']

    assert _client(ben).get(URL, {'trip': trip.pk}).data == []  # Mitreisender: sieht die Reise, aber nicht Annas Karte
    assert _client(eve).get(URL, {'trip': trip.pk}).status_code == 404  # Fremde: nicht einmal die Reise
    assert _client(eve).post(URL, {'trip': trip.pk, 'format': 'QR', 'message': bcbp()}, format='json').status_code == 404
    assert _client(ben).delete(f'{URL}{pass_id}/').status_code == 404
    assert _client(anna).delete(f'{URL}{pass_id}/').status_code == 204
    # Ben darf für sich selbst eine eigene Karte ablegen
    assert _client(ben).post(URL, {'trip': trip.pk, 'format': 'QR', 'message': bcbp(name='MUSTER/BEN')}, format='json').status_code == 201


def test_cleanup_removes_passes_after_the_trip():
    anna = _user('anna')
    today = timezone.localdate()
    old = Trip.objects.create(owner=anna, title='Alt', start_date=today - timedelta(days=10), end_date=today - timedelta(days=5))
    soon = Trip.objects.create(owner=anna, title='Bald', start_date=today + timedelta(days=3), end_date=today + timedelta(days=6))
    BoardingPass.objects.create(owner=anna, trip=old, barcode_format='QR', barcode_ciphertext=boarding.encrypt('x'))
    keep = BoardingPass.objects.create(owner=anna, trip=soon, barcode_format='QR', barcode_ciphertext=boarding.encrypt('y'))
    call_command('cleanup_expired')
    assert list(BoardingPass.objects.values_list('pk', flat=True)) == [keep.pk]
