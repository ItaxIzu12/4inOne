"""Regressionstests für die Login/Registrierungs-Checkliste aus
ARCHITEKTUR.md §3.1/§3.6 — siehe auch core/test_exception_handler.py für
den DEBUG=False-Fall."""

from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import get_hasher
from django.test import Client
from django.utils import timezone
from rest_framework.parsers import JSONParser
from rest_framework.request import Request
from rest_framework.test import APIRequestFactory

from core.auth_views import LoginRateThrottle
from core.models import HouseholdMembership, PasswordResetToken

pytestmark = pytest.mark.django_db


def test_register_rejects_short_password():
    response = Client().post(
        '/api/v1/auth/register/',
        {'confirm_password': 'kurz1', 'accept_privacy': True, 'name': 'Test', 'email': 'kurz@example.com', 'password': 'kurz1'},
        content_type='application/json',
    )
    assert response.status_code == 400
    assert 'password' in response.json()


def test_register_rejects_password_without_digit():
    response = Client().post(
        '/api/v1/auth/register/',
        {'confirm_password': 'nurbuchstaben', 'accept_privacy': True, 'name': 'Test', 'email': 'nodigit@example.com', 'password': 'nurbuchstaben'},
        content_type='application/json',
    )
    assert response.status_code == 400
    assert 'password' in response.json()


def test_register_accepts_valid_password_and_hashes_with_configured_hasher():
    response = Client().post(
        '/api/v1/auth/register/',
        {'confirm_password': 'Sicher123!x', 'accept_privacy': True, 'email': 'valide@example.com', 'password': 'Sicher123!x', 'name': 'Valide'},
        content_type='application/json',
    )
    assert response.status_code == 201
    body = response.json()
    assert 'refresh' not in body  # nie im Body, siehe test_login_* unten
    assert body['user'] == {'name': 'Valide', 'email': 'valide@example.com'}

    # Prüft gegen PASSWORD_HASHERS[0] statt fest gegen "argon2" — aktuell
    # (siehe settings.py-TODO) steht dort vorübergehend PBKDF2 statt Argon2,
    # wegen einer Windows-Anwendungssteuerungsrichtlinie, die die native
    # argon2-cffi-DLL blockiert. Der Test bleibt so korrekt, sobald wieder
    # auf Argon2 zurückgestellt wird, ohne erneut angepasst werden zu müssen.
    user = get_user_model().objects.get(email='valide@example.com')
    expected_prefix = get_hasher().algorithm
    assert user.password.startswith(expected_prefix)


def test_login_sets_httponly_refresh_cookie_never_in_body():
    Client().post(
        '/api/v1/auth/register/',
        {'confirm_password': 'Sicher123!x', 'accept_privacy': True, 'name': 'Test', 'email': 'cookie@example.com', 'password': 'Sicher123!x'},
        content_type='application/json',
    )

    response = Client().post(
        '/api/v1/auth/login/',
        {'email': 'cookie@example.com', 'password': 'Sicher123!x'},
        content_type='application/json',
    )

    assert response.status_code == 200
    body = response.json()
    assert set(body.keys()) == {'access', 'user'}  # kein 'refresh' im Body
    assert body['user'] == {'name': 'Test', 'email': 'cookie@example.com'}

    cookie = response.cookies['refresh_token']
    assert cookie['httponly'] is True
    assert cookie['samesite'] == 'Strict'


