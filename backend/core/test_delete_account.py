"""Konto endgültig löschen (core/auth_views.py ProfileView.delete) — DELETE /api/v1/auth/me/."""

import json

import pytest
from django.contrib.auth import get_user_model
from django.test import Client

from core.models import Contact, Household, HouseholdMembership
from reisen.models import Trip

pytestmark = pytest.mark.django_db

PASSWORD = 'Sicher-Wald-27x'


@pytest.fixture
def user():
    return get_user_model().objects.create_user(username='nora@example.com', email='nora@example.com', password=PASSWORD, first_name='Nora')


def sign_in(email, password=PASSWORD):
    client = Client()
    response = client.post('/api/v1/auth/login/', {'email': email, 'password': password}, content_type='application/json')
    assert response.status_code == 200, response.content
    return client, response.json()['access']


def call(client, path, token, method='delete', data=None):
    if method == 'delete' and data is None:
        data = {'password': PASSWORD}  # Löschen braucht die Bestätigung mit dem Passwort
    kwargs = {'data': json.dumps(data)} if data is not None else {}
    return getattr(client, method)(path, HTTP_AUTHORIZATION=f'Bearer {token}', content_type='application/json', **kwargs)


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


def test_deleting_needs_the_password_wrong_or_missing_keeps_everything(user):
    client, token = sign_in('nora@example.com')
    for data in ({}, {'password': ''}, {'password': 'falsch-Passwort-1!'}, {'password': ['x']}):
        response = call(client, '/api/v1/auth/me/', token, data=data)
        assert response.status_code == 400, data
        assert 'password' in response.json()
    assert get_user_model().objects.filter(email='nora@example.com').exists()


def test_accounts_without_password_confirm_with_their_email(user):
    user.set_unusable_password()
    user.save()
    from rest_framework.test import APIClient

    client = APIClient()
    client.force_authenticate(user)
    assert client.delete('/api/v1/auth/me/', {'confirm_email': 'andere@example.com'}, format='json').status_code == 400
    assert client.get('/api/v1/auth/me/').json()['has_password'] is False
    assert client.delete('/api/v1/auth/me/', {'confirm_email': ' Nora@Example.com '}, format='json').status_code == 204
    assert not get_user_model().objects.filter(email='nora@example.com').exists()


def test_password_guessing_via_account_deletion_is_rate_limited(user, settings):
    from django.core.cache import cache

    cache.clear()
    client, token = sign_in('nora@example.com')
    statuses = [call(client, '/api/v1/auth/me/', token, data={'password': f'falsch-{i}'}).status_code for i in range(8)]
    assert 429 in statuses
    assert get_user_model().objects.filter(email='nora@example.com').exists()
