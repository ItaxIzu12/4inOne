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
