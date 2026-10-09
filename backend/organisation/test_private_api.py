from datetime import datetime, timedelta, timezone as dt_timezone
from unittest.mock import patch
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from core.models import Household, HouseholdMembership
from core.onboarding_views import has_user_data
from organisation.models import PersonalEvent, PersonalTask, CalendarEvent

pytestmark = pytest.mark.django_db
BASE = '/api/v1/organisation/'

@pytest.fixture
def users():
    return [get_user_model().objects.create_user(username=name, password='test-secret-234') for name in ['alice', 'bob']]

@pytest.fixture
def client(users):
    client = APIClient()
    client.force_authenticate(users[0])
    return client

@pytest.mark.parametrize('resource,payload', [('events', {'title':'Arzt','starts_at':'2026-09-24T10:00:00+02:00'}), ('tasks', {'title':'Anrufen'})])
def test_private_crud_and_owner_spoofing(client, users, resource, payload):
    model = PersonalEvent if resource == 'events' else PersonalTask
    response = client.post(BASE+resource+'/', {**payload, 'owner':users[1].pk}, format='json')
    assert response.status_code == 201
    pk = response.data['id']
    assert model.objects.get(pk=pk).owner == users[0]
    assert client.get(BASE+resource+'/').data[0]['id'] == pk
    assert client.patch(f'{BASE}{resource}/{pk}/', {'title':'Geändert'}, format='json').status_code == 200
    client.force_authenticate(users[1])
    assert client.get(BASE+resource+'/').data == []
    for method in ['get','patch','put','delete']:
        response = getattr(client, method)(f'{BASE}{resource}/{pk}/', {**payload, 'owner':users[1].pk}, format='json')
        assert response.status_code == 404
    client.force_authenticate(users[0])
    assert client.delete(f'{BASE}{resource}/{pk}/').status_code == 204
    assert not model.objects.filter(pk=pk).exists()

@pytest.mark.parametrize('resource',['events','tasks','today'])
def test_requires_login(resource):
    assert APIClient().get(BASE+resource+'/').status_code == 401


def test_task_validation_and_reopen(client):
    for payload in [{'title':' '},{'title':'x','status':'INVALID'},{'title':'x','priority':'URGENT'},{'title':'x','due_time':'09:00'}]:
        assert client.post(BASE+'tasks/',payload,format='json').status_code == 400
    r=client.post(BASE+'tasks/',{'title':'x','due_date':'2026-09-24','due_time':'09:00'},format='json')
    url=f"{BASE}tasks/{r.data['id']}/"
    assert client.patch(url,{'due_date':None},format='json').status_code == 400
    for status in ['IN_PROGRESS','DONE','OPEN']:
        assert client.patch(url,{'status':status},format='json').data['status'] == status
    assert client.patch(url,{'due_date':None,'due_time':None},format='json').status_code == 200


def test_event_partial_validation(client):
    payload={'title':'Arzt','starts_at':'2026-09-24T09:00:00Z','ends_at':'2026-09-24T10:00:00Z'}
    r=client.post(BASE+'events/',payload,format='json')
    url=f"{BASE}events/{r.data['id']}/"
    assert client.patch(url,{'starts_at':'2026-09-24T11:00:00Z'},format='json').status_code == 400
    assert client.patch(url,{'ends_at':'2026-09-24T08:00:00Z'},format='json').status_code == 400
    assert client.patch(url,{'ends_at':None},format='json').status_code == 200
    assert client.post(BASE+'events/',{'title':'No date'},format='json').status_code == 400


def test_today_local_day_overlap_overdue_sort_and_privacy(client,users):
    now=datetime(2026,9,24,22,30,tzinfo=dt_timezone.utc) # 25th in Berlin
    with patch('organisation.views.timezone.now', return_value=now):
        PersonalEvent.objects.create(owner=users[0],title='Heute',starts_at=now)
        PersonalEvent.objects.create(owner=users[0],title='Mehrtag',starts_at=now-timedelta(days=2),ends_at=now+timedelta(hours=2))
        PersonalEvent.objects.create(owner=users[0],title='Vorbei',starts_at=now-timedelta(days=2),ends_at=now-timedelta(hours=1))
        PersonalEvent.objects.create(owner=users[1],title='Privat Bob',starts_at=now)
        for title,date,status in [('Überfällig','2026-09-24','OPEN'),('Fällig','2026-09-25','IN_PROGRESS'),('Erledigt','2026-09-24','DONE'),('Später','2026-09-26','OPEN'),('Ohne Datum',None,'OPEN')]:
            PersonalTask.objects.create(owner=users[0],title=title,due_date=date,status=status)
        PersonalTask.objects.create(owner=users[1],title='Bobs Aufgabe',due_date='2026-09-24')
        response=client.get(BASE+'today/?timezone=Europe/Berlin')
        assert response.data['date']=='2026-09-25'
        assert [item['title'] for item in response.data['items']]==['Mehrtag','Überfällig','Fällig','Heute']
        assert response.data['overdue_count']==1
        assert response.data['event_count']==2
        assert response['Cache-Control']=='no-store'
        assert client.get(BASE+'today/?timezone=Invalid/Timezone').status_code==400


