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


# --------------------------------------------------------------------------- Screenshot, PDF, Schlüsselwechsel


def _png_qr(message):
    import qrcode

    buf = io.BytesIO()
    qrcode.make(message).get_image().convert('RGB').save(buf, 'PNG')
    buf.seek(0)
    buf.name = 'bordkarte.png'
    return buf


def _pdf_with(drawing_code: str, message: str):
    """Einseitiges PDF mit dem Code in der Mitte (wie eine ausgedruckte Bordkarte)."""
    from reportlab.graphics import renderPDF
    from reportlab.graphics.barcode import createBarcodeDrawing
    from reportlab.lib.units import mm
    from reportlab.pdfgen import canvas

    buf = io.BytesIO()
    pdf = canvas.Canvas(buf)
    pdf.drawString(30 * mm, 270 * mm, 'Bordkarte – Beispiel-Airline XY 1234')
    kwargs = {'barWidth': 0.5 * mm, 'barHeight': 20 * mm, 'humanReadable': False} if drawing_code == 'Code128' else {'width': 60 * mm, 'height': 60 * mm}
    renderPDF.draw(createBarcodeDrawing(drawing_code, value=message, **kwargs), pdf, 30 * mm, 150 * mm)
    pdf.showPage()
    pdf.save()
    buf.seek(0)
    buf.name = 'bordkarte.pdf'
    return buf


def test_screenshot_is_read_on_the_server_when_the_browser_cannot():
    anna = _user('anna')
    trip = Trip.objects.create(owner=anna, title='Lissabon', start_date=date(2026, 12, 4), end_date=date(2026, 12, 6))
    r = _client(anna).post(URL, {'trip': trip.pk, 'file': _png_qr(bcbp())}, format='multipart')
    assert r.status_code == 201, r.data
    assert (r.data['format'], r.data['message'], r.data['seat'], r.data['source']) == ('QR', bcbp(), '14C', 'image')


def test_pdf_boarding_passes_qr_and_code128():
    anna = _user('anna')
    trip = Trip.objects.create(owner=anna, title='Lissabon', start_date=date(2026, 12, 4), end_date=date(2026, 12, 6))
    r = _client(anna).post(URL, {'trip': trip.pk, 'file': _pdf_with('QR', bcbp())}, format='multipart')
    assert r.status_code == 201, r.data
    assert r.data['message'] == bcbp() and r.data['to_code'] == 'LIS'
    r = _client(anna).post(URL, {'trip': trip.pk, 'file': _pdf_with('Code128', 'ZUG-4711-WAGEN-7')}, format='multipart')
    assert r.status_code == 201, r.data
    assert (r.data['format'], r.data['message']) == ('CODE128', 'ZUG-4711-WAGEN-7')


def test_unreadable_images_and_pdfs_get_a_clear_message():
    from PIL import Image

    anna = _user('anna')
    trip = Trip.objects.create(owner=anna, title='Lissabon', start_date=date(2026, 12, 4), end_date=date(2026, 12, 6))
    blank = io.BytesIO()
    Image.new('RGB', (400, 300), 'white').save(blank, 'PNG')
    blank.seek(0); blank.name = 'leer.png'
    r = _client(anna).post(URL, {'trip': trip.pk, 'file': blank}, format='multipart')
    assert r.status_code == 400 and 'kein Code' in r.data['detail']
    broken = io.BytesIO(b'%PDF-1.7 kaputt'); broken.name = 'x.pdf'
    r = _client(anna).post(URL, {'trip': trip.pk, 'file': broken}, format='multipart')
    assert r.status_code == 400 and 'PDF' in r.data['detail']
    junk = io.BytesIO(b'\x00\x01nichts'); junk.name = 'x.png'
    r = _client(anna).post(URL, {'trip': trip.pk, 'file': junk}, format='multipart')
    assert r.status_code == 400 and 'Bild' in r.data['detail']
    assert BoardingPass.objects.count() == 0


def test_huge_images_are_refused_before_decoding(monkeypatch):
    from PIL import Image

    monkeypatch.setattr(boarding, 'MAX_SCAN_PIXELS', 1000)
    buf = io.BytesIO()
    Image.new('RGB', (100, 100), 'white').save(buf, 'PNG')
    with pytest.raises(boarding.BoardingPassError, match='zu groß'):
        boarding.read_code(buf.getvalue())


def test_key_rotation_keeps_stored_passes_readable(settings):
    settings.BOARDING_PASS_KEYS = []
    settings.SECRET_KEY = 'alter-schluessel-' + 'x' * 40
    token = boarding.encrypt('CODE')
    # SECRET_KEY gewechselt, der alte steht als Fallback: lesbar
    settings.SECRET_KEY, settings.SECRET_KEY_FALLBACKS = 'neuer-schluessel-' + 'y' * 40, ['alter-schluessel-' + 'x' * 40]
    assert boarding.decrypt(token) == 'CODE'
    # Eigener Bordkarten-Schlüssel: neue Karten damit, alte bleiben über den SECRET_KEY lesbar
    settings.BOARDING_PASS_KEYS = ['bordkarten-schluessel-1']
    newer = boarding.encrypt('NEU')
    assert boarding.decrypt(token) == 'CODE' and boarding.decrypt(newer) == 'NEU'
    # …und überlebt danach jeden SECRET_KEY-Wechsel
    settings.SECRET_KEY, settings.SECRET_KEY_FALLBACKS = 'ganz-neu-' + 'z' * 40, []
    assert boarding.decrypt(newer) == 'NEU' and boarding.decrypt(token) is None
