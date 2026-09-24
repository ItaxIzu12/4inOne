import pytest
from django.test import Client
from django.contrib.auth import get_user_model
from core.models import HouseholdMembership

pytestmark = pytest.mark.django_db


def payload(**changes):
    return dict(name='Sophie', email='sophie@example.com', password='Sicher123!x', confirm_password='Sicher123!x', accept_privacy=True, **changes)


@pytest.mark.parametrize('field,value', [('confirm_password', 'anders12345'), ('accept_privacy', False), ('name', ' ')])
def test_registration_rejects_invalid_required_fields(field, value):
    data = payload()
    data[field] = value
    response = Client().post('/api/v1/auth/register/', data, content_type='application/json')
    assert response.status_code == 400
    assert field in response.json()
    assert not get_user_model().objects.exists()


@pytest.mark.parametrize('field', ['confirm_password', 'accept_privacy', 'name'])
def test_registration_requires_fields_even_without_frontend(field):
    data = payload()
    del data[field]
    assert Client().post('/api/v1/auth/register/', data, content_type='application/json').status_code == 400


def csrf_client():
    client = Client(enforce_csrf_checks=True)
    token = client.get('/api/v1/auth/csrf/').json()['csrfToken']
    return client, token


def test_cookie_auth_rejects_missing_csrf_on_all_mutations():
    client = Client(enforce_csrf_checks=True)
    for endpoint in ('register', 'login', 'refresh', 'logout'):
        assert client.post(f'/api/v1/auth/{endpoint}/', payload(), content_type='application/json').status_code == 403


def test_csrf_registration_login_refresh_logout_and_revocation():
    client, token = csrf_client()
    headers = {'HTTP_X_CSRFTOKEN': token}
    response = client.post('/api/v1/auth/register/', payload(), content_type='application/json', **headers)
    assert response.status_code == 201
    assert response.cookies['refresh_token']['httponly']
    membership = HouseholdMembership.objects.get(user__email='sophie@example.com')
    assert membership.household.members.count() == 1
    response = client.post('/api/v1/auth/login/', {'email':'SOPHIE@example.com', 'password':'Sicher123!x', 'remember':False}, content_type='application/json', **headers)
    assert response.status_code == 200
    assert not response.cookies['refresh_token']['max-age']
    response = client.post('/api/v1/auth/refresh/', {}, content_type='application/json', **headers)
    assert response.status_code == 200
    access = response.json()['access']
    refresh = client.cookies['refresh_token'].value
    assert client.post('/api/v1/auth/logout/', {}, content_type='application/json', HTTP_AUTHORIZATION=f'Bearer {access}', **headers).status_code == 204
    client.cookies['refresh_token'] = refresh
    assert client.post('/api/v1/auth/refresh/', {}, content_type='application/json', **headers).status_code == 401


def test_foreign_origin_is_rejected_even_with_valid_csrf_token():
    client, token = csrf_client()
    assert client.post('/api/v1/auth/register/', payload(), content_type='application/json', HTTP_X_CSRFTOKEN=token, HTTP_ORIGIN='https://untrusted.example').status_code == 403
