import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from reisen.models import PackingItem, Trip, TripEvent, TripExpense, TripTask

pytestmark = pytest.mark.django_db
BASE = '/api/v1/reisen/'


@pytest.fixture
def users():
    return [get_user_model().objects.create_user(username=name, password='test-secret-234') for name in ['alice', 'bob']]


@pytest.fixture
def client(users):
    client = APIClient()
    client.force_authenticate(users[0])
    return client


def test_trip_crud_and_owner_spoofing(client, users):
    response = client.post(BASE + 'trips/', {'title': 'Berlin Wochenende', 'owner': users[1].pk}, format='json')
    assert response.status_code == 201
    pk = response.data['id']
    assert Trip.objects.get(pk=pk).owner == users[0]
    assert client.get(BASE + 'trips/').data[0]['id'] == pk
    assert client.patch(f'{BASE}trips/{pk}/', {'title': 'Geändert'}, format='json').status_code == 200

    client.force_authenticate(users[1])
    assert client.get(BASE + 'trips/').data == []
    for method in ['get', 'patch', 'put', 'delete']:
        response = getattr(client, method)(f'{BASE}trips/{pk}/', {'title': 'x'}, format='json')
        assert response.status_code == 404

    client.force_authenticate(users[0])
    assert client.delete(f'{BASE}trips/{pk}/').status_code == 204
    assert not Trip.objects.filter(pk=pk).exists()


def test_trip_validation(client):
    assert client.post(BASE + 'trips/', {'title': ' '}, format='json').status_code == 400
    assert client.post(BASE + 'trips/', {'title': 'x', 'status': 'INVALID'}, format='json').status_code == 400
    assert client.post(BASE + 'trips/', {'title': 'x', 'budget_amount': '-1'}, format='json').status_code == 400
    r = client.post(
        BASE + 'trips/', {'title': 'x', 'start_date': '2026-09-24', 'end_date': '2026-09-20'}, format='json'
    )
    assert r.status_code == 400


@pytest.mark.parametrize(
    'resource,payload',
    [
        ('packing-items', {'title': 'Zahnbürste'}),
        ('tasks', {'title': 'Koffer packen'}),
        ('events', {'title': 'Flug', 'starts_at': '2026-09-24T10:00:00+02:00'}),
        ('expenses', {'title': 'Hotel', 'amount': '120.00', 'date': '2026-09-24'}),
    ],
)
def test_trip_scoped_crud_and_isolation(client, users, resource, payload):
    trip = Trip.objects.create(owner=users[0], title='Berlin Wochenende')
    other_trip = Trip.objects.create(owner=users[1], title='Fremde Reise')

    # Man kann keinen Eintrag an eine fremde Reise hängen, obwohl man die ID kennt.
    response = client.post(BASE + resource + '/', {**payload, 'trip': other_trip.pk}, format='json')
    assert response.status_code == 400

    response = client.post(BASE + resource + '/', {**payload, 'trip': trip.pk}, format='json')
    assert response.status_code == 201
    pk = response.data['id']

    assert client.get(BASE + resource + '/').data[0]['id'] == pk
    assert client.get(f'{BASE}{resource}/?trip={trip.pk}').data[0]['id'] == pk
    assert client.get(f'{BASE}{resource}/?trip={other_trip.pk}').data == []

    client.force_authenticate(users[1])
    assert client.get(BASE + resource + '/').data == []
    assert client.get(f'{BASE}{resource}/{pk}/').status_code == 404

    client.force_authenticate(users[0])
    assert client.delete(f'{BASE}{resource}/{pk}/').status_code == 204


def test_trip_scoped_validation(client, users):
    trip = Trip.objects.create(owner=users[0], title='Berlin Wochenende')
    assert client.post(BASE + 'events/', {'title': 'x', 'trip': trip.pk}, format='json').status_code == 400
    assert client.post(
        BASE + 'events/',
        {'title': 'x', 'trip': trip.pk, 'starts_at': '2026-09-24T10:00:00Z', 'ends_at': '2026-09-24T09:00:00Z'},
        format='json',
    ).status_code == 400
    assert client.post(
        BASE + 'expenses/', {'title': 'x', 'trip': trip.pk, 'amount': '-5', 'date': '2026-09-24'}, format='json'
    ).status_code == 400


def test_trip_summary_fields(client, users):
    trip = Trip.objects.create(owner=users[0], title='Berlin Wochenende', budget_amount='200.00')
    PackingItem.objects.create(trip=trip, title='Zahnbürste', is_packed=True)
    PackingItem.objects.create(trip=trip, title='Kamm')
    TripTask.objects.create(trip=trip, title='Koffer packen')
    TripTask.objects.create(trip=trip, title='Ticket kaufen', status=TripTask.Status.DONE)
    TripEvent.objects.create(trip=trip, title='Flug', starts_at='2026-09-24T10:00:00Z')
    TripExpense.objects.create(trip=trip, title='Hotel', amount='80.00', date='2026-09-24')

    data = client.get(f'{BASE}trips/{trip.pk}/').data
    assert data['packing_total'] == 2
    assert data['packing_packed'] == 1
    assert data['tasks_total'] == 2
    assert data['tasks_open'] == 1
    assert data['events_count'] == 1
    assert data['budget_spent'] == '80.00'


@pytest.mark.parametrize('resource', ['trips', 'packing-items', 'tasks', 'events', 'expenses'])
def test_requires_login(resource):
    assert APIClient().get(BASE + resource + '/').status_code == 401
