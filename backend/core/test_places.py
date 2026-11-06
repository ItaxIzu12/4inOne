"""Ortsvorschläge (core/places.py): eigene Orte bleiben privat, nach außen geht nur der Suchtext."""

import io
import json
from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.core.cache import caches
from django.utils import timezone
from rest_framework.test import APIClient

from core import places
from organisation.models import PersonalEvent
from reisen.models import Trip

pytestmark = pytest.mark.django_db
URL = '/api/v1/places/'


class FakeResponse(io.BytesIO):
    status = 200

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


def _photon(*features):
    return json.dumps({'features': [{'properties': f} for f in features]}).encode()


@pytest.fixture(autouse=True)
def local_cache(settings):
    settings.CACHES = {**settings.CACHES, 'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}}
    caches['default'].clear()
    caches['throttle'].clear()
    yield
    caches['default'].clear()


@pytest.fixture
def anna():
    return get_user_model().objects.create_user(username='anna@example.com', email='anna@example.com', password='x-irrelevant-1A', first_name='Anna')


@pytest.fixture
def ben():
    return get_user_model().objects.create_user(username='ben@example.com', email='ben@example.com', password='x-irrelevant-1A', first_name='Ben')


def _client(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


@pytest.fixture
def calls(monkeypatch):
    seen = []

    def fake_urlopen(request, timeout):
        seen.append(request)
        return FakeResponse(_photon(
            {'name': 'Café Rosa', 'street': 'Lindenstraße', 'housenumber': '4', 'postcode': '10115', 'city': 'Berlin', 'country': 'Deutschland'},
            {'name': 'Rosa-Luxemburg-Platz', 'city': 'Berlin', 'country': 'Deutschland'},
        ))

    monkeypatch.setattr(places.urllib.request, 'urlopen', fake_urlopen)
    return seen


def test_own_places_are_suggested_and_never_someone_elses(anna, ben, calls):
    soon = timezone.now() + timedelta(days=1)
    PersonalEvent.objects.create(owner=anna, title='Zahnarzt', starts_at=soon, location='Praxis Dr. Weber')
    PersonalEvent.objects.create(owner=anna, title='Sport', starts_at=soon, location='Sporthalle Nord')
    PersonalEvent.objects.create(owner=ben, title='Geheim', starts_at=soon, location='Praxis Dr. Geheim')
    Trip.objects.create(owner=anna, title='Rom', destination='Rom', departure='Düsseldorf', start_date='2026-12-01', end_date='2026-12-05')

    data = _client(anna).get(URL, {'q': 'pra'}).json()
    assert data['own'] == ['Praxis Dr. Weber']
    assert 'Praxis Dr. Geheim' not in str(data)
    all_own = _client(anna).get(URL, {'q': ''}).json()['own']
    assert set(all_own) == {'Praxis Dr. Weber', 'Sporthalle Nord', 'Rom', 'Düsseldorf'}


def test_only_the_search_text_leaves_the_server(anna, calls):
    PersonalEvent.objects.create(owner=anna, title='Termin', starts_at=timezone.now(), location='Geheimweg 1')
    data = _client(anna).get(URL, {'q': 'Café Ro'}).json()
    assert data['external_ok'] is True
    assert data['places'][0] == {'name': 'Café Rosa', 'detail': 'Lindenstraße 4, 10115 Berlin, Deutschland', 'area': 'Berlin'}
    assert len(calls) == 1
    sent = calls[0]
    assert sent.full_url.startswith('https://photon.komoot.io/api/?')
    assert 'q=Caf%C3%A9+Ro' in sent.full_url
    for secret in ('anna', 'example.com', 'Geheimweg'):
        assert secret not in sent.full_url and secret not in str(sent.headers)
    assert 'Cookie' not in sent.headers and 'Authorization' not in sent.headers


def test_short_queries_stay_local_and_repeats_use_the_cache(anna, calls):
    client = _client(anna)
    assert client.get(URL, {'q': 'Ca'}).json()['places'] == []
    assert calls == []
    client.get(URL, {'q': 'Café'})
    client.get(URL, {'q': 'café'})
    assert len(calls) == 1


def test_provider_failure_or_switch_off_keeps_own_places_working(anna, monkeypatch, settings):
    PersonalEvent.objects.create(owner=anna, title='Sport', starts_at=timezone.now(), location='Sporthalle Nord')

    def broken(request, timeout):
        raise TimeoutError

    monkeypatch.setattr(places.urllib.request, 'urlopen', broken)
    data = _client(anna).get(URL, {'q': 'Sporthalle'}).json()
    assert data == {'own': ['Sporthalle Nord'], 'places': [], 'external_ok': False}

    settings.PLACES_PROVIDER_URL = ''
    data = _client(anna).get(URL, {'q': 'Sporthalle Süd'}).json()
    assert data['places'] == [] and data['external_ok'] is True


def test_anonymous_requests_are_rejected_and_input_is_cleaned(anna, calls):
    assert APIClient().get(URL, {'q': 'Berlin'}).status_code in (401, 403)
    long = 'B' * 500 + '\x00\x07'
    response = _client(anna).get(URL, {'q': long})
    assert response.status_code == 200
    assert response['Cache-Control'] == 'no-store'
    sent = calls[0].full_url
    assert '%00' not in sent and sent.count('B') == places.MAX_QUERY


def test_requests_per_person_are_limited(anna, calls, settings):
    settings.REST_FRAMEWORK = {**settings.REST_FRAMEWORK, 'DEFAULT_THROTTLE_RATES': {**settings.REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'], 'places': '3/min'}}
    from core.place_views import PlacesRateThrottle

    PlacesRateThrottle.THROTTLE_RATES = settings.REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']
    client = _client(anna)
    codes = [client.get(URL, {'q': f'Ort {i}'}).status_code for i in range(4)]
    assert codes == [200, 200, 200, 429]


def test_lodging_search_filters_to_accommodation_near_the_destination(anna, ben, monkeypatch):
    seen = []

    def fake_urlopen(request, timeout):
        seen.append(request.full_url)
        return FakeResponse(_photon({'name': 'Hotel Central', 'street': 'Friedrichstraße', 'housenumber': '1',
                                     'postcode': '10117', 'city': 'Berlin', 'district': 'Mitte', 'country': 'Deutschland'}))

    monkeypatch.setattr(places.urllib.request, 'urlopen', fake_urlopen)
    Trip.objects.create(owner=anna, title='Rom', destination='Rom', accommodation='Hotel Roma', start_date='2026-12-01', end_date='2026-12-05')
    Trip.objects.create(owner=ben, title='Paris', destination='Paris', accommodation='Hotel Geheim', start_date='2026-12-01', end_date='2026-12-05')
    PersonalEvent.objects.create(owner=anna, title='Zahnarzt', starts_at=timezone.now(), location='Hotelfachschule')

    data = _client(anna).get(URL, {'q': 'Hotel', 'kind': 'lodging', 'near': 'Berlin'}).json()
    assert data['own'] == ['Hotel Roma']  # nur frühere Unterkünfte — keine Terminorte, nichts von Ben
    assert data['places'] == [{'name': 'Hotel Central', 'detail': 'Friedrichstraße 1, 10117 Berlin, Deutschland', 'area': 'Berlin Mitte'}]
    url = seen[0]
    assert 'q=Hotel+Berlin' in url and 'osm_tag=tourism%3Ahotel' in url and 'osm_tag=tourism%3Aapartment' in url

    # Reiseziel steht schon im Suchtext → nicht doppelt; unbekannte Art → normale Ortssuche
    _client(anna).get(URL, {'q': 'Hotel Berlin Mitte', 'kind': 'lodging', 'near': 'Berlin'})
    assert 'q=Hotel+Berlin+Mitte&' in seen[1]
    _client(anna).get(URL, {'q': 'Alexanderplatz', 'kind': 'evil'})
    assert 'osm_tag' not in seen[2]
