"""TransactionViewSet.perform_create(): account wird serverseitig aus dem
Haushalt abgeleitet (nie aus Client-Eingaben, IDOR-Schutz), und ein fehlendes
Account wird bei Bedarf automatisch angelegt statt mit 500 abzustürzen."""

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import Household, HouseholdMembership
from finanzen.models import Account, Category

pytestmark = pytest.mark.django_db

HEUTE = timezone.localdate().isoformat()


def test_creating_a_transaction_without_an_existing_account_auto_creates_one():
    User = get_user_model()
    user = User.objects.create_user(username='new-expense@example.com', password='irrelevant-for-test')
    household = Household.objects.create(name='Testhaushalt')
    HouseholdMembership.objects.create(user=user, household=household)
    # Automatisch angelegt (finanzen/signals.py) — kein Account allerdings,
    # der entsteht laut TransactionViewSet.perform_create() erst hier.
    category = Category.objects.get(household=household, name='Fixkosten')

    assert Account.objects.filter(household=household).count() == 0

    client = APIClient()
    client.force_authenticate(user=user)
    response = client.post(
        '/api/v1/finanzen/transaktionen/',
        {'amount': '42.00', 'description': 'Testausgabe', 'datum': HEUTE, 'category_id': category.id},
        format='json',
    )

    assert response.status_code == 201
    account = Account.objects.get(household=household)
    assert response.data['account'] == account.id
    assert response.data['created_by'] == user.id


def test_client_supplied_account_id_is_ignored_and_never_used():
    """IDOR-Schutz: ein Client könnte versuchen, eine Transaktion direkt in
    einem FREMDEN Account (anderer Haushalt) anzulegen, indem er dessen ID
    mitschickt — account ist read_only (serializers.py), daher wird jeder
    mitgeschickte Wert ignoriert und stattdessen der eigene Haushalt
    verwendet."""
    User = get_user_model()
    attacker = User.objects.create_user(username='attacker@example.com', password='irrelevant-for-test')
    victim = User.objects.create_user(username='victim@example.com', password='irrelevant-for-test')

    attacker_household = Household.objects.create(name='Angreifer-Haushalt')
    victim_household = Household.objects.create(name='Opfer-Haushalt')
    HouseholdMembership.objects.create(user=attacker, household=attacker_household)
    HouseholdMembership.objects.create(user=victim, household=victim_household)
    victim_account = Account.objects.create(household=victim_household, name='Opfer-Konto')
    attacker_category = Category.objects.get(household=attacker_household, name='Fixkosten')

    client = APIClient()
    client.force_authenticate(user=attacker)
    response = client.post(
        '/api/v1/finanzen/transaktionen/',
        {
            'amount': '99.00',
            'description': 'Unterschobene Ausgabe',
            'account': victim_account.id,
            'category_id': attacker_category.id,
            'datum': HEUTE,
        },
        format='json',
    )

    assert response.status_code == 201
    assert response.data['account'] != victim_account.id
    attacker_account = Account.objects.get(household=attacker_household)
    assert response.data['account'] == attacker_account.id


def test_client_supplied_category_from_a_different_household_is_rejected():
    """Dieselbe IDOR-Klasse wie oben, aber für category_id statt account:
    eine Kategorie eines FREMDEN Haushalts darf nicht verwendbar sein."""
    User = get_user_model()
    attacker = User.objects.create_user(username='cat-attacker@example.com', password='irrelevant-for-test')
    victim = User.objects.create_user(username='cat-victim@example.com', password='irrelevant-for-test')

    attacker_household = Household.objects.create(name='Angreifer-Haushalt-2')
    victim_household = Household.objects.create(name='Opfer-Haushalt-2')
    HouseholdMembership.objects.create(user=attacker, household=attacker_household)
    HouseholdMembership.objects.create(user=victim, household=victim_household)
    victim_category = Category.objects.get(household=victim_household, name='Fixkosten')

    client = APIClient()
    client.force_authenticate(user=attacker)
    response = client.post(
        '/api/v1/finanzen/transaktionen/',
        {'amount': '50.00', 'description': 'Fremde Kategorie', 'datum': HEUTE, 'category_id': victim_category.id},
        format='json',
    )

    assert response.status_code == 400


def test_creating_a_transaction_without_a_category_is_rejected():
    User = get_user_model()
    user = User.objects.create_user(username='no-category@example.com', password='irrelevant-for-test')
    household = Household.objects.create(name='Testhaushalt-3')
    HouseholdMembership.objects.create(user=user, household=household)

    client = APIClient()
    client.force_authenticate(user=user)
    response = client.post(
        '/api/v1/finanzen/transaktionen/',
        {'amount': '10.00', 'description': 'Ohne Kategorie', 'datum': HEUTE},
        format='json',
    )

    assert response.status_code == 400


def test_creating_a_transaction_without_a_household_fails_cleanly_not_with_a_500():
    User = get_user_model()
    user = User.objects.create_user(username='no-household-tx@example.com', password='irrelevant-for-test')

    client = APIClient()
    client.force_authenticate(user=user)
    response = client.post(
        '/api/v1/finanzen/transaktionen/',
        {'amount': '-10.00', 'description': 'Test', 'datum': HEUTE},
        format='json',
    )

    assert response.status_code == 400
