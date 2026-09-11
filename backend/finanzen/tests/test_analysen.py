"""Analysen-Tab: "Verfügbares Einkommen" + regelbasierte Insights (siehe
Chat-Verlauf) — finanzen/views.py AnalysenView/SetOwnIncomeView/
SetHouseholdBufferView/RecurringDeductionViewSet, finanzen/insights.py."""

from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from core.models import Household, HouseholdMembership
from finanzen.insights import berechne_insights
from finanzen.models import Category, RecurringDeduction

pytestmark = pytest.mark.django_db


def _client_for_new_household():
    User = get_user_model()
    user = User.objects.create_user(username='income-tester@example.com', password='irrelevant-for-test')
    household = Household.objects.create(name='Testhaushalt')
    HouseholdMembership.objects.create(user=user, household=household, monthly_income=Decimal('3000.00'))
    client = APIClient()
    client.force_authenticate(user=user)
    return client, user, household


# Datenleck-Schutz: eigenes Einkommen sichtbar, fremdes nie -----------------


def test_analysen_endpoint_never_leaks_another_members_income():
    client, user, household = _client_for_new_household()
    User = get_user_model()
    other_user = User.objects.create_user(username='other-member@example.com', password='irrelevant-for-test')
    HouseholdMembership.objects.create(user=other_user, household=household, monthly_income=Decimal('2200.00'))

    response = client.get('/api/v1/finanzen/analysen/')

    assert response.status_code == 200
    assert response.data['monthly_income'] == '3000.00'  # eigenes Einkommen
    assert response.data['household_total_income'] == '5200.00'  # Summe, nicht aufgeschlüsselt
    # "2200.00" (der Betrag des anderen Mitglieds) darf an KEINER Stelle im
    # Response auftauchen — auch nicht versteckt in einem anderen Feld.
    assert '2200.00' not in str(response.data)


def test_analysen_endpoint_shows_null_income_for_own_membership_without_income_set():
    User = get_user_model()
    user = User.objects.create_user(username='no-income@example.com', password='irrelevant-for-test')
    household = Household.objects.create(name='Testhaushalt')
    HouseholdMembership.objects.create(user=user, household=household)  # kein monthly_income gesetzt
    client = APIClient()
    client.force_authenticate(user=user)

    response = client.get('/api/v1/finanzen/analysen/')

    assert response.status_code == 200
    assert response.data['monthly_income'] is None


def test_household_membership_income_serializer_masks_other_members_even_used_directly():
    # "auch nicht über Umwege" (Chat-Verlauf) — auch bei DIREKTER
    # Verwendung des Serializers (nicht nur über den Analysen-Endpunkt)
    # bleibt monthly_income eines anderen Mitglieds maskiert.
    from finanzen.serializers import HouseholdMembershipIncomeSerializer

    client, user, household = _client_for_new_household()
    User = get_user_model()
    other_user = User.objects.create_user(username='other-member-2@example.com', password='irrelevant-for-test')
    other_membership = HouseholdMembership.objects.create(
        user=other_user, household=household, monthly_income=Decimal('4444.44')
    )

    class _FakeRequest:
        pass

    fake_request = _FakeRequest()
    fake_request.user = user

    data = HouseholdMembershipIncomeSerializer(other_membership, context={'request': fake_request}).data

    assert data['monthly_income'] is None


# Setzen des eigenen Einkommens ----------------------------------------------


def test_patching_own_income_only_affects_own_membership():
    client, user, household = _client_for_new_household()
    User = get_user_model()
    other_user = User.objects.create_user(username='other-member-3@example.com', password='irrelevant-for-test')
    other_membership = HouseholdMembership.objects.create(user=other_user, household=household)

    response = client.patch('/api/v1/finanzen/analysen/einkommen/', {'monthly_income': '3500.00'}, format='json')

    assert response.status_code == 200
    assert response.data['monthly_income'] == '3500.00'
    other_membership.refresh_from_db()
    assert other_membership.monthly_income is None  # unverändert


def test_negative_income_is_rejected():
    client, _, _ = _client_for_new_household()

    response = client.patch('/api/v1/finanzen/analysen/einkommen/', {'monthly_income': '-100.00'}, format='json')

    assert response.status_code == 400


# Puffer ----------------------------------------------------------------------


def test_patching_household_buffer():
    client, _, household = _client_for_new_household()

    response = client.patch('/api/v1/finanzen/analysen/puffer/', {'monthly_buffer': '400.00'}, format='json')

    assert response.status_code == 200
    household.refresh_from_db()
    assert str(household.monthly_buffer) == '400.00'


# RecurringDeduction CRUD + Berechnung ---------------------------------------


def test_verfuegbares_einkommen_subtracts_active_deductions_and_buffer():
    client, user, household = _client_for_new_household()
    category = Category.objects.get(household=household, name='Fixkosten')
    RecurringDeduction.objects.create(household=household, name='Miete', amount='900.00', category=category, active=True)
    RecurringDeduction.objects.create(
        household=household, name='Pausiertes Abo', amount='50.00', category=category, active=False
    )
    client.patch('/api/v1/finanzen/analysen/puffer/', {'monthly_buffer': '300.00'}, format='json')

    response = client.get('/api/v1/finanzen/analysen/')

    assert response.status_code == 200
    # 3000 (eigenes Einkommen, einziges Mitglied) - 900 (nur der AKTIVE Abzug) - 300 (Puffer) = 1800
    assert response.data['verfuegbares_einkommen'] == '1800.00'
    assert len(response.data['recurring_deductions']) == 2


def test_deleting_a_recurring_deduction_from_another_household_is_rejected():
    client, _, _ = _client_for_new_household()
    other_household = Household.objects.create(name='Anderer Haushalt')
    other_category = Category.objects.get(household=other_household, name='Fixkosten')
    other_deduction = RecurringDeduction.objects.create(
        household=other_household, name='Fremde Miete', amount='800.00', category=other_category
    )

    response = client.delete(f'/api/v1/finanzen/abzuege/{other_deduction.id}/')

    assert response.status_code == 404
    assert RecurringDeduction.objects.filter(pk=other_deduction.pk).exists()


# Insights-Funktion (reine Python-Funktion, kein KI-/LLM-Aufruf) -------------


def test_insights_warns_about_high_fixed_costs():
    insights = berechne_insights(Decimal('2000'), Decimal('1200'), Decimal('300'))
    typen = [i['typ'] for i in insights]
    assert 'warnung' in typen


def test_insights_flags_low_buffer():
    insights = berechne_insights(Decimal('2000'), Decimal('500'), Decimal('50'))
    typen = [i['typ'] for i in insights]
    assert 'hinweis' in typen


def test_insights_is_positive_for_a_healthy_ratio():
    insights = berechne_insights(Decimal('2000'), Decimal('600'), Decimal('300'))
    typen = [i['typ'] for i in insights]
    assert typen == ['positiv']


def test_insights_returns_empty_list_for_zero_income():
    assert berechne_insights(Decimal('0'), Decimal('0'), Decimal('0')) == []
