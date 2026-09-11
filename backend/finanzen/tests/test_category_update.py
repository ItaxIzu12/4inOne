"""PATCH /api/v1/finanzen/kategorien/{id}/ — monthly_goal ändern erlaubt,
Name einer Standard-Kategorie (is_default=True) serverseitig geschützt
(finanzen/serializers.py CategorySerializer.validate_name)."""

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from core.models import Household, HouseholdMembership
from finanzen.models import Category

pytestmark = pytest.mark.django_db


def _client_for_new_household():
    User = get_user_model()
    user = User.objects.create_user(username='goal-editor@example.com', password='irrelevant-for-test')
    household = Household.objects.create(name='Testhaushalt')
    HouseholdMembership.objects.create(user=user, household=household)
    client = APIClient()
    client.force_authenticate(user=user)
    return client, household


def test_changing_monthly_goal_on_a_default_category_succeeds():
    client, household = _client_for_new_household()
    category = Category.objects.get(household=household, name='Fixkosten')
    assert category.is_default is True

    response = client.patch(f'/api/v1/finanzen/kategorien/{category.id}/', {'monthly_goal': '450.00'}, format='json')

    assert response.status_code == 200
    assert response.data['monthly_goal'] == '450.00'
    category.refresh_from_db()
    assert str(category.monthly_goal) == '450.00'


def test_renaming_a_default_category_is_rejected():
    client, household = _client_for_new_household()
    category = Category.objects.get(household=household, name='Fixkosten')

    response = client.patch(f'/api/v1/finanzen/kategorien/{category.id}/', {'name': 'Umbenannt'}, format='json')

    assert response.status_code == 400
    category.refresh_from_db()
    assert category.name == 'Fixkosten'


def test_renaming_a_custom_non_default_category_is_allowed():
    client, household = _client_for_new_household()
    custom = Category.objects.create(household=household, name='Urlaub', is_default=False)

    response = client.patch(f'/api/v1/finanzen/kategorien/{custom.id}/', {'name': 'Reisen'}, format='json')

    assert response.status_code == 200
    custom.refresh_from_db()
    assert custom.name == 'Reisen'


def test_is_default_flag_cannot_be_set_by_the_client():
    """is_default ist read_only — ein Client könnte sonst eine selbst
    angelegte Kategorie fälschlich als 'Standard' markieren oder umgekehrt
    den Namensschutz einer echten Standard-Kategorie über einen zweiten
    Request aushebeln."""
    client, household = _client_for_new_household()
    custom = Category.objects.create(household=household, name='Sport', is_default=False)

    client.patch(f'/api/v1/finanzen/kategorien/{custom.id}/', {'is_default': True}, format='json')

    custom.refresh_from_db()
    assert custom.is_default is False
