"""O3 – Kalender-Abo: sicherer Abruf (kein internes Netz), ehrliches Lesen der ICS-Daten, nur die eigene Person."""

from datetime import datetime, timedelta, timezone as dt_timezone
from unittest import mock
from zoneinfo import ZoneInfo

import pytest
from django.contrib.auth import get_user_model
from django.core.cache import caches
from django.utils import timezone
from rest_framework.test import APIClient

from organisation import subscriptions
from organisation.models import CalendarSubscription, SubscribedEvent

pytestmark = pytest.mark.django_db
BERLIN = ZoneInfo('Europe/Berlin')
NOW = datetime(2026, 11, 22, 9, 0, tzinfo=BERLIN)


@pytest.fixture(autouse=True)
def _fresh_throttle():
    caches['throttle'].clear()


def _user(name):
    return get_user_model().objects.create_user(username=f'{name}@example.com', email=f'{name}@example.com', password='x')


def _client(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


ICS = """BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:a@x
SUMMARY:Teammeeting
DTSTART;TZID=W. Europe Standard Time:20261124T100000
DTEND;TZID=W. Europe Standard Time:20261124T110000
RRULE:FREQ=WEEKLY;COUNT=3
EXDATE;TZID=W. Europe Standard Time:20261201T100000
LOCATION:Raum 2\\, Haus A
END:VEVENT
BEGIN:VEVENT
UID:b@x
SUMMARY:Herbstferien
DTSTART;VALUE=DATE:20261026
DTEND;VALUE=DATE:20261031
END:VEVENT
BEGIN:VEVENT
UID:c@x
SUMMARY:Abgesagt
STATUS:CANCELLED
DTSTART:20261125T090000Z
END:VEVENT
BEGIN:VEVENT
UID:d@x
SUMMARY:Jeden ersten Montag
DTSTART:20261207T080000Z
RRULE:FREQ=MONTHLY;BYDAY=1MO
END:VEVENT
BEGIN:VEVENT
UID:e@x
SUMMARY:Yoga
DTSTART:20261123T170000Z
DURATION:PT1H
RRULE:FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20261202T235959Z
END:VEVENT
END:VCALENDAR
"""


# --------------------------------------------------------------------------- Lesen


def test_parse_expands_simple_rules_honours_exdate_and_skips_cancelled():
    rows = subscriptions.parse(ICS, BERLIN, NOW)
    titles = [(r.title, r.starts_at.astimezone(BERLIN).strftime('%d.%m. %H:%M')) for r in rows]

    assert ('Teammeeting', '24.11. 10:00') in titles and ('Teammeeting', '08.12. 10:00') in titles
    assert ('Teammeeting', '01.12. 10:00') not in titles  # EXDATE
    assert [t for t in titles if t[0] == 'Teammeeting'] == [('Teammeeting', '24.11. 10:00'), ('Teammeeting', '08.12. 10:00')]
    assert next(r for r in rows if r.title == 'Teammeeting').location == 'Raum 2, Haus A'
    holidays = next(r for r in rows if r.title == 'Herbstferien')
    assert holidays.all_day and holidays.starts_at.date().isoformat() == '2026-10-26'
    assert holidays.ends_at.date().isoformat() == '2026-10-30'  # letzter Tag, nicht der Folgetag
    assert all(r.title != 'Abgesagt' for r in rows)
    # Zu komplexe Regel (BYDAY=1MO bei MONTHLY): nur der erste Termin, nichts geraten
    assert [r.title for r in rows].count('Jeden ersten Montag') == 1
    yoga = [r.starts_at.astimezone(BERLIN).strftime('%a %d.%m.') for r in rows if r.title == 'Yoga']
    assert yoga == ['Mon 23.11.', 'Wed 25.11.', 'Mon 30.11.', 'Wed 02.12.']
    assert next(r for r in rows if r.title == 'Yoga').ends_at - next(r for r in rows if r.title == 'Yoga').starts_at == timedelta(hours=1)


def test_parse_ignores_events_outside_the_window():
    old = ICS.replace('20261026', '20240101').replace('20261031', '20240102')
    assert all(r.title != 'Herbstferien' for r in subscriptions.parse(old, BERLIN, NOW))


# --------------------------------------------------------------------------- Sicherheit beim Abruf


@pytest.mark.parametrize('url', ['http://example.com/cal.ics', 'ftp://example.com/x', 'https://user:pw@example.com/x', 'https://example.com:8443/x', 'javascript:alert(1)'])
def test_only_plain_https_links_are_accepted(url):
    with pytest.raises(subscriptions.SubscriptionError):
        subscriptions.normalize_url(url)


def test_webcal_becomes_https():
    assert subscriptions.normalize_url('webcal://calendar.example.com/a.ics') == 'https://calendar.example.com/a.ics'


@pytest.mark.parametrize('address', ['127.0.0.1', '10.0.0.5', '192.168.1.10', '169.254.169.254', '::1', 'fd00::1', '100.64.0.1'])
def test_internal_addresses_are_never_fetched(address):
    family = 10 if ':' in address else 2
    with mock.patch('socket.getaddrinfo', return_value=[(family, 1, 6, '', (address, 443))]):
        with pytest.raises(subscriptions.SubscriptionError, match='internes Netz'):
            subscriptions.fetch('https://calendar.example.com/a.ics')


def test_redirect_to_an_internal_address_is_blocked():
    public = [(2, 1, 6, '', ('93.184.216.34', 443))]
    internal = [(2, 1, 6, '', ('127.0.0.1', 443))]
    response = mock.Mock(status=302, headers={'Location': 'https://internal.example/x'})
    pool = mock.Mock()
    pool.request.return_value = response
    with mock.patch('socket.getaddrinfo', side_effect=[public, internal]), mock.patch('urllib3.HTTPSConnectionPool', return_value=pool) as pool_cls:
        with pytest.raises(subscriptions.SubscriptionError, match='internes Netz'):
            subscriptions.fetch('https://calendar.example.com/a.ics')
    # verbunden wurde mit der GEPRÜFTEN Adresse, das Zertifikat gilt dem Rechnernamen
    args, kwargs = pool_cls.call_args
    assert args[0] == '93.184.216.34'
    assert kwargs['server_hostname'] == 'calendar.example.com' and kwargs['assert_hostname'] == 'calendar.example.com'


# --------------------------------------------------------------------------- API und Rechte


def test_subscribe_lists_events_read_only_and_only_for_the_owner():
    anna, ben = _user('anna'), _user('ben')
    with mock.patch.object(subscriptions, 'fetch', return_value=ICS):
        r = _client(anna).post('/api/v1/organisation/abos/', {'name': 'Arbeit', 'url': 'webcal://cal.example.com/secret-token.ics'}, format='json')
    assert r.status_code == 201, r.data
    assert r.data['host'] == 'cal.example.com' and 'secret-token' not in str(r.data)
    assert r.data['event_count'] > 0

    params = {'start': '2026-11-23', 'end': '2026-11-29', 'timezone': 'Europe/Berlin'}
    events = _client(anna).get('/api/v1/organisation/abos/termine/', params).data
    assert {e['title'] for e in events} >= {'Teammeeting', 'Yoga'}
    assert all(e['subscription_name'] == 'Arbeit' for e in events)
    assert _client(ben).get('/api/v1/organisation/abos/termine/', params).data == []
    assert _client(ben).get('/api/v1/organisation/abos/').data == []
    sub_id = r.data['id']
    assert _client(ben).delete(f'/api/v1/organisation/abos/{sub_id}/').status_code == 404
    assert _client(ben).post(f'/api/v1/organisation/abos/{sub_id}/aktualisieren/').status_code == 404


def test_refresh_replaces_all_events_and_keeps_the_last_error():
    anna = _user('anna')
    sub = CalendarSubscription.objects.create(owner=anna, name='Schule', url='https://cal.example.com/a.ics')
    subscriptions.refresh(sub, ICS)
    first = SubscribedEvent.objects.filter(subscription=sub).count()
    subscriptions.refresh(sub, ICS)
    assert SubscribedEvent.objects.filter(subscription=sub).count() == first

    with mock.patch.object(subscriptions, 'fetch', side_effect=subscriptions.SubscriptionError('Der Kalender war nicht erreichbar.')):
        r = _client(anna).post(f'/api/v1/organisation/abos/{sub.pk}/aktualisieren/')
    assert r.status_code == 400 and r.data['last_error'].startswith('Der Kalender war nicht erreichbar')
    assert SubscribedEvent.objects.filter(subscription=sub).count() == first  # alte Termine bleiben bei einem Fehler


def test_invalid_link_is_refused_and_at_most_five_subscriptions():
    anna = _user('anna')
    r = _client(anna).post('/api/v1/organisation/abos/', {'name': 'X', 'url': 'http://cal.example.com/a.ics'}, format='json')
    assert r.status_code == 400 and 'https://' in r.data['url'][0]
    for i in range(5):
        CalendarSubscription.objects.create(owner=anna, name=f'K{i}', url='https://cal.example.com/a.ics')
    with mock.patch.object(subscriptions, 'fetch', return_value=ICS):
        r = _client(anna).post('/api/v1/organisation/abos/', {'name': 'Zu viel', 'url': 'https://cal.example.com/b.ics'}, format='json')
    assert r.status_code == 400 and 'höchstens 5' in r.data['detail']
