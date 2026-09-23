"""Gezielte Sicherheitsprüfung des Finanzen-Moduls (siehe Chat-Verlauf:
PRÜFUNG 1–6), ergänzend zu den bereits bestehenden CRUD-/IDOR-Tests in
test_transaction_update.py und test_category_update.py — hier NUR die
Lücken, die eine fokussierte Sicherheitsprüfung zusätzlich aufgedeckt hat."""

from datetime import date

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from core.models import Household, HouseholdMembership
from finanzen.models import Account, Category, Transaction

pytestmark = pytest.mark.django_db


def _client_with_transaction():
    User = get_user_model()
    user = User.objects.create_user(username='security-tester@example.com', password='irrelevant-for-test')
    household = Household.objects.create(name='Testhaushalt')
    HouseholdMembership.objects.create(user=user, household=household)
    account = Account.objects.create(household=household, name='Haushaltskasse')
    category = Category.objects.get(household=household, name='Fixkosten')
    transaction = Transaction.objects.create(
        account=account,
        category=category,
        amount='50.00',
        description='Ursprünglich',
        datum=date(2026, 9, 1),
        created_by=user,
    )
    client = APIClient()
    client.force_authenticate(user=user)
    return client, user, household, account, transaction


# PRÜFUNG 1 — Mass Assignment ----------------------------------------------


def test_patching_household_id_or_account_id_on_a_transaction_does_not_move_it():
    client, _, household, account, transaction = _client_with_transaction()
    other_household = Household.objects.create(name='Anderer Haushalt')
    other_account = Account.objects.create(household=other_household, name='Fremdes Konto')

    response = client.patch(
        f'/api/v1/finanzen/transaktionen/{transaction.id}/',
        {'account': other_account.id, 'household': other_household.id, 'amount': '60.00'},
        format='json',
    )

    assert response.status_code == 200
    transaction.refresh_from_db()
    # account bleibt unverändert — Transaction hat gar kein eigenes
    # household-Feld (nur über account.household erreichbar), und account
    # ist read_only: ein mitgeschickter Wert wird von DRF stillschweigend
    # ignoriert, nicht übernommen.
    assert transaction.account_id == account.id
    assert transaction.account.household_id == household.id
    assert str(transaction.amount) == '60.00'  # das erlaubte Feld wurde trotzdem übernommen


# PRÜFUNG 2 — Standard-Kategorie vor Löschung schützen ----------------------


def test_deleting_a_default_category_is_rejected():
    client, _, household, _, _ = _client_with_transaction()
    category = Category.objects.get(household=household, name='Haushalt')
    assert category.is_default is True

    response = client.delete(f'/api/v1/finanzen/kategorien/{category.id}/')

    assert response.status_code == 400
    assert Category.objects.filter(pk=category.pk).exists()


def test_deleting_a_custom_non_default_category_still_works():
    client, _, household, _, _ = _client_with_transaction()
    custom = Category.objects.create(household=household, name='Urlaub', is_default=False)

    response = client.delete(f'/api/v1/finanzen/kategorien/{custom.id}/')

    assert response.status_code == 204
    assert not Category.objects.filter(pk=custom.pk).exists()


# PRÜFUNG 3 — Eingabevalidierung --------------------------------------------


def test_invalid_color_value_is_rejected():
    client, _, household, _, _ = _client_with_transaction()
    category = Category.objects.get(household=household, name='Fixkosten')

    response = client.patch(f'/api/v1/finanzen/kategorien/{category.id}/', {'color': 'rot'}, format='json')

    assert response.status_code == 400
    category.refresh_from_db()
    assert category.color != 'rot'


@pytest.mark.parametrize('color', ['#c23b52', '#FFFFFF', '#000000'])
def test_valid_hex_color_values_are_accepted(color):
    client, _, household, _, _ = _client_with_transaction()
    category = Category.objects.get(household=household, name='Fixkosten')

    response = client.patch(f'/api/v1/finanzen/kategorien/{category.id}/', {'color': color}, format='json')

    assert response.status_code == 200
    assert response.data['color'] == color


@pytest.mark.parametrize('amount', ['-50000.00', '99999999.00', '0', '0.00'])
def test_out_of_range_amounts_are_rejected(amount):
    client, _, _, _, transaction = _client_with_transaction()

    response = client.patch(f'/api/v1/finanzen/transaktionen/{transaction.id}/', {'amount': amount}, format='json')

    assert response.status_code == 400
    transaction.refresh_from_db()
    assert str(transaction.amount) == '50.00'  # unverändert


def test_amount_just_under_the_limit_is_accepted():
    client, _, _, _, transaction = _client_with_transaction()

    response = client.patch(
        f'/api/v1/finanzen/transaktionen/{transaction.id}/', {'amount': '999999.99'}, format='json'
    )

    assert response.status_code == 200


# PRÜFUNG 5 — updated_by aus request.user, nicht aus dem Body ---------------


def test_updated_by_is_set_from_the_authenticated_user_after_a_patch():
    client, user, _, _, transaction = _client_with_transaction()
    assert transaction.updated_by_id is None

    response = client.patch(f'/api/v1/finanzen/transaktionen/{transaction.id}/', {'amount': '55.00'}, format='json')

    assert response.status_code == 200
    transaction.refresh_from_db()
    assert transaction.updated_by_id == user.pk


def test_updated_by_ignores_a_spoofed_value_in_the_request_body():
    client, user, household, _, transaction = _client_with_transaction()
    User = get_user_model()
    impersonated = User.objects.create_user(username='not-the-editor@example.com', password='irrelevant-for-test')

    response = client.patch(
        f'/api/v1/finanzen/transaktionen/{transaction.id}/',
        {'amount': '55.00', 'updated_by': impersonated.id},
        format='json',
    )

    assert response.status_code == 200
    transaction.refresh_from_db()
    # updated_by ist read-only: der mitgeschickte Wert wird ignoriert,
    # stattdessen zählt ausschließlich request.user (TransactionViewSet.
    # perform_update).
    assert transaction.updated_by_id == user.pk
    assert transaction.updated_by_id != impersonated.id
