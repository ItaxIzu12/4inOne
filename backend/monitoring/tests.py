"""Monitoring: Anmelde-Ereignisse, Alarme an GlitchTip ohne Personendaten, Admin-Panel nur mit Staff + Zwei-Faktor,
Tunnel ohne offenen Proxy, Datenschutz-Filter. docs/MONITORING.md"""

import io
import json
from datetime import timedelta
from unittest import mock

import pytest
import sentry_sdk
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import Client
from django.utils import timezone
from django_otp.oath import TOTP
from django_otp.plugins.otp_totp.models import TOTPDevice
from rest_framework.test import APIClient

from core.exception_handlers import custom_exception_handler
from monitoring import views as monitoring_views
from monitoring.events import anonymize_ip
from monitoring.models import AuthEvent
from monitoring.sentry import scrub_event

pytestmark = pytest.mark.django_db
PASSWORD = 'Sicher-Wald-27x'
DSN = 'http://publickey@glitchtip.local:8001/1'


@pytest.fixture
def sent():
    """Fängt alles ab, was an GlitchTip ginge — mit demselben Datenschutz-Filter wie im Betrieb."""
    events = []

    def capture(event, hint):
        events.append(scrub_event(event, hint))
        return None  # nichts verlässt den Testlauf

    sentry_sdk.init(dsn=DSN, before_send=capture)
    yield events
    sentry_sdk.init(dsn='')


def make_user(email='sophie@example.com', name='Sophie', **extra):
    return get_user_model().objects.create_user(username=email, email=email, password=PASSWORD, first_name=name, **extra)


def login(email='sophie@example.com', password=PASSWORD, client=None, **extra):
    return (client or Client()).post('/api/v1/auth/login/', {'email': email, 'password': password, **extra},
                                     content_type='application/json')


def with_mfa(user):
    return TOTPDevice.objects.create(user=user, name='Telefon', confirmed=True)


def kinds():
    return list(AuthEvent.objects.order_by('id').values_list('kind', flat=True))


# --------------------------------------------------------------------------- Ereignisse


def test_successful_login_is_recorded_without_alert(sent):
    make_user()
    assert login().status_code == 200
    event = AuthEvent.objects.get()
    assert event.kind == 'login_succeeded' and event.user.email == 'sophie@example.com'
    assert event.ip_prefix == '127.0.0.0'  # gekürzt
    assert sent == []  # Erfolg ist kein Alarm


def test_wrong_password_is_recorded_and_alerted_without_personal_data(sent):
    make_user()
    assert login(password='falsch').status_code == 401
    assert kinds() == ['login_failed'] and AuthEvent.objects.get().user is not None
    assert len(sent) == 1
    alarm = sent[0]
    assert alarm['level'] == 'warning' and 'Anmeldung fehlgeschlagen' in json.dumps(alarm, ensure_ascii=False)
    assert alarm['tags']['auth_event'] == 'login_failed' and alarm['tags']['bekanntes_konto'] == 'ja'
    assert alarm['fingerprint'] == ['auth-event', 'login_failed']
    text = json.dumps(alarm, ensure_ascii=False)
    for secret in ('sophie@example.com', 'falsch', '127.0.0.1', PASSWORD):
        assert secret not in text, secret
    assert 'user' not in alarm


def test_unknown_account_is_counted_but_the_typed_address_is_never_stored(sent):
    assert login(email='tippfehler@example.com').status_code == 401
    event = AuthEvent.objects.get()
    assert event.kind == 'login_failed' and event.user is None
    assert sent[0]['tags']['bekanntes_konto'] == 'nein'
    assert 'tippfehler' not in json.dumps(sent[0])


def test_lockout_after_too_many_attempts_raises_an_error_alarm(sent, settings):
    make_user()
    client = Client()
    for _ in range(settings.AXES_FAILURE_LIMIT):
        login(password='falsch', client=client)
    assert 'locked_out' in kinds()
    levels = {e['tags']['auth_event']: e['level'] for e in sent}
    assert levels['locked_out'] == 'error'


