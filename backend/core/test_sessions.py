"""Aktive Sitzungen (Geräte) und Profil unter /api/v1/auth/."""

import pytest
from django.contrib.auth import get_user_model
from django.test import Client

from core.models import UserSession

pytestmark = pytest.mark.django_db

PASSWORD = 'Sicher123!x'
AGENT_A = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605 Version/17.0 Safari/605'
AGENT_B = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605 Version/17.0 Mobile Safari/604'


@pytest.fixture
def user():
    return get_user_model().objects.create_user(username='mira@example.com', email='mira@example.com', password=PASSWORD, first_name='Mira')


def sign_in(agent, email='mira@example.com'):
    client = Client(HTTP_USER_AGENT=agent)
    response = client.post('/api/v1/auth/login/', {'email': email, 'password': PASSWORD}, content_type='application/json')
    assert response.status_code == 200, response.content
    return client, response.json()['access']


def get(client, path, token, method='get'):
    return getattr(client, method)(path, HTTP_AUTHORIZATION=f'Bearer {token}', content_type='application/json')


def test_login_records_the_device_and_marks_it_as_current(user):
    client, token = sign_in(AGENT_A)
    rows = get(client, '/api/v1/auth/sessions/', token).json()
    assert len(rows) == 1
    assert rows[0]['current'] is True and rows[0]['device'] == AGENT_A
    assert set(rows[0]) == {'id', 'device', 'created_at', 'last_seen', 'current'}   # keine IP, kein Token


def test_two_devices_are_listed_and_only_the_asking_one_is_current(user):
    a, token_a = sign_in(AGENT_A)
    b, token_b = sign_in(AGENT_B)
    rows = get(a, '/api/v1/auth/sessions/', token_a).json()
    assert [r['current'] for r in rows if r['device'] == AGENT_A] == [True]
    assert [r['current'] for r in rows if r['device'] == AGENT_B] == [False]
    rows_b = get(b, '/api/v1/auth/sessions/', token_b).json()
    assert [r['device'] for r in rows_b if r['current']] == [AGENT_B]


def test_refresh_keeps_the_session_and_follows_the_new_token(user):
    client, token = sign_in(AGENT_A)
    before = UserSession.objects.get()
    assert client.post('/api/v1/auth/refresh/', content_type='application/json').status_code == 200
    after = UserSession.objects.get()
    assert after.sid == before.sid and after.current_jti != before.current_jti
    assert len(get(client, '/api/v1/auth/sessions/', token).json()) == 1        # nicht doppelt


def test_revoking_another_device_stops_its_refresh(user):
    a, token_a = sign_in(AGENT_A)
    b, _ = sign_in(AGENT_B)
    other = next(r for r in get(a, '/api/v1/auth/sessions/', token_a).json() if not r['current'])
    assert get(a, f"/api/v1/auth/sessions/{other['id']}/", token_a, 'delete').status_code == 204
    assert b.post('/api/v1/auth/refresh/', content_type='application/json').status_code == 401   # das andere Gerät ist abgemeldet
    assert a.post('/api/v1/auth/refresh/', content_type='application/json').status_code == 200   # dieses bleibt
    assert len(get(a, '/api/v1/auth/sessions/', token_a).json()) == 1


def test_the_current_device_is_signed_out_with_logout_not_here(user):
    a, token_a = sign_in(AGENT_A)
    own = get(a, '/api/v1/auth/sessions/', token_a).json()[0]['id']
    assert get(a, f'/api/v1/auth/sessions/{own}/', token_a, 'delete').status_code == 400
    assert UserSession.objects.count() == 1


def test_sign_out_all_others_keeps_this_device(user):
    a, token_a = sign_in(AGENT_A)
    b, _ = sign_in(AGENT_B)
    c, _ = sign_in(AGENT_B)
    assert get(a, '/api/v1/auth/sessions/', token_a, 'delete').status_code == 204
    rows = get(a, '/api/v1/auth/sessions/', token_a).json()
    assert len(rows) == 1 and rows[0]['current'] is True
    assert b.post('/api/v1/auth/refresh/', content_type='application/json').status_code == 401
    assert c.post('/api/v1/auth/refresh/', content_type='application/json').status_code == 401


def test_logout_removes_the_session(user):
    a, token_a = sign_in(AGENT_A)
    assert get(a, '/api/v1/auth/logout/', token_a, 'post').status_code == 204
    assert UserSession.objects.count() == 0


def test_sessions_are_private_and_need_a_login(user):
    other = get_user_model().objects.create_user(username='x@example.com', email='x@example.com', password=PASSWORD, first_name='X')
    _, token_other = sign_in(AGENT_A, 'x@example.com')
    a, token_a = sign_in(AGENT_B)
    foreign = UserSession.objects.get(user=other)
    assert get(a, f'/api/v1/auth/sessions/{foreign.sid}/', token_a, 'delete').status_code == 404
    assert UserSession.objects.filter(pk=foreign.pk).exists()
    assert all(r['device'] == AGENT_B for r in get(a, '/api/v1/auth/sessions/', token_a).json())
    assert Client().get('/api/v1/auth/sessions/').status_code == 401


def test_profile_name_can_be_changed_but_not_the_email(user):
    client, token = sign_in(AGENT_A)
    assert get(client, '/api/v1/auth/me/', token).json() == {'name': 'Mira', 'email': 'mira@example.com'}
    response = client.patch('/api/v1/auth/me/', {'name': ' Mira Neu ', 'email': 'evil@example.com'}, content_type='application/json', HTTP_AUTHORIZATION=f'Bearer {token}')
    assert response.status_code == 200 and response.json() == {'name': 'Mira Neu', 'email': 'mira@example.com'}
    user.refresh_from_db()
    assert user.first_name == 'Mira Neu' and user.email == 'mira@example.com' and user.username == 'mira@example.com'
    short = client.patch('/api/v1/auth/me/', {'name': 'M'}, content_type='application/json', HTTP_AUTHORIZATION=f'Bearer {token}')
    assert short.status_code == 400
    assert Client().patch('/api/v1/auth/me/', {'name': 'Zwei'}, content_type='application/json').status_code == 401
