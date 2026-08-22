"""Regressionstests für die Login/Registrierungs-Checkliste aus
ARCHITEKTUR.md §3.1/§3.6 — siehe auch core/test_exception_handler.py für
den DEBUG=False-Fall."""

import pytest
from django.contrib.auth import get_user_model
from django.test import Client

pytestmark = pytest.mark.django_db


def test_register_rejects_short_password():
    response = Client().post(
        '/api/auth/register/',
        {'email': 'kurz@example.com', 'password': 'kurz1'},
        content_type='application/json',
    )
    assert response.status_code == 400
    assert 'password' in response.json()


def test_register_rejects_password_without_digit():
    response = Client().post(
        '/api/auth/register/',
        {'email': 'nodigit@example.com', 'password': 'nurbuchstaben'},
        content_type='application/json',
    )
    assert response.status_code == 400
    assert 'password' in response.json()


def test_register_accepts_valid_password_and_hashes_with_argon2():
    response = Client().post(
        '/api/auth/register/',
        {'email': 'valide@example.com', 'password': 'Sicher123!x', 'name': 'Valide'},
        content_type='application/json',
    )
    assert response.status_code == 201
    assert 'refresh' not in response.json()  # nie im Body, siehe test_login_* unten

    user = get_user_model().objects.get(email='valide@example.com')
    assert user.password.startswith('argon2$argon2id$')


def test_login_sets_httponly_refresh_cookie_never_in_body():
    Client().post(
        '/api/auth/register/',
        {'email': 'cookie@example.com', 'password': 'Sicher123!x'},
        content_type='application/json',
    )

    response = Client().post(
        '/api/auth/login/',
        {'email': 'cookie@example.com', 'password': 'Sicher123!x'},
        content_type='application/json',
    )

    assert response.status_code == 200
    body = response.json()
    assert list(body.keys()) == ['access']  # kein 'refresh' im Body

    cookie = response.cookies['refresh_token']
    assert cookie['httponly'] is True
    assert cookie['samesite'] == 'Strict'


def test_axes_locks_out_after_failure_limit(settings):
    Client().post(
        '/api/auth/register/',
        {'email': 'lockout@example.com', 'password': 'Sicher123!x'},
        content_type='application/json',
    )

    client = Client()
    for _ in range(settings.AXES_FAILURE_LIMIT):
        response = client.post(
            '/api/auth/login/',
            {'email': 'lockout@example.com', 'password': 'falsch'},
            content_type='application/json',
        )
        assert response.status_code == 401

    # Selbst mit dem KORREKTEN Passwort schlägt der nächste Versuch fehl,
    # weil Axes die IP/den Nutzernamen bereits gesperrt hat.
    response = client.post(
        '/api/auth/login/',
        {'email': 'lockout@example.com', 'password': 'Sicher123!x'},
        content_type='application/json',
    )
    assert response.status_code == 401


def test_password_reset_response_identical_regardless_of_account_existence():
    known = Client().post(
        '/api/auth/password-reset/',
        {'email': 'valide@example.com'},
        content_type='application/json',
    )
    unknown = Client().post(
        '/api/auth/password-reset/',
        {'email': 'gibt-es-nicht@example.com'},
        content_type='application/json',
    )

    assert known.status_code == unknown.status_code == 200
    assert known.json() == unknown.json()