def test_wrong_two_factor_code_is_recorded_and_alerted(sent):
    with_mfa(make_user())
    assert login(mfa_code='000000').status_code == 401
    assert kinds()[-1] == 'mfa_failed'
    assert sent[-1]['tags']['auth_event'] == 'mfa_failed'


def test_registration_and_password_reset_are_recorded():
    Client().post('/api/v1/auth/register/', {'name': 'Lena', 'email': 'lena@example.com', 'password': PASSWORD,
                                             'confirm_password': PASSWORD, 'accept_privacy': True}, content_type='application/json')
    Client().post('/api/v1/auth/password-reset/request/', {'email': 'lena@example.com'}, content_type='application/json')
    Client().post('/api/v1/auth/password-reset/request/', {'email': 'niemand@example.com'}, content_type='application/json')
    assert kinds() == ['registered', 'password_reset_requested']  # unbekannte Adresse: kein Eintrag


def test_ip_addresses_are_shortened():
    assert anonymize_ip('203.0.113.77') == '203.0.113.0'
    assert anonymize_ip('2001:db8:abcd:12:1:2:3:4') == '2001:db8:abcd::'
    assert anonymize_ip('kein-ip') == ''


def test_deleting_an_account_keeps_the_event_without_personal_reference():
    user = make_user()
    login()
    user.delete()
    assert AuthEvent.objects.get().user is None


# --------------------------------------------------------------------------- Admin-Panel


def admin_client(user):
    """Nur mit Zugang, aber ohne angemeldete Sitzung (force_authenticate) — reicht fürs Admin-Panel bewusst NICHT."""
    client = APIClient()
    client.force_authenticate(user)
    return client


def mfa_login(user):
    """Echte Anmeldung mit Passwort UND aktuellem TOTP-Code → Sitzung mit mfa_verified=True."""
    device = TOTPDevice.objects.filter(user=user, confirmed=True).first() or with_mfa(user)
    code = TOTP(device.bin_key, device.step, device.t0, device.digits, device.drift).token()
    response = login(user.email, mfa_code=f'{code:0{device.digits}d}')
    assert response.status_code == 200, response.content
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.json()['access']}")
    return client


def staff_admin():
    admin = make_user('admin@example.com', 'Ada', is_staff=True)
    return admin, mfa_login(admin)


@pytest.mark.parametrize('path', ['/api/v1/admin/overview/', '/api/v1/admin/events/', '/api/v1/admin/errors/'])
def test_admin_endpoints_need_staff_and_a_two_factor_session(path):
    assert APIClient().get(path).status_code == 401
    normal = make_user('max@example.com', 'Max')
    assert admin_client(normal).get(path).status_code == 403
    staff = make_user('admin@example.com', 'Ada', is_staff=True)
    response = admin_client(staff).get(path)
    assert response.status_code == 403 and response.data['code'] == 'mfa_required'
    # Sitzung von VOR dem Einschalten der Zwei-Faktor-Anmeldung: Konto hat jetzt MFA, diese Sitzung aber nicht
    old_session = APIClient()
    old_session.credentials(HTTP_AUTHORIZATION=f"Bearer {login('admin@example.com').json()['access']}")
    with_mfa(staff)
    response = old_session.get(path)
    assert response.status_code == 403 and response.data['code'] == 'mfa_session'
    assert admin_client(staff).get(path).data['code'] == 'mfa_session'  # ohne Sitzung ebenso
    client = mfa_login(staff)
    assert client.get(path).status_code == 200
    staff.is_active = False
    staff.save()
    assert client.get(path).status_code in (401, 403)


def test_overview_counts_and_events_list_with_masked_addresses():
    make_user()
    login()
    login(password='falsch')
    login(email='unbekannt@example.com')
    _, client = staff_admin()

    overview = client.get('/api/v1/admin/overview/').data
    # Sophie und die Anmeldung der Admin selbst
    assert overview['events_24h']['login_succeeded'] == 2 and overview['events_24h']['login_failed'] == 2
    assert overview['accounts']['total'] == 2 and overview['accounts']['active_7d'] == 2
    assert overview['monitoring']['connected'] is False

    events = client.get('/api/v1/admin/events/').data
    body = json.dumps(events, ensure_ascii=False)
    assert 'sophie@example.com' not in body and 's•••@example.com' in body  # nur maskiert
    assert 'unbekannt' not in body
    failed = client.get('/api/v1/admin/events/?kind=login_failed').data['results']
    assert {e['kind'] for e in failed} == {'login_failed'} and len(failed) == 2
    assert client.get('/api/v1/admin/events/?kind=quatsch').status_code == 400


