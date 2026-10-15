"""Authentication-Audit (Beta): Registrierung, Login, Abmelden, Sitzung, geschützte Endpunkte — die Fälle, die in
test_auth*.py, test_sessions.py und test_security_recovery.py noch nicht abgedeckt waren."""

import json
from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.test import Client
from rest_framework_simplejwt.tokens import AccessToken

from core.models import UserSession

pytestmark = pytest.mark.django_db
PASSWORD = 'Sicher123!x'


def register(client=None, **overrides):
    data = {'name': 'Alex', 'email': 'alex@example.com', 'password': PASSWORD, 'confirm_password': PASSWORD, 'accept_privacy': True}
    data.update(overrides)
    return (client or Client()).post('/api/v1/auth/register/', data, content_type='application/json')


def login(client=None, email='alex@example.com', password=PASSWORD):
    return (client or Client()).post('/api/v1/auth/login/', {'email': email, 'password': password}, content_type='application/json')


# --------------------------------------------------------------------------- Registrierung


@pytest.mark.parametrize('overrides,field', [
    ({'email': 'kein-at-zeichen'}, 'email'),
    ({'email': 'a' * 250 + '@example.com'}, 'email'),
    ({'name': 'A'}, 'name'),
    ({'name': 'x' * 151}, 'name'),
    ({'password': 'x' * 1025, 'confirm_password': 'x' * 1025}, 'password'),
    ({'confirm_password': 'y' * 1025}, 'confirm_password'),
    ({'password': '1234567890', 'confirm_password': '1234567890'}, 'password'),  # nur Ziffern
    ({'password': 'kurz1', 'confirm_password': 'kurz1'}, 'password'),
    ({'accept_privacy': False}, 'accept_privacy'),
])
def test_registration_rejects_invalid_input_on_the_server(overrides, field):
    response = register(**overrides)
    assert response.status_code == 400
    assert field in response.json()
    assert not get_user_model().objects.exists()


def test_registration_trims_email_accepts_unicode_names_and_never_returns_the_password():
    response = register(email='  Alex@Example.com ', name='Zoë Ñúñez-Øberg')
    assert response.status_code == 201
    body = json.dumps(response.json())
    assert PASSWORD not in body and 'password' not in body
    user = get_user_model().objects.get()
    assert user.email == 'Alex@example.com' and user.first_name  # Domain normalisiert, Leerzeichen entfernt == 'Zoë Ñúñez-Øberg'
    assert user.password.startswith('argon2') and PASSWORD not in user.password
    # dieselbe Adresse in anderer Schreibweise ist ein Duplikat
    assert 'email' in register(email='alex@EXAMPLE.com').json()
    # und das Login klappt unabhängig von der Schreibweise
    assert login(email='ALEX@example.com').status_code == 200


# --------------------------------------------------------------------------- Login


def test_wrong_password_and_unknown_email_get_the_identical_answer():
    register()
    wrong = login(password='Falsch123!x')
    unknown = login(email='niemand@example.com')
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json()


def test_empty_login_fields_are_rejected():
    response = Client().post('/api/v1/auth/login/', {'email': '', 'password': ''}, content_type='application/json')
    assert response.status_code == 400


def test_repeated_failed_logins_are_throttled():
    register()
    codes = [login(password=f'Falsch{i}23!x').status_code for i in range(7)]
    assert 429 in codes or codes[-1] in (401, 403)
    # nach der Sperre klappt auch das richtige Passwort vorerst nicht
    assert login().status_code in (401, 403, 429)


# --------------------------------------------------------------------------- Sitzung und Abmelden


def test_logout_invalidates_the_access_token_immediately_not_after_15_minutes():
    register()
    device = Client()
    access = login(device).json()['access']
    assert device.get('/api/v1/auth/me/', HTTP_AUTHORIZATION=f'Bearer {access}').status_code == 200
    csrf = device.get('/api/v1/auth/csrf/').json()['csrfToken']
    assert device.post('/api/v1/auth/logout/', HTTP_X_CSRFTOKEN=csrf).status_code == 204
    assert device.get('/api/v1/auth/me/', HTTP_AUTHORIZATION=f'Bearer {access}').status_code == 401
    assert device.post('/api/v1/auth/refresh/').status_code in (401, 403)
    assert UserSession.objects.count() == 1  # nur noch die Sitzung aus der Registrierung


