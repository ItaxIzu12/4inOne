from datetime import timedelta
from io import StringIO

import pytest
from django.core import mail
from django.core.management import call_command
from django.utils import timezone
from rest_framework.test import APIClient

from website.models import ContactMessage, PageView

CONTACT = '/api/v1/site/contact/'
PAGEVIEW = '/api/v1/site/pageview/'
VALID = {'name': 'Mia Beispiel', 'email': 'mia@example.com', 'message': 'Hallo, ich habe eine Frage zu 4inOne.'}

pytestmark = pytest.mark.django_db


@pytest.fixture
def client():
    return APIClient()


def test_contact_stores_message_without_login(client, settings):
    settings.CONTACT_RECIPIENT = ''
    response = client.post(CONTACT, VALID, format='json')
    assert response.status_code == 204
    entry = ContactMessage.objects.get()
    assert (entry.name, entry.email, entry.forwarded) == ('Mia Beispiel', 'mia@example.com', False)
    assert len(mail.outbox) == 0


def test_contact_forwards_with_reply_to(client, settings):
    settings.CONTACT_RECIPIENT = 'team@example.com'
    assert client.post(CONTACT, VALID, format='json').status_code == 204
    assert len(mail.outbox) == 1
    sent = mail.outbox[0]
    assert sent.to == ['team@example.com'] and sent.reply_to == ['mia@example.com']
    assert ContactMessage.objects.get().forwarded is True


def test_contact_name_cannot_inject_mail_headers(client, settings):
    settings.CONTACT_RECIPIENT = 'team@example.com'
    payload = {**VALID, 'name': 'Mia\r\nBcc: victim@example.com'}
    assert client.post(CONTACT, payload, format='json').status_code == 204
    assert '\n' not in mail.outbox[0].subject and mail.outbox[0].bcc == []


def test_contact_honeypot_is_silently_dropped(client):
    response = client.post(CONTACT, {**VALID, 'website': 'http://spam.example'}, format='json')
    assert response.status_code == 204
    assert ContactMessage.objects.count() == 0


@pytest.mark.parametrize('field,value', [('email', 'kein-mail'), ('message', 'kurz'), ('name', '   '), ('message', 'x' * 4001)])
def test_contact_validates_input(client, field, value):
    response = client.post(CONTACT, {**VALID, field: value}, format='json')
    assert response.status_code == 400
    assert field in response.json()
    assert ContactMessage.objects.count() == 0


def test_contact_is_rate_limited(client, settings):
    for _ in range(5):
        assert client.post(CONTACT, VALID, format='json').status_code == 204
    assert client.post(CONTACT, VALID, format='json').status_code == 429


def test_pageview_counts_per_day_path_and_device(client):
    for _ in range(3):
        client.post(PAGEVIEW, {'path': '/', 'device': 'mobile'}, format='json')
    client.post(PAGEVIEW, {'path': '/', 'device': 'desktop'}, format='json')
    counts = {(v.path, v.device): v.count for v in PageView.objects.all()}
    assert counts == {('/', 'mobile'): 3, ('/', 'desktop'): 1}
    assert PageView.objects.get(device='mobile').day == timezone.localdate()


@pytest.mark.parametrize('path', ['/einladung/abc123token', '/passwort-zuruecksetzen', '/finanzen', '/?email=a@b.de', 'x' * 80])
def test_pageview_ignores_everything_but_public_pages(client, path):
    response = client.post(PAGEVIEW, {'path': path, 'device': 'mobile'}, format='json')
    assert response.status_code == 204
    assert PageView.objects.count() == 0


def test_pageview_stores_no_personal_data(client):
    client.post(PAGEVIEW, {'path': '/', 'device': 'mobile'}, format='json', HTTP_USER_AGENT='Secret/1.0', REMOTE_ADDR='203.0.113.9')
    fields = {f.name for f in PageView._meta.get_fields()}
    assert fields == {'id', 'day', 'path', 'device', 'count'}
    assert 'set-cookie' not in {k.lower() for k in client.post(PAGEVIEW, {'path': '/', 'device': 'mobile'}, format='json').headers}


def test_prune_removes_only_expired_entries(settings):
    settings.CONTACT_RETENTION_DAYS = 180
    settings.PAGEVIEW_RETENTION_DAYS = 730
    old = ContactMessage.objects.create(**VALID)
    ContactMessage.objects.filter(pk=old.pk).update(created_at=timezone.now() - timedelta(days=181))
    ContactMessage.objects.create(**VALID)
    PageView.objects.create(day=timezone.localdate() - timedelta(days=731), path='/', device='mobile', count=1)
    PageView.objects.create(day=timezone.localdate(), path='/', device='mobile', count=1)
    call_command('prune_website', stdout=StringIO())
    assert ContactMessage.objects.count() == 1 and PageView.objects.count() == 1


def test_public_website_endpoints_only_accept_writes(client):
    """Die beiden öffentlichen Endpunkte geben nie Daten heraus: Lesen ist nicht erlaubt."""
    for url in (CONTACT, PAGEVIEW):
        assert client.get(url).status_code == 405