def test_events_are_paginated():
    _, client = staff_admin()
    AuthEvent.objects.bulk_create([AuthEvent(kind='login_failed') for _ in range(50)])  # + 1 Anmeldung der Admin
    first = client.get('/api/v1/admin/events/').data
    assert len(first['results']) == 50 and first['has_more'] is True
    second = client.get('/api/v1/admin/events/?page=2').data
    assert len(second['results']) == 1 and second['has_more'] is False


def test_errors_from_glitchtip(settings):
    _, client = staff_admin()
    assert client.get('/api/v1/admin/errors/').data == {'available': False, 'reason': 'not_configured', 'issues': []}

    settings.GLITCHTIP_URL, settings.GLITCHTIP_ORG, settings.GLITCHTIP_API_TOKEN = 'http://localhost:8001', '4inone', 'tok'
    answer = mock.MagicMock()
    answer.__enter__.return_value.read.return_value = json.dumps([
        {'id': '7', 'title': 'ZeroDivisionError', 'culprit': 'finanzen.views', 'level': 'error', 'count': '3', 'lastSeen': '2026-11-15T10:00:00Z'},
    ]).encode()
    with mock.patch.object(monitoring_views.urllib.request, 'urlopen', return_value=answer) as urlopen:
        data = client.get('/api/v1/admin/errors/').data
    request = urlopen.call_args[0][0]
    assert request.full_url == 'http://localhost:8001/api/0/organizations/4inone/issues/?query=is:unresolved&limit=10'
    assert request.get_header('Authorization') == 'Bearer tok'
    assert data['available'] is True and data['issues'][0]['count'] == 3
    assert data['issues'][0]['link'] == 'http://localhost:8001/4inone/issues/7'

    with mock.patch.object(monitoring_views.urllib.request, 'urlopen', side_effect=OSError):
        assert client.get('/api/v1/admin/errors/').data['reason'] == 'unreachable'


def test_me_says_whether_the_admin_menu_is_shown():
    make_user()
    token = login().json()['access']
    assert Client().get('/api/v1/auth/me/', HTTP_AUTHORIZATION=f'Bearer {token}').json()['is_admin'] is False


def test_admin_rights_only_via_command_and_never_via_profile():
    user = make_user()
    client = admin_client(user)
    client.patch('/api/v1/auth/me/', {'name': 'Sophie', 'is_staff': True, 'is_admin': True}, format='json')
    user.refresh_from_db()
    assert user.is_staff is False
    out = io.StringIO()
    call_command('monitoring_admin', 'SOPHIE@example.com', stdout=out)
    user.refresh_from_db()
    assert user.is_staff is True and 'Zwei-Faktor' in out.getvalue()
    call_command('monitoring_admin', 'sophie@example.com', '--remove', stdout=io.StringIO())
    user.refresh_from_db()
    assert user.is_staff is False


def test_old_events_are_pruned(settings):
    settings.AUTH_EVENT_RETENTION_DAYS = 90
    old = AuthEvent.objects.create(kind='login_failed')
    AuthEvent.objects.filter(pk=old.pk).update(created_at=timezone.now() - timedelta(days=91))
    AuthEvent.objects.create(kind='login_failed')
    call_command('prune_auth_events', stdout=io.StringIO())
    assert AuthEvent.objects.count() == 1


# --------------------------------------------------------------------------- Tunnel und Konfiguration


def envelope(dsn=DSN, size=0):
    return (json.dumps({'dsn': dsn, 'event_id': 'a' * 32}) + '\n{"type":"event"}\n{"message":"x"}' + 'x' * size).encode()