def test_no_household_required_or_shared_calendar_leak(client, users):
    home=Household.objects.create(name='WG')
    for user in users: HouseholdMembership.objects.create(household=home,user=user)
    CalendarEvent.objects.create(household=home,created_by=users[0],title='Shared legacy',starts_at=datetime.now(dt_timezone.utc))
    assert client.get(BASE+'events/').data==[]
    assert client.get(BASE+'today/').data['items']==[]


def test_personal_data_prevents_onboarding(users):
    assert not has_user_data(users[0])
    PersonalTask.objects.create(owner=users[0],title='Aufgabe')
    assert has_user_data(users[0])
    assert not has_user_data(users[1])


# ---------------------------------------------------------------------------
# Organisation V1 (docs/ORGANISATION_V1.md)
# ---------------------------------------------------------------------------

def _other(users):
    other = APIClient()
    other.force_authenticate(users[1])
    return other


def test_event_crud_past_and_validation(client):
    past = client.post(BASE+'events/', {'title': 'Arzt', 'starts_at': '2026-09-01T10:00:00+02:00'}, format='json')
    assert past.status_code == 201  # vergangene Termine sind erlaubt
    bad = client.post(BASE+'events/', {'title': 'Meeting', 'starts_at': '2026-10-06T10:00:00+02:00',
                                        'ends_at': '2026-10-06T09:00:00+02:00'}, format='json')
    assert bad.status_code == 400 and bad.data['ends_at'] == ['Das Ende liegt vor dem Beginn.']
    days = client.post(BASE+'events/', {'title': 'Reise', 'starts_at': '2026-10-08T00:00:00+02:00',
                                         'ends_at': '2026-10-06T00:00:00+02:00', 'all_day': True}, format='json')
    assert days.data['ends_at'] == ['Das Enddatum liegt vor dem Startdatum.']
    assert client.post(BASE+'events/', {'title': '  ', 'starts_at': '2026-10-06T10:00:00+02:00'}, format='json').status_code == 400
    pk = past.data['id']
    changed = client.patch(f'{BASE}events/{pk}/', {'title': 'Zahnarzt', 'all_day': True}, format='json')
    assert (changed.data['title'], changed.data['all_day']) == ('Zahnarzt', True)
    assert client.delete(f'{BASE}events/{pk}/').status_code == 204


def test_event_range_filter_and_recurrence(client):
    client.post(BASE+'events/', {'title': 'Teammeeting', 'starts_at': '2026-10-05T09:30:00+02:00',
                                 'ends_at': '2026-10-05T10:30:00+02:00', 'recurrence': 'weekly'}, format='json')
    client.post(BASE+'events/', {'title': 'Geburtstag', 'starts_at': '2020-10-07T00:00:00+02:00',
                                 'all_day': True, 'recurrence': 'yearly'}, format='json')
    client.post(BASE+'events/', {'title': 'Badminton', 'starts_at': '2026-10-06T19:00:00+02:00'}, format='json')
    client.post(BASE+'events/', {'title': 'Alt', 'starts_at': '2026-09-01T19:00:00+02:00'}, format='json')
    october = client.get(BASE+'events/?start=2026-10-01&end=2026-10-31&timezone=Europe/Berlin').data
    titles = [(e['title'], e['starts_at'][:10]) for e in october]
    assert ('Alt', '2026-09-01') not in titles
    assert [d for t, d in titles if t == 'Teammeeting'] == ['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26']
    assert ('Geburtstag', '2026-10-07') in titles and ('Badminton', '2026-10-06') in titles
    meeting = next(e for e in october if e['starts_at'].startswith('2026-10-12'))
    assert meeting['starts_at'].endswith('09:30:00+02:00') and meeting['series_starts_at'].startswith('2026-10-05')
    # Winterzeit: dieselbe Uhrzeit, andere Verschiebung
    november = client.get(BASE+'events/?start=2026-11-02&end=2026-11-02&timezone=Europe/Berlin').data
    assert november[0]['starts_at'] == '2026-11-02T09:30:00+01:00'
    assert client.get(BASE+'events/?start=2026-10-31&end=2026-10-01').status_code == 400
    assert client.get(BASE+'events/?start=2020-01-01&end=2026-01-01').status_code == 400
    assert client.get(BASE+'events/?start=gestern&end=2026-01-01').status_code == 400


