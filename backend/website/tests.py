from datetime import timedelta
from io import StringIO

import pytest
from django.core.management import call_command
from django.utils import timezone
from rest_framework.test import APIClient

from website.models import PageView

PAGEVIEW = '/api/v1/site/pageview/'

pytestmark = pytest.mark.django_db


@pytest.fixture
def client():
    return APIClient()


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


def test_prune_removes_only_expired_counters(settings):
    settings.PAGEVIEW_RETENTION_DAYS = 730
    PageView.objects.create(day=timezone.localdate() - timedelta(days=731), path='/', device='mobile', count=1)
    PageView.objects.create(day=timezone.localdate(), path='/', device='mobile', count=1)
    call_command('prune_website', stdout=StringIO())
    assert PageView.objects.count() == 1


def test_public_website_endpoint_only_accepts_writes(client):
    """Der öffentliche Endpunkt gibt nie Daten heraus: Lesen ist nicht erlaubt."""
    assert client.get(PAGEVIEW).status_code == 405


def test_contact_endpoint_is_gone(client):
    """Das Kontaktformular wurde entfernt: kein öffentlicher Schreib-Endpunkt mehr dafür."""
    assert client.post('/api/v1/site/contact/', {'name': 'x'}, format='json').status_code == 404