def post_tunnel(body):
    return Client().post('/api/v1/monitoring/tunnel/', body, content_type='text/plain;charset=UTF-8')


def test_config_says_off_without_dsn_and_on_with_dsn(settings):
    assert Client().get('/api/v1/monitoring/config/').json()['enabled'] is False
    settings.SENTRY_DSN = DSN
    assert Client().get('/api/v1/monitoring/config/').json() == {'enabled': True, 'dsn': DSN, 'environment': settings.SENTRY_ENVIRONMENT}


def test_tunnel_forwards_only_to_the_configured_project(settings):
    assert post_tunnel(envelope()).status_code == 204  # ohne DSN: still nichts
    settings.SENTRY_DSN = DSN
    answer = mock.MagicMock()
    answer.__enter__.return_value.status = 200
    with mock.patch.object(monitoring_views.urllib.request, 'urlopen', return_value=answer) as urlopen:
        assert post_tunnel(envelope()).status_code == 200
        assert urlopen.call_args[0][0].full_url == 'http://glitchtip.local:8001/api/1/envelope/'
        # fremde Ziele: kein offener Proxy
        for bad in ('http://publickey@boese.example:8001/1', 'http://publickey@glitchtip.local:8001/2',
                    'http://andererschluessel@glitchtip.local:8001/1', 'http://publickey@glitchtip.local:9999/1',
                    'https://publickey@glitchtip.local:8001/1'):
            assert post_tunnel(envelope(bad)).status_code == 400, bad
        assert post_tunnel(b'kein json\n{}').status_code == 400
        assert post_tunnel(envelope(size=600 * 1024)).status_code == 413
    assert urlopen.call_count == 1


def test_tunnel_is_rate_limited(settings, monkeypatch):
    settings.SENTRY_DSN = DSN
    monkeypatch.setattr(monitoring_views.TunnelRateThrottle, 'rate', '2/min', raising=False)
    answer = mock.MagicMock()
    answer.__enter__.return_value.status = 200
    with mock.patch.object(monitoring_views.urllib.request, 'urlopen', return_value=answer):
        assert [post_tunnel(envelope()).status_code for _ in range(3)] == [200, 200, 429]


# --------------------------------------------------------------------------- Datenschutz-Filter und Fehler


def test_scrub_removes_everything_personal():
    event = {
        'request': {'url': 'https://4inone.de/api/v1/x/?token=abc', 'data': {'password': 'x'}, 'cookies': {'refresh_token': 'y'},
                    'query_string': 'token=abc', 'env': {'REMOTE_ADDR': '1.2.3.4'},
                    'headers': {'Authorization': 'Bearer z', 'Cookie': 'a=b', 'User-Agent': 'Safari', 'X-Forwarded-For': '1.2.3.4'}},
        'user': {'email': 'sophie@example.com', 'ip_address': '1.2.3.4'},
        'server_name': 'mein-server',
        'message': 'Fehler bei sophie@example.com',
        'exception': {'values': [{'value': 'kein Konto anna@example.org', 'stacktrace': {'frames': [{'vars': {'password': 'x'}}]}}]},
        'breadcrumbs': {'values': [{'message': 'Login max@example.com', 'data': {'body': 'geheim'}}]},
    }
    clean = scrub_event(event)
    text = json.dumps(clean, ensure_ascii=False)
    for secret in ('abc', 'password', 'refresh_token', 'Bearer', 'a=b', '1.2.3.4', 'sophie@', 'anna@', 'max@', 'mein-server', 'geheim'):
        assert secret not in text, secret
    assert clean['request']['url'] == 'https://4inone.de/api/v1/x/'
    assert clean['request']['headers'] == {'User-Agent': 'Safari'}


def test_unhandled_server_errors_reach_glitchtip(sent, settings):
    settings.DEBUG = False
    try:
        raise ZeroDivisionError('Rechenfehler')
    except ZeroDivisionError as exc:
        response = custom_exception_handler(exc, {'view': 'FinanzView'})
    assert response.status_code == 500
    assert any(v['type'] == 'ZeroDivisionError' for e in sent for v in (e.get('exception') or {}).get('values', []))
