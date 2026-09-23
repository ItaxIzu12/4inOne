"""Wählbares Ausgabedatum (Transaction.datum, ersetzt occurred_at) —
TransactionSerializer.validate_datum(): nicht in der Zukunft, nicht mehr als
12 Monate zurück. created_at (technischer Erstellungs-Zeitstempel) bleibt
davon unberührt."""

from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import Household, HouseholdMembership
from finanzen.models import Category

pytestmark = pytest.mark.django_db


@pytest.fixture
def client_and_category():
    User = get_user_model()
    user = User.objects.create_user(username='datum-tester@example.com', password='irrelevant-for-test')
    household = Household.objects.create(name='Testhaushalt')
    HouseholdMembership.objects.create(user=user, household=household)
    category = Category.objects.get(household=household, name='Fixkosten')
    client = APIClient()
    client.force_authenticate(user=user)
    return client, category


def _post(client, category, datum):
    return client.post(
        '/api/v1/finanzen/transaktionen/',
        {'amount': '10.00', 'description': 'Test', 'category_id': category.id, 'datum': datum.isoformat()},
        format='json',
    )


def test_a_future_date_is_rejected(client_and_category):
    client, category = client_and_category

    response = _post(client, category, timezone.localdate() + timedelta(days=1))

    assert response.status_code == 400
    assert 'Zukunft' in str(response.data['datum'])


def test_todays_date_is_accepted(client_and_category):
    client, category = client_and_category

    response = _post(client, category, timezone.localdate())

    assert response.status_code == 201


def test_a_date_more_than_12_months_in_the_past_is_rejected(client_and_category):
    client, category = client_and_category

    response = _post(client, category, timezone.localdate() - timedelta(days=366))

    assert response.status_code == 400
    assert 'zurückliegen' in str(response.data['datum'])


def test_a_date_within_12_months_is_accepted(client_and_category):
    client, category = client_and_category

    response = _post(client, category, timezone.localdate() - timedelta(days=300))

    assert response.status_code == 201


def test_omitting_datum_defaults_to_today(client_and_category):
    client, category = client_and_category

    response = client.post(
        '/api/v1/finanzen/transaktionen/',
        {'amount': '10.00', 'description': 'Ohne Datum', 'category_id': category.id},
        format='json',
    )

    assert response.status_code == 201
    assert response.data['datum'] == timezone.localdate().isoformat()


def test_datum_is_independent_of_the_technical_created_at_timestamp(client_and_category):
    client, category = client_and_category
    gewaehltes_datum = timezone.localdate() - timedelta(days=10)

    response = _post(client, category, gewaehltes_datum)

    assert response.status_code == 201
    assert response.data['datum'] == gewaehltes_datum.isoformat()
    # created_at bleibt unabhängig davon der technische Erstellungs-
    # Zeitstempel von JETZT, nicht vom gewählten Ausgabedatum.
    from finanzen.models import Transaction

    transaction = Transaction.objects.get(pk=response.data['id'])
    assert transaction.created_at.date() == timezone.localdate()
    assert transaction.datum == gewaehltes_datum
