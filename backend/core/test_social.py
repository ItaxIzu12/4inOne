"""Anmeldung mit Google und Apple: der ganze Ablauf und jeder Angriff, den er abwehren muss (core/social*.py).

Die ID-Token signieren die Tests selbst mit einem eigenen RSA-Schlüssel; der Schlüsselabruf beim Anbieter (JWKS) und
der Code-Tausch sind ersetzt — geprüft wird die echte Verifikation (Signatur, Aussteller, Empfänger, Zeit, Nonce).
"""

import time
from unittest import mock
from urllib.parse import parse_qs, urlsplit

import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec, rsa
from django.contrib.auth import get_user_model
from django.core import signing
from django.test import Client
from django_otp.oath import TOTP
from django_otp.plugins.otp_totp.models import TOTPDevice

from core import social
from core.models import SocialAccount, UserSession

pytestmark = pytest.mark.django_db
PASSWORD = 'Sicher123!x'
KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
OTHER_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
GOOGLE_ID = 'test-client.apps.googleusercontent.com'


@pytest.fixture(autouse=True)
def google(settings):
    settings.GOOGLE_OAUTH_CLIENT_ID = GOOGLE_ID
    settings.GOOGLE_OAUTH_CLIENT_SECRET = 'test-secret'
    settings.FRONTEND_URL = 'http://localhost:4200'
    settings.OAUTH_CALLBACK_BASE = 'http://localhost:8000'
    with mock.patch.object(social, '_signing_key', return_value=KEY.public_key()):
        yield


def id_token(nonce, *, key=KEY, sub='google-sub-1', email='lena@example.com', verified=True, aud=GOOGLE_ID,
             iss='https://accounts.google.com', exp_in=600, alg='RS256', **extra):
    now = int(time.time())
    claims = {'iss': iss, 'aud': aud, 'sub': sub, 'email': email, 'email_verified': verified, 'iat': now,
              'exp': now + exp_in, 'nonce': nonce, 'given_name': 'Lena', **extra}
    return jwt.encode(claims, key, algorithm=alg)


def start(client, provider='google'):
    response = client.get(f'/api/v1/auth/oauth/{provider}/start/')
    assert response.status_code == 302, response.status_code
    flow = signing.loads(client.cookies['oauth_flow'].value, salt='4inone.oauth.flow')
    return response, flow


def callback(client, flow, token, *, state=None, provider='google', method='get', **params):
    with mock.patch.object(social, 'exchange_code', return_value=token) as exchange:
        data = {'code': 'auth-code', 'state': state if state is not None else flow['state'], **params}
        response = getattr(client, method)(f'/api/v1/auth/oauth/{provider}/callback/', data)
    return response, exchange


def query(response):
    return parse_qs(urlsplit(response['Location']).query)


def make_user(email='lena@example.com', **extra):
    return get_user_model().objects.create_user(username=email, email=email, password=PASSWORD, first_name='Lena', **extra)


def totp(user):
    device = TOTPDevice.objects.create(user=user, name='Telefon', confirmed=True)
    return lambda: f'{TOTP(device.bin_key, device.step, device.t0, device.digits, device.drift).token():06d}'


# --------------------------------------------------------------------------- Konfiguration und Start


def test_providers_only_when_configured(settings):
    assert Client().get('/api/v1/auth/oauth/providers/').json() == {'google': True, 'apple': False}
    settings.GOOGLE_OAUTH_CLIENT_SECRET = ''
    assert Client().get('/api/v1/auth/oauth/providers/').json() == {'google': False, 'apple': False}
    assert Client().get('/api/v1/auth/oauth/google/start/').status_code == 404
    assert Client().get('/api/v1/auth/oauth/facebook/start/').status_code == 404


def test_start_redirects_with_state_nonce_and_pkce_bound_to_this_browser():
    client = Client()
    response, flow = start(client)
    target = urlsplit(response['Location'])
    params = parse_qs(target.query)
    assert target.netloc == 'accounts.google.com'
    assert params['client_id'] == [GOOGLE_ID]
    assert params['redirect_uri'] == ['http://localhost:8000/api/v1/auth/oauth/google/callback/']
    assert params['state'] == [flow['state']] and params['nonce'] == [flow['nonce']]
    assert params['code_challenge_method'] == ['S256'] and params['code_challenge'] == [social._challenge(flow['verifier'])]
    assert 'verifier' not in response['Location'] and flow['verifier'] not in response['Location']
    cookie = client.cookies['oauth_flow']
    assert cookie['httponly'] and cookie['samesite'] == 'Lax' and cookie['path'] == '/api/v1/auth/oauth/'


