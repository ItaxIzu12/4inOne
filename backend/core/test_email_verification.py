"""E-Mail einmal bestätigen → Kontakt-Einladungen erscheinen in der Glocke (core/email_verification.py,
core/notifications.py). Unbestätigte Adressen sehen nie fremde Einladungen."""

import re

import pytest
from allauth.account.models import EmailAddress
from django.contrib.auth import get_user_model
from django.core import mail, signing
from rest_framework.test import APIClient

from core.email_verification import SALT, make_token
from core.models import Contact, ContactInvite

pytestmark = pytest.mark.django_db


def make_user(email, name):
    return get_user_model().objects.create_user(username=email, email=email, password='irrelevant-1A', first_name=name)


def client_for(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def link_token(body: str) -> str:
    return re.search(r'email-bestaetigen\?token=(\S+)', body).group(1)


def test_registration_sends_a_verification_link_and_reports_the_state():
    response = APIClient().post('/api/v1/auth/register/', {
        'name': 'Alex', 'email': 'alex@example.com', 'password': 'Sicher123!x', 'confirm_password': 'Sicher123!x',
        'accept_privacy': True,
    }, format='json')
    assert response.status_code == 201
    assert response.data['user']['email_verified'] is False
    assert len(mail.outbox) == 1 and mail.outbox[0].to == ['alex@example.com']

    token = link_token(mail.outbox[0].body)
    assert APIClient().post('/api/v1/auth/email/verify/', {'token': token}, format='json').status_code == 200
    alex = get_user_model().objects.get(email='alex@example.com')
    assert client_for(alex).get('/api/v1/auth/me/').data['email_verified'] is True


def test_invalid_tampered_or_outdated_links_are_rejected():
    alex = make_user('alex@example.com', 'Alex')
    eve = make_user('eve@example.com', 'Eve')
    verify = lambda token: APIClient().post('/api/v1/auth/email/verify/', {'token': token}, format='json')
    assert verify('kaputt').status_code == 400
    forged = signing.dumps({'u': alex.pk, 'e': 'alex@example.com'}, salt='anderer-zweck')
    assert verify(forged).status_code == 400
    # Eves Link bestätigt nie Alex
    eve_token = make_token(eve)
    assert verify(eve_token).status_code == 200
    assert not EmailAddress.objects.filter(user=alex, verified=True).exists()
    # Adresse geändert → alter Link gilt nicht mehr
    old = make_token(alex)
    alex.email = 'neu@example.com'
    alex.save()
    assert verify(old).status_code == 400
    assert signing.loads(old, salt=SALT)['u'] == alex.pk  # nur der Inhalt passt nicht mehr


def test_resend_needs_login_and_is_limited():
    alex = make_user('alex@example.com', 'Alex')
    assert APIClient().post('/api/v1/auth/email/resend/').status_code == 401
    client = client_for(alex)
    codes = [client.post('/api/v1/auth/email/resend/').status_code for _ in range(4)]
    assert codes[:3] == [200, 200, 200] and codes[3] == 429
    assert len(mail.outbox) == 3


def test_contact_invite_shows_in_the_bell_only_after_verification():
    richard = make_user('richard@example.com', 'Richard')
    alex = make_user('alex@example.com', 'Alex')
    eve = make_user('eve@example.com', 'Eve')
    client_for(richard).post('/api/v1/contacts/invites/', {'email': 'alex@example.com', 'relation': 'FAMILY'}, format='json')

    # unbestätigt: nichts in der Glocke
    assert client_for(alex).get('/api/v1/notifications/').data == {'unread': 0, 'items': []}

    APIClient().post('/api/v1/auth/email/verify/', {'token': make_token(alex)}, format='json')
    data = client_for(alex).get('/api/v1/notifications/').data
    assert data['unread'] == 1
    item = data['items'][0]
    assert item['kind'] == 'CONTACT_INVITE'
    assert item['contact_invite']['from_name'] == 'Richard' and item['contact_invite']['relation_label'] == 'Familie'
    assert 'richard@example.com' not in str(data)

    # Eve sieht nichts, auch nicht mit bestätigter Adresse
    APIClient().post('/api/v1/auth/email/verify/', {'token': make_token(eve)}, format='json')
    assert client_for(eve).get('/api/v1/notifications/').data['items'] == []

    # gelesen ≠ angenommen
    client_for(alex).post('/api/v1/notifications/read/')
    assert client_for(alex).get('/api/v1/notifications/').data['unread'] == 0
    assert ContactInvite.objects.get().accepted_at is None

    # direkt aus der Glocke annehmen (ohne Mail-Link)
    token = item['contact_invite']['token']
    assert client_for(alex).post(f'/api/v1/contacts/invites/{token}/accept/').status_code == 201
    assert Contact.objects.filter(owner=alex, other=richard, relation='FAMILY').exists()
    assert client_for(alex).get('/api/v1/notifications/').data['items'] == []


def test_dev_link_only_locally_with_log_mailer(settings):
    alex = make_user('alex@example.com', 'Alex')
    settings.DEBUG = True
    settings.MAILERS = {'default': {'BACKEND': 'django.core.mail.backends.console.EmailBackend'}}
    local = client_for(alex).post('/api/v1/auth/email/resend/').data
    assert '/email-bestaetigen?token=' in local['dev_link']
    settings.DEBUG = False
    assert 'dev_link' not in client_for(alex).post('/api/v1/auth/email/resend/').data
    settings.DEBUG = True
    settings.MAILERS = {'default': {'BACKEND': 'django.core.mail.backends.smtp.EmailBackend'}}
    assert 'dev_link' not in client_for(alex).post('/api/v1/auth/email/resend/').data


def test_contact_inviter_gets_a_success_message_but_no_decline_message():
    richard = make_user('richard@example.com', 'Richard')
    alex = make_user('alex@example.com', 'Alex')
    lena = make_user('lena@example.com', 'Lena')
    for person in (alex, lena):
        APIClient().post('/api/v1/auth/email/verify/', {'token': make_token(person)}, format='json')
    for email in ('alex@example.com', 'lena@example.com'):
        client_for(richard).post('/api/v1/contacts/invites/', {'email': email, 'relation': 'FRIEND'}, format='json')
    alex_token = client_for(alex).get('/api/v1/notifications/').data['items'][0]['contact_invite']['token']
    lena_token = client_for(lena).get('/api/v1/notifications/').data['items'][0]['contact_invite']['token']
    client_for(alex).post(f'/api/v1/contacts/invites/{alex_token}/accept/')
    client_for(lena).post(f'/api/v1/contacts/invites/{lena_token}/decline/')

    items = client_for(richard).get('/api/v1/notifications/').data['items']
    assert [(i['kind'], i['accepted']['name']) for i in items] == [('CONTACT_ACCEPTED', 'Alex')]
    overview = client_for(richard).get('/api/v1/contacts/').data
    assert [d['email'] for d in overview['declined']] == ['lena@example.com']
    assert overview['sent'] == []
    # Alex' eigene Anfrage ist erledigt
    assert client_for(alex).get('/api/v1/notifications/').data['items'] == []