def test_axes_locks_out_after_failure_limit(settings):
    Client().post(
        '/api/v1/auth/register/',
        {'confirm_password': 'Sicher123!x', 'accept_privacy': True, 'name': 'Test', 'email': 'lockout@example.com', 'password': 'Sicher123!x'},
        content_type='application/json',
    )

    client = Client()
    for _ in range(settings.AXES_FAILURE_LIMIT):
        response = client.post(
            '/api/v1/auth/login/',
            {'email': 'lockout@example.com', 'password': 'falsch'},
            content_type='application/json',
        )
        assert response.status_code == 401

    # Selbst mit dem KORREKTEN Passwort schlägt der nächste Versuch fehl —
    # entweder weil Axes die IP/den Nutzernamen bereits gesperrt hat (401)
    # oder weil an genau dieser Grenze zuerst LoginRateThrottle greift (429,
    # AXES_FAILURE_LIMIT und die 5/min-Rate sind identisch groß, und DRF
    # prüft Throttles VOR dem eigentlichen Login-Handler) — beides beweist,
    # dass der Zugriff blockiert bleibt, nur der auslösende Mechanismus
    # unterscheidet sich je nach exakter Reihenfolge.
    response = client.post(
        '/api/v1/auth/login/',
        {'email': 'lockout@example.com', 'password': 'Sicher123!x'},
        content_type='application/json',
    )
    assert response.status_code in (401, 429)


def test_password_reset_response_identical_regardless_of_account_existence():
    known = Client().post(
        '/api/v1/auth/password-reset/request/',
        {'email': 'valide@example.com'},
        content_type='application/json',
    )
    unknown = Client().post(
        '/api/v1/auth/password-reset/request/',
        {'email': 'gibt-es-nicht@example.com'},
        content_type='application/json',
    )

    assert known.status_code == unknown.status_code == 200
    assert known.json() == unknown.json()


def test_register_creates_household_with_registering_user_as_admin():
    response = Client().post(
        '/api/v1/auth/register/',
        {'confirm_password': 'Sicher123!x', 'accept_privacy': True, 'email': 'admin@example.com', 'password': 'Sicher123!x', 'name': 'Rita'},
        content_type='application/json',
    )
    assert response.status_code == 201

    user = get_user_model().objects.get(email='admin@example.com')
    membership = HouseholdMembership.objects.get(user=user)
    assert membership.role == HouseholdMembership.Role.ADMIN
    assert membership.household.name == 'Haushalt von Rita'


def test_register_without_household_name_uses_fallback():
    response = Client().post(
        '/api/v1/auth/register/',
        {'confirm_password': 'Sicher123!x', 'accept_privacy': True, 'email': 'no-household-name@example.com', 'password': 'Sicher123!x', 'name': 'Mira'},
        content_type='application/json',
    )
    assert response.status_code == 201

    user = get_user_model().objects.get(email='no-household-name@example.com')
    membership = HouseholdMembership.objects.get(user=user)
    assert membership.household.name == 'Haushalt von Mira'


def test_register_with_household_name_uses_it_verbatim():
    response = Client().post(
        '/api/v1/auth/register/',
        {'confirm_password': 'Sicher123!x', 'accept_privacy': True,
            'email': 'own-household-name@example.com',
            'password': 'Sicher123!x',
            'name': 'Mira',
            'household_name': 'Zuhause',
        },
        content_type='application/json',
    )
    assert response.status_code == 201

    user = get_user_model().objects.get(email='own-household-name@example.com')
    membership = HouseholdMembership.objects.get(user=user)
    assert membership.household.name == 'Zuhause'


def test_register_with_blank_household_name_falls_back_too():
    """Ein Leerstring (z. B. ein Formularfeld, das angefasst aber nicht
    ausgefüllt wurde) muss wie 'gar nicht angegeben' behandelt werden, nicht
    als Haushaltsname '' gespeichert werden."""
    response = Client().post(
        '/api/v1/auth/register/',
        {'confirm_password': 'Sicher123!x', 'accept_privacy': True,
            'email': 'blank-household-name@example.com',
            'password': 'Sicher123!x',
            'name': 'Mira',
            'household_name': '   ',
        },
        content_type='application/json',
    )
    assert response.status_code == 201

    user = get_user_model().objects.get(email='blank-household-name@example.com')
    membership = HouseholdMembership.objects.get(user=user)
    assert membership.household.name == 'Haushalt von Mira'