# --------------------------------------------------------------------------- Neues und bekanntes Konto


def test_new_google_user_gets_an_account_with_verified_email_and_no_password():
    client = Client()
    _, flow = start(client)
    response, exchange = callback(client, flow, id_token(flow['nonce']))
    assert query(response) == {'social': ['neu']}
    assert exchange.call_args[0] == ('google', 'auth-code', flow['verifier'])  # PKCE-Verifier geht mit
    user = get_user_model().objects.get(email='lena@example.com')
    assert user.first_name == 'Lena' and not user.has_usable_password()
    assert SocialAccount.objects.get(user=user).subject == 'google-sub-1'
    from core.email_verification import is_verified
    assert is_verified(user)
    assert user.householdmembership_set.count() == 1  # eigener Haushalt wie bei der Registrierung
    assert response.cookies['refresh_token'].value and response.cookies['refresh_token']['httponly']
    assert response.cookies['oauth_flow'].value == ''  # Ablauf-Cookie verbraucht
    # Das Frontend holt sich danach das Access-Token
    assert client.post('/api/v1/auth/refresh/').status_code == 200


def test_known_google_account_logs_in():
    user = make_user()
    SocialAccount.objects.create(user=user, provider='google', subject='google-sub-1', email=user.email)
    client = Client()
    _, flow = start(client)
    response, _ = callback(client, flow, id_token(flow['nonce']))
    assert query(response) == {'social': ['ok']}
    assert UserSession.objects.filter(user=user).count() == 1
    assert SocialAccount.objects.get(user=user).last_used_at is not None


def test_new_email_from_provider_is_lowercased_and_account_matched_by_sub_not_email():
    user = make_user('anna@example.com')
    SocialAccount.objects.create(user=user, provider='google', subject='google-sub-1', email='anna@example.com')
    client = Client()
    _, flow = start(client)
    # E-Mail beim Anbieter geändert — gleiche sub → gleiches Konto, kein neues
    response, _ = callback(client, flow, id_token(flow['nonce'], email='Anna.Neu@Example.com'))
    assert query(response) == {'social': ['ok']}
    assert get_user_model().objects.count() == 1


# --------------------------------------------------------------------------- Angriffe auf den Ablauf


def test_login_csrf_wrong_state_or_missing_cookie_is_rejected():
    client = Client()
    _, flow = start(client)
    response, exchange = callback(client, flow, id_token(flow['nonce']), state='vom-angreifer')
    assert query(response) == {'fehler': ['abgelaufen']} and not exchange.called
    # fremder Browser ohne Ablauf-Cookie (z. B. untergeschobener Rückruf-Link)
    response, exchange = callback(Client(), flow, id_token(flow['nonce']))
    assert query(response) == {'fehler': ['abgelaufen']} and not exchange.called
    assert get_user_model().objects.count() == 0


def test_tampered_flow_cookie_is_rejected():
    client = Client()
    _, flow = start(client)
    client.cookies['oauth_flow'] = client.cookies['oauth_flow'].value[:-3] + 'abc'
    response, exchange = callback(client, flow, id_token(flow['nonce']))
    assert query(response) == {'fehler': ['abgelaufen']} and not exchange.called


def test_user_cancel_at_provider():
    client = Client()
    _, flow = start(client)
    response, exchange = callback(client, flow, '', error='access_denied')
    assert query(response) == {'fehler': ['abgebrochen']} and not exchange.called


@pytest.mark.parametrize('variant,code', [
    ({'key': OTHER_KEY}, 'token'),                       # falsche Signatur
    ({'aud': 'fremde-app'}, 'token'),                    # Token für eine andere App
    ({'iss': 'https://boese.example'}, 'token'),         # falscher Aussteller
    ({'exp_in': -120}, 'token'),                         # abgelaufen
    ({'nonce_override': 'alte-nonce'}, 'token'),         # Wiedereinspielen eines alten Tokens
    ({'verified': False}, 'email'),                      # unbestätigte E-Mail
    ({'email': ''}, 'email'),
])
def test_every_forged_or_unsafe_id_token_is_rejected(variant, code):
    client = Client()
    _, flow = start(client)
    nonce = variant.pop('nonce_override', flow['nonce'])
    response, _ = callback(client, flow, id_token(nonce, **variant))
    assert query(response) == {'fehler': [code]}
    assert get_user_model().objects.count() == 0 and 'refresh_token' not in response.cookies


