"""Passwort-Richtlinie nach LKA NRW / BSI (core/validators.py, seit 20.11.2026)."""

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db

VALID = [
    'Sicher-Wald-27x',  # 12+ Zeichen, vier Zeichenarten
    'Mond!Fluss7Rabe',
    'grüner fluss trifft 7 berge',  # Passphrase ab 25 Zeichen, zwei Zeichenarten
    'Lena-Reist-Nach-Porto-2026',
]
INVALID = {
    'Kurz-7!x': 'mindestens 12',  # zu kurz
    'sicherwald27!': 'Groß- und Kleinbuchstaben',  # keine Großbuchstaben
    'SicherWald273': 'Groß- und Kleinbuchstaben',  # kein Sonderzeichen
    'nurkleinebuchstabenohneallesxyz': 'zwei Zeichenarten',  # Passphrase mit nur einer Zeichenart
    'Wald-1234-Sicher': 'Folge',  # Ziffernfolge
    'Qwertz-Haus-9!': 'Folge',  # Tastaturmuster
    'Haus-aaaa-Wald9': 'Folge',  # vier gleiche Zeichen
    'Haus-9876-Wald!': 'Folge',  # Folge rückwärts
}


@pytest.mark.parametrize('password', VALID)
def test_policy_accepts_strong_passwords_and_passphrases(password):
    validate_password(password)


@pytest.mark.parametrize(('password', 'reason'), INVALID.items())
def test_policy_rejects_weak_passwords_with_a_clear_reason(password, reason):
    with pytest.raises(ValidationError) as exc:
        validate_password(password)
    assert any(reason in m for m in exc.value.messages)


def test_policy_rejects_common_passwords():
    with pytest.raises(ValidationError):
        validate_password('Password123!')


def test_policy_rejects_name_or_email_in_password():
    user = get_user_model()(email='sophie.weber@example.com', username='sophie.weber@example.com', first_name='Sophie')
    for password in ('Sophie-Wald-27!', 'Mein-weber-Pass9!'):
        with pytest.raises(ValidationError) as exc:
            validate_password(password, user=user)
        assert any('Namen' in m or 'ähnlich' in m.lower() for m in exc.value.messages)


def _register(password, name='Sophie', email='sophie@example.com'):
    client = APIClient(enforce_csrf_checks=False)
    return client.post('/api/v1/auth/register/', {
        'email': email, 'name': name, 'password': password, 'confirm_password': password, 'accept_privacy': True,
    }, format='json')


def test_register_enforces_policy_on_the_server_even_without_the_form():
    response = _register('Sicher123!x')  # früher gültig: 11 Zeichen
    assert response.status_code == 400
    assert 'password' in response.json()
    assert not get_user_model().objects.filter(email='sophie@example.com').exists()


def test_register_rejects_own_name_in_password():
    response = _register('Sophie-Wald-27x')
    assert response.status_code == 400
    assert 'password' in response.json()


def test_register_accepts_policy_compliant_password():
    assert _register('Sicher-Wald-27x').status_code == 201


def test_existing_older_passwords_still_log_in():
    """Die Richtlinie gilt beim Festlegen, nicht beim Anmelden — niemand wird ausgesperrt."""
    get_user_model().objects.create_user(username='max@example.com', email='max@example.com', password='Altes10ok')
    client = APIClient()
    response = client.post('/api/v1/auth/login/', {'email': 'max@example.com', 'password': 'Altes10ok'}, format='json')
    assert response.status_code == 200


def test_email_domain_does_not_count_as_personal_data():
    """„Testlauf-2026!“ bei sophie@example.test: nur der Teil vor dem @ zählt, nicht die Domain."""
    user = get_user_model()(email='sophie-x1@example.test', username='sophie-x1@example.test', first_name='Sophie')
    validate_password('Testlauf-2026!', user=user)
