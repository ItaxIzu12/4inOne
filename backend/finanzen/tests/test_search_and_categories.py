"""TEIL 4/7: Suche/Pagination des Transaktions-Endpunkts und TEIL 1:
Kategorie-Farbe/Icon als Daten statt hartkodiert."""

from datetime import datetime, timezone

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from core.models import Household, HouseholdMembership
from finanzen.models import Account, Transaction

pytestmark = pytest.mark.django_db


def test_search_endpoint_never_returns_results_from_a_different_household():
    User = get_user_model()
    user_a = User.objects.create_user(username='search-a@example.com', password='irrelevant-for-test-a')
    user_b = User.objects.create_user(username='search-b@example.com', password='irrelevant-for-test-b')

    household_a = Household.objects.create(name='Haushalt A')
    household_b = Household.objects.create(name='Haushalt B')
    HouseholdMembership.objects.create(user=user_a, household=household_a)
    HouseholdMembership.objects.create(user=user_b, household=household_b)

    account_a = Account.objects.create(household=household_a, name='Konto A')
    account_b = Account.objects.create(household=household_b, name='Konto B')

    # Bewusst DIESELBE Beschreibung in beiden Haushalten — würde die Suche
    # haushaltsübergreifend filtern, träfe der Suchbegriff hier fälschlich
    # beide Treffer statt nur den eigenen.
    Transaction.objects.create(
        account=account_a, description='Geheime Miete', amount='1.00', occurred_at=datetime(2026, 8, 1, tzinfo=timezone.utc)
    )
    Transaction.objects.create(
        account=account_b, description='Geheime Miete', amount='2.00', occurred_at=datetime(2026, 8, 1, tzinfo=timezone.utc)
    )

    client = APIClient()
    client.force_authenticate(user=user_a)
    response = client.get('/api/v1/finanzen/transaktionen/', {'q': 'Geheime'})

    assert response.status_code == 200
    results = response.data['results']
    assert len(results) == 1
    assert results[0]['amount'] == '1.00'


def test_search_endpoint_finds_nothing_for_a_query_that_only_matches_another_household():
    """Ergänzt den Test oben um den Fall, dass NUR der fremde Haushalt
    einen Treffer hätte — die Antwort muss trotzdem leer bleiben, nicht nur
    "auf den eigenen Treffer reduziert"."""
    User = get_user_model()
    user_a = User.objects.create_user(username='onlyother-a@example.com', password='irrelevant-for-test-a')
    user_b = User.objects.create_user(username='onlyother-b@example.com', password='irrelevant-for-test-b')

    household_a = Household.objects.create(name='Haushalt A')
    household_b = Household.objects.create(name='Haushalt B')
    HouseholdMembership.objects.create(user=user_a, household=household_a)
    HouseholdMembership.objects.create(user=user_b, household=household_b)

    account_b = Account.objects.create(household=household_b, name='Konto B')
    Transaction.objects.create(
        account=account_b,
        description='Nur in Haushalt B vorhanden',
        amount='9.00',
        occurred_at=datetime(2026, 8, 1, tzinfo=timezone.utc),
    )

    client = APIClient()
    client.force_authenticate(user=user_a)
    response = client.get('/api/v1/finanzen/transaktionen/', {'q': 'Nur in Haushalt B'})

    assert response.status_code == 200
    assert response.data['results'] == []


def test_creating_category_with_custom_color_appears_in_api_response():
    User = get_user_model()
    user = User.objects.create_user(username='category-owner@example.com', password='irrelevant-for-test')
    household = Household.objects.create(name='Testhaushalt')
    HouseholdMembership.objects.create(user=user, household=household)

    client = APIClient()
    client.force_authenticate(user=user)

    # icon_key muss seit der icon_key-Whitelist (finanzen/serializers.py
    # ALLOWED_CATEGORY_ICON_KEYS, siehe Chat-Verlauf) einer der tatsächlich
    # im Frontend vorhandenen Icon-Komponenten-Schlüssel sein, kein
    # beliebiger freier String mehr.
    create_response = client.post(
        '/api/v1/finanzen/kategorien/', {'name': 'Urlaub', 'color': '#00c8ff', 'icon_key': 'freizeit'}, format='json'
    )
    assert create_response.status_code == 201
    assert create_response.data['color'] == '#00c8ff'
    assert create_response.data['icon_key'] == 'freizeit'

    list_response = client.get('/api/v1/finanzen/kategorien/')
    assert any(c['color'] == '#00c8ff' and c['icon_key'] == 'freizeit' for c in list_response.data)


def test_creating_category_without_a_household_fails_cleanly_not_with_a_500():
    """Betrifft Konten ohne Household (z. B. per createsuperuser angelegt,
    vor Einführung der automatischen Haushalts-Anlage in RegisterView) —
    muss eine saubere 400-Antwort geben, kein unbehandelter 500
    IntegrityError (NOT-NULL-Constraint auf Category.household)."""
    User = get_user_model()
    user = User.objects.create_user(username='no-household@example.com', password='irrelevant-for-test')

    client = APIClient()
    client.force_authenticate(user=user)

    response = client.post(
        '/api/v1/finanzen/kategorien/', {'name': 'Urlaub', 'color': '#00c8ff', 'icon_key': 'urlaub'}, format='json'
    )
    assert response.status_code == 400
