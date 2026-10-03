"""Konto endgültig löschen (core/auth_views.py ProfileView.delete) — DELETE /api/v1/auth/me/."""

import pytest
from django.contrib.auth import get_user_model
from django.test import Client

from core.models import Contact, Household, HouseholdMembership
from reisen.models import Trip

pytestmark = pytest.mark.django_db

PASSWORD = 'Sicher123!x'


@pytest.fixture
def user():
    return get_user_model().objects.create_user(username='nora@example.com', email='nora@example.com', password=PASSWORD, first_name='Nora')


def sign_in(email, password=PASSWORD):
    client = Client()
    response = client.post('/api/v1/auth/login/', {'email': email, 'password': password}, content_type='application/json')
    assert response.status_code == 200, response.content
    return client, response.json()['access']


def call(client, path, token, method='delete'):
    return getattr(client, method)(path, HTTP_AUTHORIZATION=f'Bearer {token}', content_type='application/json')


def test_deleting_the_account_removes_the_user_and_clears_the_refresh_cookie(user):
    client, token = sign_in('nora@example.com')
    response = call(client, '/api/v1/auth/me/', token)
    assert response.status_code == 204

    User = get_user_model()
    assert not User.objects.filter(email='nora@example.com').exists()
    # Das Refresh-Cookie wird genauso gelöscht wie bei einem normalen Abmelden (siehe LogoutView).
    assert response.cookies['refresh_token']['max-age'] == 0


def test_a_deleted_accounts_old_access_token_is_rejected_afterwards(user):
    client, token = sign_in('nora@example.com')
    call(client, '/api/v1/auth/me/', token)

    again = call(client, '/api/v1/auth/me/', token, method='get')
    assert again.status_code == 401


def test_deleting_the_account_cascades_owned_data_but_leaves_shared_data_for_others(user):
    other = get_user_model().objects.create_user(username='partner@example.com', password=PASSWORD, first_name='Partner')

    household = Household.objects.create(name='Geteilter Haushalt')
    HouseholdMembership.objects.create(user=user, household=household, role=HouseholdMembership.Role.ADMIN)
    HouseholdMembership.objects.create(user=other, household=household)
    Contact.objects.create(owner=user, other=other)
    own_trip = Trip.objects.create(owner=user, title='Soloreise', start_date='2026-11-01', end_date='2026-11-03')

    client, token = sign_in('nora@example.com')
    assert call(client, '/api/v1/auth/me/', token).status_code == 204

    # Eigene Daten sind weg.
    assert not Trip.objects.filter(pk=own_trip.pk).exists()
    assert not Contact.objects.filter(owner=user).exists()
    assert not HouseholdMembership.objects.filter(user=user).exists()

    # Der geteilte Haushalt und die Mitgliedschaft der anderen Person bestehen weiter.
    assert Household.objects.filter(pk=household.pk).exists()
    assert HouseholdMembership.objects.filter(user=other, household=household).exists()


def test_requires_authentication(client: Client):
    assert client.delete('/api/v1/auth/me/').status_code == 401
