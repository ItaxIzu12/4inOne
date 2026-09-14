"""POST /api/v1/finanzen/kategorien/ — eigene, zusätzliche Kategorien über
die drei automatisch erzeugten Standard-Kategorien hinaus anlegen (siehe
Chat-Verlauf). finanzen/serializers.py CategorySerializer.validate_name/
validate_icon_key, finanzen/views.py CategoryViewSet.perform_create."""

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from core.models import Household, HouseholdMembership
from finanzen.models import Category

pytestmark = pytest.mark.django_db


def _client_for_new_household():
    User = get_user_model()
    user = User.objects.create_user(username='category-creator@example.com', password='irrelevant-for-test')
    household = Household.objects.create(name='Testhaushalt')
    HouseholdMembership.objects.create(user=user, household=household)
    client = APIClient()
    client.force_authenticate(user=user)
    return client, household


def _valid_payload(**overrides):
    payload = {'name': 'Freizeit', 'color': '#2f7fd1', 'icon_key': 'freizeit'}
    payload.update(overrides)
    return payload


def test_creating_a_category_with_valid_data_succeeds_and_appears_alongside_the_defaults():
    client, household = _client_for_new_household()

    response = client.post('/api/v1/finanzen/kategorien/', _valid_payload(), format='json')

    assert response.status_code == 201
    assert response.data['name'] == 'Freizeit'
    assert response.data['color'] == '#2f7fd1'
    assert response.data['icon_key'] == 'freizeit'
    assert response.data['is_default'] is False
    # Weiterhin genau 3 Standard- + 1 neue = 4 Kategorien im Haushalt.
    assert Category.objects.filter(household=household).count() == 4


def test_duplicate_category_name_within_the_same_household_is_rejected():
    client, household = _client_for_new_household()
    Category.objects.create(household=household, name='Freizeit', color='#2f7fd1', icon_key='freizeit')

    response = client.post('/api/v1/finanzen/kategorien/', _valid_payload(name='Freizeit'), format='json')

    assert response.status_code == 400
    assert Category.objects.filter(household=household, name='Freizeit').count() == 1


def test_duplicate_name_against_an_existing_default_category_is_rejected():
    client, household = _client_for_new_household()

    response = client.post('/api/v1/finanzen/kategorien/', _valid_payload(name='Fixkosten'), format='json')

    assert response.status_code == 400


def test_same_category_name_in_a_different_household_is_allowed():
    client, household = _client_for_new_household()
    other_household = Household.objects.create(name='Anderer Haushalt')
    Category.objects.create(household=other_household, name='Freizeit', color='#2f7fd1', icon_key='freizeit')

    response = client.post('/api/v1/finanzen/kategorien/', _valid_payload(name='Freizeit'), format='json')

    assert response.status_code == 201


def test_is_default_is_always_false_for_newly_created_categories_even_if_the_client_sends_true():
    client, household = _client_for_new_household()

    response = client.post('/api/v1/finanzen/kategorien/', _valid_payload(is_default=True), format='json')

    assert response.status_code == 201
    assert response.data['is_default'] is False
    created = Category.objects.get(household=household, name='Freizeit')
    assert created.is_default is False


def test_invalid_icon_key_is_rejected():
    client, _ = _client_for_new_household()

    response = client.post('/api/v1/finanzen/kategorien/', _valid_payload(icon_key='does-not-exist'), format='json')

    assert response.status_code == 400


@pytest.mark.parametrize('icon_key', ['fixkosten', 'haushalt', 'sonstiges', 'freizeit', 'gesundheit', 'bildung', 'transport', 'geschenke'])
def test_all_allowed_icon_keys_are_accepted(icon_key):
    client, household = _client_for_new_household()
    # Standard-Kategorien belegen fixkosten/haushalt/sonstiges bereits als
    # Namen (nicht als icon_key) — der Name muss trotzdem eindeutig bleiben.
    response = client.post(
        '/api/v1/finanzen/kategorien/', _valid_payload(name=f'Test-{icon_key}', icon_key=icon_key), format='json'
    )

    assert response.status_code == 201


def test_invalid_color_is_rejected():
    client, _ = _client_for_new_household()

    response = client.post('/api/v1/finanzen/kategorien/', _valid_payload(color='blau'), format='json')

    assert response.status_code == 400


def test_missing_color_is_rejected():
    client, _ = _client_for_new_household()
    payload = _valid_payload()
    del payload['color']

    response = client.post('/api/v1/finanzen/kategorien/', payload, format='json')

    assert response.status_code == 400


def test_missing_icon_key_is_rejected():
    client, _ = _client_for_new_household()
    payload = _valid_payload()
    del payload['icon_key']

    response = client.post('/api/v1/finanzen/kategorien/', payload, format='json')

    assert response.status_code == 400


def test_category_name_over_100_characters_is_rejected():
    client, _ = _client_for_new_household()

    response = client.post('/api/v1/finanzen/kategorien/', _valid_payload(name='X' * 101), format='json')

    assert response.status_code == 400


def test_household_category_cap_of_15_is_enforced():
    client, household = _client_for_new_household()
    # 3 Standard-Kategorien existieren bereits automatisch -> 12 weitere bis
    # zur Grenze von 15 anlegen.
    for i in range(12):
        Category.objects.create(household=household, name=f'Extra {i}', color='#2f7fd1', icon_key='sonstiges')
    assert Category.objects.filter(household=household).count() == 15

    response = client.post('/api/v1/finanzen/kategorien/', _valid_payload(name='Eine zu viel'), format='json')

    assert response.status_code == 400
    assert Category.objects.filter(household=household).count() == 15