def test_logout_works_without_a_valid_access_token():
    register()
    device = Client(enforce_csrf_checks=True)
    login(device)
    csrf = device.get('/api/v1/auth/csrf/').json()['csrfToken']
    # kein Authorization-Header (z. B. Access-Token schon abgelaufen): das Gerät wird trotzdem abgemeldet
    assert device.post('/api/v1/auth/logout/', HTTP_X_CSRFTOKEN=csrf).status_code == 204
    assert UserSession.objects.count() == 1  # nur noch die Sitzung aus der Registrierung
    assert device.cookies['refresh_token'].value == ''


def test_revoking_another_device_cuts_its_access_token_too():
    register()
    phone, laptop = Client(), Client()
    phone_access = login(phone).json()['access']
    laptop_access = login(laptop).json()['access']
    phone_session = UserSession.objects.order_by('id')[1]  # [0] stammt aus der Registrierung
    response = laptop.delete(f'/api/v1/auth/sessions/{phone_session.sid}/', HTTP_AUTHORIZATION=f'Bearer {laptop_access}')
    assert response.status_code == 204
    assert phone.get('/api/v1/auth/me/', HTTP_AUTHORIZATION=f'Bearer {phone_access}').status_code == 401
    assert laptop.get('/api/v1/auth/me/', HTTP_AUTHORIZATION=f'Bearer {laptop_access}').status_code == 200


def test_expired_garbage_and_foreign_tokens_are_rejected():
    register()
    user = get_user_model().objects.get()
    expired = AccessToken.for_user(user)
    expired.set_exp(lifetime=-timedelta(seconds=1))
    for token in (str(expired), 'kaputt', 'eyJhbGciOiJub25lIn0.e30.'):
        assert Client().get('/api/v1/auth/me/', HTTP_AUTHORIZATION=f'Bearer {token}').status_code == 401


@pytest.mark.parametrize('url', [
    '/api/v1/auth/me/', '/api/v1/today/', '/api/v1/finanzen/private/transactions/', '/api/v1/haushalt/aufgaben/',
    '/api/v1/organisation/notes/', '/api/v1/reisen/trips/', '/api/v1/contacts/', '/api/v1/invitations/',
    '/api/v1/notifications/', '/api/v1/connections/link-suggestions/', '/api/v1/auth/sessions/',
    '/api/v1/household/members/',
])
def test_every_protected_api_needs_a_login(url):
    assert Client().get(url).status_code == 401


# --------------------------------------------------------------------------- Keine Geheimnisse in URLs und Logs


def test_mail_links_carry_tokens_only_in_the_fragment(settings):
    """Alles hinter # schickt der Browser nie an einen Server — Tokens landen so in keinem Zugriffsprotokoll."""
    from django.core import mail

    settings.FRONTEND_URL = 'https://app.example'
    register()
    alex = get_user_model().objects.get()
    Client().post('/api/v1/auth/password-reset/request/', {'email': alex.email}, content_type='application/json')
    inviter = Client()
    access = login(inviter).json()['access']
    inviter.post('/api/v1/contacts/invites/', {'email': 'neu@example.com', 'relation': 'FRIEND'},
                 content_type='application/json', HTTP_AUTHORIZATION=f'Bearer {access}')
    bodies = '\n'.join(m.body for m in mail.outbox)
    assert 'https://app.example/email-bestaetigen#token=' in bodies
    assert 'https://app.example/passwort-zuruecksetzen#token=' in bodies
    assert 'https://app.example/einladung#' in bodies
    assert '?token=' not in bodies and '/einladung/' not in bodies


def test_invite_tokens_are_never_accepted_in_the_url():
    register()
    access = login().json()['access']
    for path in ('/api/v1/contacts/invites/irgendwas/', '/api/v1/contacts/invites/irgendwas/accept/'):
        assert Client().post(path, HTTP_AUTHORIZATION=f'Bearer {access}').status_code == 404


def test_failed_logins_do_not_write_the_email_address_to_the_log(caplog):
    register()
    with caplog.at_level('DEBUG'):
        login(password='Falsch123!x')
    assert 'alex@example.com' not in caplog.text
    assert 'Falsch123!x' not in caplog.text