def test_register_rate_limit_blocks_after_configured_attempts(settings):
    client = Client()
    limit = int(settings.REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']['register'].split('/')[0])

    for i in range(limit):
        response = client.post(
            '/api/v1/auth/register/',
            {'confirm_password': 'Sicher123!x', 'accept_privacy': True, 'name': 'Test', 'email': f'rate{i}@example.com', 'password': 'Sicher123!x'},
            content_type='application/json',
        )
        assert response.status_code == 201

    response = client.post(
        '/api/v1/auth/register/',
        {'confirm_password': 'Sicher123!x', 'accept_privacy': True, 'name': 'Test', 'email': 'rate-over-limit@example.com', 'password': 'Sicher123!x'},
        content_type='application/json',
    )
    assert response.status_code == 429


def test_login_rate_limit_cache_key_is_scoped_by_email_not_only_ip():
    """Direkter Unit-Test des Cache-Keys (statt eines vollen HTTP-Integrations-
    tests): Ein Integrationstest über mehrere fehlgeschlagene Versuche gegen
    dieselbe IP wäre hier mit django-axes' EIGENEM, unabhängigem IP-basierten
    Lockout konfundiert (AXES_LOCKOUT_PARAMETERS enthält 'ip_address' als
    eigenständiges Kriterium, siehe settings.py — das sperrt bei genug
    Fehlversuchen JEDE E-Mail-Adresse von derselben IP, unabhängig von diesem
    Rate-Limit). Diese Prüfung isoliert daher nur die Throttle-Logik selbst."""
    factory = APIRequestFactory()
    throttle = LoginRateThrottle()

    request_a = Request(
        factory.post('/api/v1/auth/login/', {'email': 'scoped-a@example.com'}, format='json'),
        parsers=[JSONParser()],
    )
    request_b = Request(
        factory.post('/api/v1/auth/login/', {'email': 'scoped-b@example.com'}, format='json'),
        parsers=[JSONParser()],
    )

    key_a = throttle.get_cache_key(request_a, view=None)
    key_b = throttle.get_cache_key(request_b, view=None)

    assert key_a != key_b
    assert 'scoped-a@example.com' in key_a
    assert 'scoped-b@example.com' in key_b


def test_password_reset_confirm_changes_password_and_token_is_single_use():
    Client().post(
        '/api/v1/auth/register/',
        {'confirm_password': 'Altes12Passwort', 'accept_privacy': True, 'name': 'Test', 'email': 'reset-me@example.com', 'password': 'Altes12Passwort'},
        content_type='application/json',
    )
    user = get_user_model().objects.get(email='reset-me@example.com')
    token = PasswordResetToken.objects.create(
        user=user,
        token='test-token-12345',
        expires_at=timezone.now() + timedelta(minutes=30),
    )

    response = Client().post(
        '/api/v1/auth/password-reset/confirm/',
        {'token': token.token, 'password': 'NeuesPasswort9'},
        content_type='application/json',
    )
    assert response.status_code == 200

    login = Client().post(
        '/api/v1/auth/login/',
        {'email': 'reset-me@example.com', 'password': 'NeuesPasswort9'},
        content_type='application/json',
    )
    assert login.status_code == 200

    reused = Client().post(
        '/api/v1/auth/password-reset/confirm/',
        {'token': token.token, 'password': 'NochEinPasswort9'},
        content_type='application/json',
    )
    assert reused.status_code == 400


def test_password_reset_confirm_rejects_expired_token():
    Client().post(
        '/api/v1/auth/register/',
        {'confirm_password': 'Altes12Passwort', 'accept_privacy': True, 'name': 'Test', 'email': 'expired@example.com', 'password': 'Altes12Passwort'},
        content_type='application/json',
    )
    user = get_user_model().objects.get(email='expired@example.com')
    token = PasswordResetToken.objects.create(
        user=user,
        token='expired-token-12345',
        expires_at=timezone.now() - timedelta(minutes=1),
    )

    response = Client().post(
        '/api/v1/auth/password-reset/confirm/',
        {'token': token.token, 'password': 'NeuesPasswort9'},
        content_type='application/json',
    )
    assert response.status_code == 400
