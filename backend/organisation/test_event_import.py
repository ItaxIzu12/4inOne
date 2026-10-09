"""Kalender-Import (ICS): Vorschau, Dubletten, Fehler, Ganztägig/Wiederholung und Privatsphäre."""

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from organisation.models import PersonalEvent

pytestmark = pytest.mark.django_db
URL = '/api/v1/organisation/events/import/'


@pytest.fixture
def people():
    model = get_user_model()
    return model.objects.create_user(username='ics-a'), model.objects.create_user(username='ics-b')


def api(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


def event(**kwargs):
    base = {'title': 'Zahnarzt', 'starts_at': '2026-10-12T09:30:00+02:00', 'ends_at': '2026-10-12T10:00:00+02:00', 'all_day': False,
            'recurrence': '', 'location': 'Praxis', 'description': ''}
    return {**base, **kwargs}


def test_dry_run_previews_without_saving(people):
    a, _ = people
    response = api(a).post(URL, {'rows': [event(), event(title='Teammeeting', recurrence='weekly')], 'dry_run': True}, format='json')
    assert response.status_code == 200, response.data
    assert (response.data['new'], response.data['created']) == (2, 0)
    assert PersonalEvent.objects.count() == 0


def test_import_creates_events_with_all_day_and_recurrence(people):
    a, _ = people
    rows = [event(), event(title='Urlaub', starts_at='2026-10-20T00:00:00+02:00', ends_at='2026-10-24T00:00:00+02:00', all_day=True),
            event(title='Teammeeting', recurrence='weekly', ends_at=None)]
    response = api(a).post(URL, {'rows': rows}, format='json')
    assert response.status_code == 201, response.data
    assert response.data['created'] == 3
    trip = PersonalEvent.objects.get(owner=a, title='Urlaub')
    assert trip.all_day is True
    assert PersonalEvent.objects.get(owner=a, title='Teammeeting').recurrence == 'weekly'


def test_duplicates_are_skipped(people):
    a, _ = people
    client = api(a)
    client.post(URL, {'rows': [event()]}, format='json')
    response = client.post(URL, {'rows': [event(), event(title='zahnarzt'), event(title='Neu'), event(title='Neu')]}, format='json')
    assert [r['status'] for r in response.data['rows']] == ['duplicate', 'duplicate', 'new', 'duplicate']
    assert PersonalEvent.objects.filter(owner=a).count() == 2


def test_invalid_rows_are_reported_with_the_field(people):
    a, _ = people
    rows = [event(title='  '), event(ends_at='2026-10-12T08:00:00+02:00'), event(starts_at='kaputt'), event(recurrence='hourly'), event(title='Gut')]
    response = api(a).post(URL, {'rows': rows}, format='json')
    assert response.data['created'] == 1
    messages = [r['message'] for r in response.data['rows'] if r['status'] == 'invalid']
    assert messages[0].startswith('Titel:')
    assert messages[1].startswith('Ende:')
    assert messages[2].startswith('Beginn:')
    assert messages[3].startswith('Wiederholung:')


def test_import_is_private_and_limited(people):
    a, b = people
    api(a).post(URL, {'rows': [event(owner=b.pk)]}, format='json')
    assert PersonalEvent.objects.filter(owner=b).count() == 0
    # Dubletten nur gegen die eigenen Termine — b erfährt nichts über a's Kalender.
    assert api(b).post(URL, {'rows': [event()], 'dry_run': True}, format='json').data['new'] == 1
    assert api(a).post(URL, {'rows': []}, format='json').status_code == 400
    assert api(a).post(URL, {'rows': [event()] * 1001}, format='json').status_code == 400
    assert APIClient().post(URL, {'rows': [event()]}, format='json').status_code in (401, 403)
