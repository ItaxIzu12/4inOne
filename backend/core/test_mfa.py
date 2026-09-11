"""Tests für die TOTP-basierte Zwei-Faktor-Authentifizierung
(core/mfa_views.py) — Einrichtung, Aktivierung, Backup-Codes und die
Verzahnung mit dem Login-Endpunkt (core/auth_views.py)."""

import time

import pyotp
import pytest
from django.contrib.auth import get_user_model
from django_otp.plugins.otp_totp.models import TOTPDevice
from rest_framework.test import APIClient

from core.mfa_views import BACKUP_CODE_COUNT
from core.models import MfaBackupCode

pytestmark = pytest.mark.django_db


def _register_and_login(client: APIClient, email='mfa@example.com', password='Sicher123!x'):
    client.post('/api/v1/auth/register/', {'email': email, 'password': password}, format='json')
    user = get_user_model().objects.get(email=email)
    client.force_authenticate(user=user)
    return user


def test_mfa_setup_returns_secret_and_qr_code_without_activating():
    client = APIClient()
    user = _register_and_login(client)

    response = client.post('/api/v1/auth/mfa/setup/')

    assert response.status_code == 200
    assert response.data['secret']
    assert response.data['qr_code'].startswith('data:image/png;base64,')
    assert response.data['otpauth_url'].startswith('otpauth://totp/')
    # Noch nicht aktiv, bevor der erste Code bestätigt wurde.
    assert not TOTPDevice.objects.filter(user=user, confirmed=True).exists()


def test_mfa_verify_activates_device_and_returns_backup_codes_once():
    client = APIClient()
    user = _register_and_login(client)
    setup = client.post('/api/v1/auth/mfa/setup/')
    totp = pyotp.TOTP(setup.data['secret'])

    response = client.post('/api/v1/auth/mfa/verify/', {'code': totp.now()}, format='json')

    assert response.status_code == 200
    assert len(response.data['backup_codes']) == BACKUP_CODE_COUNT
    assert TOTPDevice.objects.filter(user=user, confirmed=True).exists()
    # Codes liegen in der DB nur gehasht — nicht im Klartext identisch mit
    # den zurückgegebenen Codes.
    stored = list(MfaBackupCode.objects.filter(user=user).values_list('code_hash', flat=True))
    assert all(code not in stored for code in response.data['backup_codes'])


def test_mfa_verify_rejects_wrong_code():
    client = APIClient()
    _register_and_login(client)
    client.post('/api/v1/auth/mfa/setup/')

    response = client.post('/api/v1/auth/mfa/verify/', {'code': '000000'}, format='json')

    assert response.status_code == 400


def test_mfa_verify_endpoint_has_its_own_stricter_rate_limit(settings):
    client = APIClient()
    _register_and_login(client)
    client.post('/api/v1/auth/mfa/setup/')
    limit = int(settings.REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']['mfa_verify'].split('/')[0])

    for _ in range(limit):
        response = client.post('/api/v1/auth/mfa/verify/', {'code': '000000'}, format='json')
        assert response.status_code == 400

    response = client.post('/api/v1/auth/mfa/verify/', {'code': '000000'}, format='json')
    assert response.status_code == 429


def test_login_requires_mfa_code_when_enabled_for_user():
    setup_client = APIClient()
    email, password = 'twofactor@example.com', 'Sicher123!x'
    _register_and_login(setup_client, email, password)
    setup = setup_client.post('/api/v1/auth/mfa/setup/')
    totp = pyotp.TOTP(setup.data['secret'])
    # Bewusst ein Code aus dem VORHERIGEN 30-Sekunden-Zeitfenster für die
    # Aktivierung: würde hier derselbe Code wie unten bei totp.now() für den
    # Login benutzt (falls beides ins selbe Zeitfenster fällt), würde
    # TOTPDevice.verify_token() ihn als Replay ablehnen (last_t erlaubt nur
    # noch höhere Zeitschritte) — im echten Betrieb liegen Einrichtung und
    # späterer Login ohnehin nie im selben 30-Sekunden-Fenster.
    setup_client.post('/api/v1/auth/mfa/verify/', {'code': totp.at(time.time() - 30)}, format='json')

    login_client = APIClient()

    # Ohne Code: korrekte Zugangsdaten, aber KEINE Tokens.
    without_code = login_client.post('/api/v1/auth/login/', {'email': email, 'password': password}, format='json')
    assert without_code.status_code == 200
    assert without_code.data == {'mfa_required': True}

    # Mit korrektem TOTP-Code: Tokens werden ausgestellt.
    with_code = login_client.post(
        '/api/v1/auth/login/', {'email': email, 'password': password, 'mfa_code': totp.now()}, format='json'
    )
    assert with_code.status_code == 200
    assert 'access' in with_code.data


def test_login_accepts_unused_backup_code_exactly_once():
    setup_client = APIClient()
    email, password = 'backupcode@example.com', 'Sicher123!x'
    _register_and_login(setup_client, email, password)
    setup = setup_client.post('/api/v1/auth/mfa/setup/')
    totp = pyotp.TOTP(setup.data['secret'])
    verify = setup_client.post('/api/v1/auth/mfa/verify/', {'code': totp.now()}, format='json')
    backup_code = verify.data['backup_codes'][0]

    login_client = APIClient()
    first = login_client.post(
        '/api/v1/auth/login/', {'email': email, 'password': password, 'mfa_code': backup_code}, format='json'
    )
    assert first.status_code == 200

    second = login_client.post(
        '/api/v1/auth/login/', {'email': email, 'password': password, 'mfa_code': backup_code}, format='json'
    )
    assert second.status_code == 401


def test_login_without_mfa_enabled_is_unaffected():
    client = APIClient()
    client.post('/api/v1/auth/register/', {'email': 'nomfa@example.com', 'password': 'Sicher123!x'}, format='json')

    response = client.post(
        '/api/v1/auth/login/', {'email': 'nomfa@example.com', 'password': 'Sicher123!x'}, format='json'
    )

    assert response.status_code == 200
    assert 'access' in response.data