def test_unsigned_alg_none_token_is_rejected():
    client = Client()
    _, flow = start(client)
    now = int(time.time())
    unsigned = jwt.encode({'iss': 'https://accounts.google.com', 'aud': GOOGLE_ID, 'sub': 'x', 'email': 'x@example.com',
                           'email_verified': True, 'iat': now, 'exp': now + 600, 'nonce': flow['nonce']}, None, algorithm='none')
    response, _ = callback(client, flow, unsigned)
    assert query(response) == {'fehler': ['token']}


def test_inactive_account_cannot_log_in():
    user = make_user(is_active=False)
    SocialAccount.objects.create(user=user, provider='google', subject='google-sub-1')
    client = Client()
    _, flow = start(client)
    response, _ = callback(client, flow, id_token(flow['nonce']))
    assert query(response) == {'fehler': ['gesperrt']}


# --------------------------------------------------------------------------- Bestehendes Konto: nur mit Passwort


def test_existing_email_is_never_linked_without_the_accounts_password():
    user = make_user()
    client = Client()
    _, flow = start(client)
    response, _ = callback(client, flow, id_token(flow['nonce']))
    assert query(response) == {'social': ['verknuepfen']}
    assert 'refresh_token' not in response.cookies and not UserSession.objects.exists()
    assert not SocialAccount.objects.exists()
    pending = client.get('/api/v1/auth/oauth/pending/').json()
    assert pending == {'step': 'link', 'provider': 'google', 'email': 'l•••@example.com', 'has_password': True}

    assert client.post('/api/v1/auth/oauth/link/', {'password': 'falsch'}, content_type='application/json').status_code == 401
    assert not SocialAccount.objects.exists()
    ok = client.post('/api/v1/auth/oauth/link/', {'password': PASSWORD}, content_type='application/json')
    assert ok.status_code == 200 and ok.json()['access'] and ok.cookies['refresh_token'].value
    assert SocialAccount.objects.get(user=user).subject == 'google-sub-1'
    assert client.get('/api/v1/auth/oauth/pending/').json() == {'step': None}  # verbraucht
    # Ab jetzt direkt
    client2 = Client()
    _, flow2 = start(client2)
    assert query(callback(client2, flow2, id_token(flow2['nonce']))[0]) == {'social': ['ok']}


def test_link_also_requires_the_second_factor_when_enabled():
    user = make_user()
    code = totp(user)
    client = Client()
    _, flow = start(client)
    callback(client, flow, id_token(flow['nonce']))
    assert client.post('/api/v1/auth/oauth/link/', {'password': PASSWORD}, content_type='application/json').json() == {'mfa_required': True}
    assert not SocialAccount.objects.exists()
    ok = client.post('/api/v1/auth/oauth/link/', {'password': PASSWORD, 'mfa_code': code()}, content_type='application/json')
    assert ok.status_code == 200
    assert UserSession.objects.get(user=user).mfa_verified is True


def test_pending_cookie_cannot_be_forged_to_take_over_another_account():
    victim = make_user('opfer@example.com')
    client = Client()
    client.cookies['oauth_pending'] = signing.dumps({'step': 'link', 'provider': 'google', 'sub': 'x', 'email': victim.email,
                                                     'user': victim.pk}, salt='falsches-salz')
    assert client.get('/api/v1/auth/oauth/pending/').json() == {'step': None}
    assert client.post('/api/v1/auth/oauth/link/', {'password': PASSWORD}, content_type='application/json').status_code == 400


def test_a_provider_identity_linked_elsewhere_cannot_be_linked_again():
    other = make_user('max@example.com')
    SocialAccount.objects.create(user=other, provider='google', subject='google-sub-1')
    make_user()
    client = Client()
    client.cookies['oauth_pending'] = signing.dumps({'step': 'link', 'provider': 'google', 'sub': 'google-sub-1',
                                                     'email': 'lena@example.com', 'user': get_user_model().objects.get(email='lena@example.com').pk},
                                                    salt='4inone.oauth.pending', compress=True)
    assert client.post('/api/v1/auth/oauth/link/', {'password': PASSWORD}, content_type='application/json').status_code == 409


# --------------------------------------------------------------------------- Zwei-Faktor gilt auch hier


def test_linked_account_with_two_factor_needs_the_code():
    user = make_user()
    code = totp(user)
    SocialAccount.objects.create(user=user, provider='google', subject='google-sub-1')
    client = Client()
    _, flow = start(client)
    response, _ = callback(client, flow, id_token(flow['nonce']))
    assert query(response) == {'social': ['zwei-faktor']}
    assert 'refresh_token' not in response.cookies and not UserSession.objects.exists()
    assert client.post('/api/v1/auth/oauth/mfa/', {'code': '000000'}, content_type='application/json').status_code == 401
    TOTPDevice.objects.update(throttling_failure_count=0, throttling_failure_timestamp=None)  # django-otp sperrt kurz nach Fehlversuch
    ok = client.post('/api/v1/auth/oauth/mfa/', {'code': code()}, content_type='application/json')
    assert ok.status_code == 200 and UserSession.objects.get(user=user).mfa_verified is True
    assert client.post('/api/v1/auth/oauth/mfa/', {'code': code()}, content_type='application/json').status_code == 400  # verbraucht