def test_task_filters_recurrence_and_past_due(client):
    from django.utils import timezone as dj
    today = dj.localdate()
    yesterday = (today - timedelta(days=1)).isoformat()
    late = client.post(BASE+'tasks/', {'title': 'Steuer', 'due_date': yesterday}, format='json')
    assert late.status_code == 201  # vergangenes Fälligkeitsdatum ist erlaubt
    now = client.post(BASE+'tasks/', {'title': 'Präsentation', 'due_date': today.isoformat(), 'priority': 'HIGH'}, format='json')
    weekly = client.post(BASE+'tasks/', {'title': 'Wochenplanung', 'due_date': today.isoformat(), 'recurrence': 'weekly'}, format='json')
    assert (weekly.data['recurrence_days'], weekly.data['repeat']) == (7, 'weekly')
    assert client.post(BASE+'tasks/', {'title': 'X', 'recurrence': 'daily'}, format='json').status_code == 400
    assert [t['title'] for t in client.get(BASE+'tasks/?overdue=1').data] == ['Steuer']
    assert {t['title'] for t in client.get(f'{BASE}tasks/?due_date={today}').data} == {'Präsentation', 'Wochenplanung'}
    assert [t['title'] for t in client.get(BASE+'tasks/?recurring=1').data] == ['Wochenplanung']
    # Erledigen: einmalig → DONE; wiederkehrend → eine Woche weiter, bleibt offen
    done = client.patch(f"{BASE}tasks/{now.data['id']}/", {'status': 'DONE'}, format='json')
    assert done.data['status'] == 'DONE'
    moved = client.patch(f"{BASE}tasks/{weekly.data['id']}/", {'status': 'DONE'}, format='json')
    assert moved.data['status'] == 'OPEN'
    assert moved.data['due_date'] == (today + timedelta(days=7)).isoformat()
    assert PersonalTask.objects.filter(title='Wochenplanung').count() == 1
    assert [t['title'] for t in client.get(BASE+'tasks/?status=DONE').data] == ['Präsentation']
    reopened = client.patch(f"{BASE}tasks/{now.data['id']}/", {'status': 'OPEN'}, format='json')
    assert reopened.data['status'] == 'OPEN'
    once = client.patch(f"{BASE}tasks/{weekly.data['id']}/", {'recurrence': None}, format='json')
    assert (once.data['recurrence_days'], once.data['repeat']) == (None, None)
    assert client.delete(f"{BASE}tasks/{late.data['id']}/").status_code == 204


def test_notes_content_first_pin_and_order(client):
    assert client.post(BASE+'notes/', {'title': '', 'body': ''}, format='json').status_code == 400
    untitled = client.post(BASE+'notes/', {'body': 'Fragen für den Arzt'}, format='json')
    assert untitled.status_code == 201 and untitled.data['title'] == ''
    other = client.post(BASE+'notes/', {'title': 'Geschenkideen', 'body': 'Buch'}, format='json')
    pinned = client.patch(f"{BASE}notes/{untitled.data['id']}/", {'pinned': True}, format='json')
    assert pinned.data['pinned'] is True
    assert [n['id'] for n in client.get(BASE+'notes/').data] == [untitled.data['id'], other.data['id']]
    assert client.patch(f"{BASE}notes/{untitled.data['id']}/", {'pinned': False}, format='json').data['pinned'] is False
    assert client.patch(f"{BASE}notes/{other.data['id']}/", {'body': 'Buch, Schal'}, format='json').data['body'] == 'Buch, Schal'
    assert client.delete(f"{BASE}notes/{other.data['id']}/").status_code == 204


def test_no_access_and_no_metadata_for_other_users(client, users):
    event = client.post(BASE+'events/', {'title': 'Geheimtermin', 'starts_at': '2026-10-06T10:00:00+02:00', 'location': 'Praxis'}, format='json').data
    task = client.post(BASE+'tasks/', {'title': 'Geheimaufgabe'}, format='json').data
    note = client.post(BASE+'notes/', {'title': 'Geheimnotiz', 'body': 'Privat'}, format='json').data
    other = _other(users)
    for resource, item in [('events', event), ('tasks', task), ('notes', note)]:
        url = f"{BASE}{resource}/{item['id']}/"
        for method in ('get', 'patch', 'put', 'delete'):
            response = getattr(other, method)(url, {'title': 'x'}, format='json')
            assert response.status_code == 404
            assert 'Geheim' not in str(response.data) and 'Praxis' not in str(response.data)
        assert other.get(f'{BASE}{resource}/').data == []
    assert other.get(BASE+'events/?start=2026-10-01&end=2026-10-31').data == []
    summary = other.get(BASE+'summary/').data
    assert (summary['events_today'], summary['tasks_today'], summary['overdue_tasks']) == (0, 0, 0)
    assert 'Geheim' not in str(other.get(BASE+'today/').data)


def test_summary_counts_own_today(client):
    from datetime import timezone as tz
    from django.utils import timezone as dj
    # Die Zusammenfassung wird in UTC abgefragt — also auch „heute“ in UTC (nicht in Ortszeit).
    today = dj.now().astimezone(tz.utc).date()
    client.post(BASE+'tasks/', {'title': 'Heute', 'due_date': today.isoformat()}, format='json')
    client.post(BASE+'tasks/', {'title': 'Gestern', 'due_date': (today - timedelta(days=1)).isoformat()}, format='json')
    client.post(BASE+'events/', {'title': 'Jeden Tag', 'starts_at': f'{today - timedelta(days=3)}T08:00:00+00:00', 'recurrence': 'daily'}, format='json')
    data = client.get(BASE+'summary/?timezone=UTC').data
    assert (data['events_today'], data['tasks_today'], data['overdue_tasks']) == (1, 1, 1)