# --------------------------------------------------------------------------- Apple


@pytest.fixture
def apple(settings, tmp_path):
    key = ec.generate_private_key(ec.SECP256R1())
    path = tmp_path / 'AuthKey_TEST.p8'
    path.write_bytes(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
    settings.APPLE_CLIENT_ID, settings.APPLE_TEAM_ID, settings.APPLE_KEY_ID = 'de.4inone.web', 'TEAM123456', 'KEY1234567'
    settings.APPLE_PRIVATE_KEY_PATH = str(path)
    return key


def test_apple_client_secret_is_a_short_lived_es256_jwt(apple):
    secret = social.client_secret('apple')
    header = jwt.get_unverified_header(secret)
    claims = jwt.decode(secret, apple.public_key(), algorithms=['ES256'], audience='https://appleid.apple.com')
    assert header['kid'] == 'KEY1234567' and claims['iss'] == 'TEAM123456' and claims['sub'] == 'de.4inone.web'
    assert claims['exp'] - claims['iat'] <= 300


def test_apple_form_post_with_name_and_string_email_verified(apple):
    client = Client()
    response, flow = start(client, 'apple')
    params = parse_qs(urlsplit(response['Location']).query)
    assert params['response_mode'] == ['form_post']
    cookie = client.cookies['oauth_flow']
    assert cookie['samesite'] == 'None' and cookie['secure']  # sonst käme Apples POST ohne Cookie an
    token = id_token(flow['nonce'], aud='de.4inone.web', iss='https://appleid.apple.com', sub='apple-sub-9',
                     email='abc123@privaterelay.appleid.com', verified='true', given_name=None)
    response, _ = callback(client, flow, token, provider='apple', method='post', user='{"name":{"firstName":"Jonas"}}')
    assert query(response) == {'social': ['neu']}
    user = get_user_model().objects.get(email='abc123@privaterelay.appleid.com')
    assert user.first_name == 'Jonas' and SocialAccount.objects.get(user=user).provider == 'apple'


def test_deleting_the_account_removes_its_linked_logins():
    user = make_user()
    SocialAccount.objects.create(user=user, provider='google', subject='google-sub-1')
    user.delete()
    assert not SocialAccount.objects.exists()


def test_odd_two_factor_input_is_rejected_cleanly_not_with_a_server_error():
    user = make_user()
    totp(user)
    SocialAccount.objects.create(user=user, provider='google', subject='google-sub-1')
    client = Client()
    _, flow = start(client)
    callback(client, flow, id_token(flow['nonce']))
    for odd in (['123456'], 123456, {'a': 1}, '', None):
        response = client.post('/api/v1/auth/oauth/mfa/', {'code': odd}, content_type='application/json')
        assert response.status_code == 401, (odd, response.status_code)


def test_two_simultaneous_callbacks_for_a_new_account_do_not_crash(monkeypatch):
    """Echter Wettlauf: Anfrage A hat das Konto schon angelegt (eigene Transaktion), Anfrage B hat es bei der ersten
    Suche noch nicht gesehen und läuft beim Anlegen auf den Eindeutigkeits-Konflikt."""
    from django.db import IntegrityError

    from core import social_views
    other = make_user()
    SocialAccount.objects.create(user=other, provider='google', subject='google-sub-1')
    real_select = SocialAccount.objects.select_related
    calls = {'n': 0}

    def first_lookup_misses(*args, **kwargs):
        calls['n'] += 1
        return SocialAccount.objects.none() if calls['n'] == 1 else real_select(*args, **kwargs)

    monkeypatch.setattr(SocialAccount.objects, 'select_related', first_lookup_misses)
    monkeypatch.setattr(social_views.get_user_model().objects, 'filter', lambda *a, **k: get_user_model()._default_manager.none())
    monkeypatch.setattr(social_views, 'create_account', lambda *a, **k: (_ for _ in ()).throw(IntegrityError('username')))
    client = Client()
    _, flow = start(client)
    response, _ = callback(client, flow, id_token(flow['nonce']))
    assert query(response) == {'social': ['ok']}
    assert UserSession.objects.filter(user=other).count() == 1
