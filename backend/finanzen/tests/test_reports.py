"""Monats-/Jahresberichte (CSV/PDF, finanzen/reports.py, finanzen/views.py
BerichtCsvView/BerichtPdfView) — zum Archivieren/Ausdrucken, nicht zu
verwechseln mit dem "Für KI-Analyse exportieren"-Textblock."""

from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.core.cache import caches
from rest_framework.test import APIClient

from core.models import Household, HouseholdMembership
from finanzen.models import Account, Category, RecurringDeduction, Transaction

pytestmark = pytest.mark.django_db


@pytest.fixture
def setup():
    User = get_user_model()
    user = User.objects.create_user(username='bericht@example.com', password='irrelevant-for-test')
    household = Household.objects.create(name='Berichts-Haushalt', monthly_buffer=Decimal('100.00'))
    HouseholdMembership.objects.create(user=user, household=household, monthly_income=Decimal('2000.00'))
    account = Account.objects.create(household=household, name='Kasse')
    fixkosten = Category.objects.get(household=household, name='Fixkosten')
    haushalt = Category.objects.get(household=household, name='Haushalt')
    Category.objects.filter(pk=fixkosten.pk).update(monthly_goal='500.00')
    RecurringDeduction.objects.create(household=household, name='Miete', amount='400.00', category=fixkosten)

    # August-Transaktion (soll im August-Bericht auftauchen, nicht im September)
    august_tx = Transaction.objects.create(
        account=account, category=haushalt, amount='64.20', datum=date(2026, 8, 15), description='August-Einkauf'
    )
    # September-Transaktion (anderer Monat, darf im August-Bericht NICHT auftauchen)
    Transaction.objects.create(
        account=account, category=haushalt, amount='999.00', datum=date(2026, 9, 3), description='September-Einkauf'
    )
    # Weich gelöschte Transaktion im August — darf in keinem Bericht auftauchen
    deleted = Transaction.objects.create(
        account=account, category=haushalt, amount='777.00', datum=date(2026, 8, 20), description='Gelöscht'
    )
    deleted.soft_delete()

    client = APIClient()
    client.force_authenticate(user=user)
    return {'client': client, 'household': household, 'august_tx': august_tx, 'account': account}


def _csv_text(response) -> str:
    return response.content.decode('utf-8-sig')


# Zeitraum-Parameter --------------------------------------------------------------


def test_missing_period_parameter_is_rejected(setup):
    response = setup['client'].get('/api/v1/finanzen/berichte/csv/')

    assert response.status_code == 400


def test_giving_both_monat_and_jahr_is_rejected(setup):
    response = setup['client'].get('/api/v1/finanzen/berichte/csv/?monat=2026-08&jahr=2026')

    assert response.status_code == 400


def test_malformed_monat_is_rejected(setup):
    response = setup['client'].get('/api/v1/finanzen/berichte/csv/?monat=2026-13')

    assert response.status_code == 400


def test_malformed_jahr_is_rejected(setup):
    response = setup['client'].get('/api/v1/finanzen/berichte/csv/?jahr=nicht-eine-zahl')

    assert response.status_code == 400


# CSV -------------------------------------------------------------------------------


def test_csv_for_a_month_contains_exactly_that_months_transactions(setup):
    response = setup['client'].get('/api/v1/finanzen/berichte/csv/?monat=2026-08')

    assert response.status_code == 200
    assert response['Content-Type'].startswith('text/csv')
    text = _csv_text(response)
    assert 'August-Einkauf' in text
    assert 'September-Einkauf' not in text  # anderer Monat
    assert 'Gelöscht' not in text  # weich gelöscht


def test_csv_has_a_sum_row_and_a_separate_fixed_deductions_section(setup):
    text = _csv_text(setup['client'].get('/api/v1/finanzen/berichte/csv/?monat=2026-08'))

    assert 'Summe Transaktionen;64.50' in text or 'Summe Transaktionen;64.20' in text
    assert 'Feste Abzüge' in text
    assert 'Miete;Fixkosten;400.00' in text
    # Die feste Abzug-Zeile steht in einem eigenen Abschnitt, nicht als
    # normale Transaktionszeile mit dieser Beschreibung.
    lines = text.splitlines()
    header_index = lines.index('Datum;Beschreibung;Kategorie;Betrag (€)')
    sum_index = next(i for i, line in enumerate(lines) if line.startswith(';;Summe Transaktionen'))
    assert not any('Miete' in line for line in lines[header_index:sum_index])


def test_csv_for_a_year_includes_transactions_from_multiple_months(setup):
    text = _csv_text(setup['client'].get('/api/v1/finanzen/berichte/csv/?jahr=2026'))

    assert 'August-Einkauf' in text
    assert 'September-Einkauf' in text
    assert 'Gelöscht' not in text


def test_csv_filename_is_attached_and_period_specific(setup):
    august = setup['client'].get('/api/v1/finanzen/berichte/csv/?monat=2026-08')
    year = setup['client'].get('/api/v1/finanzen/berichte/csv/?jahr=2026')

    assert 'kompass-bericht-berichts-haushalt-2026-08.csv' in august['Content-Disposition']
    assert 'kompass-bericht-berichts-haushalt-2026.csv' in year['Content-Disposition']
    assert 'attachment' in august['Content-Disposition']


# PDF -------------------------------------------------------------------------------


def test_pdf_is_a_well_formed_pdf_document(setup):
    response = setup['client'].get('/api/v1/finanzen/berichte/pdf/?monat=2026-08')

    assert response.status_code == 200
    assert response['Content-Type'] == 'application/pdf'
    assert response.content.startswith(b'%PDF-')
    assert response.content.rstrip().endswith(b'%%EOF')
    assert 'kompass-bericht-berichts-haushalt-2026-08.pdf' in response['Content-Disposition']


def test_pdf_for_the_year_is_larger_or_equal_when_more_transactions_exist(setup):
    # Kein pixelgenauer Vergleich möglich (siehe Auftrag) — aber ein
    # Jahresbericht mit mehr Transaktionen als der einzelne Monat darf nicht
    # kleiner ausfallen als ein leerer wäre.
    month_pdf = setup['client'].get('/api/v1/finanzen/berichte/pdf/?monat=2026-08').content
    year_pdf = setup['client'].get('/api/v1/finanzen/berichte/pdf/?jahr=2026').content

    assert len(year_pdf) >= len(month_pdf)


# HouseholdScopedPermission / Isolation zwischen Haushalten ------------------------


def test_a_user_never_receives_another_households_report_data(setup):
    User = get_user_model()
    other_user = User.objects.create_user(username='anderer-haushalt@example.com', password='irrelevant-for-test')
    other_household = Household.objects.create(name='Anderer Haushalt')
    HouseholdMembership.objects.create(user=other_user, household=other_household)
    other_account = Account.objects.create(household=other_household, name='Fremdkonto')
    Transaction.objects.create(
        account=other_account,
        category=Category.objects.get(household=other_household, name='Haushalt'),
        amount='4000.00',
        datum=date(2026, 8, 10),
        description='Geheime Fremdausgabe',
    )
    other_client = APIClient()
    other_client.force_authenticate(user=other_user)

    own_report = _csv_text(setup['client'].get('/api/v1/finanzen/berichte/csv/?monat=2026-08'))
    other_report = _csv_text(other_client.get('/api/v1/finanzen/berichte/csv/?monat=2026-08'))

    assert 'Geheime Fremdausgabe' not in own_report
    assert 'August-Einkauf' not in other_report
    assert '4000.00' not in own_report


def test_a_user_without_a_household_gets_a_clean_error_not_a_500():
    User = get_user_model()
    user = User.objects.create_user(username='ohne-haushalt@example.com', password='irrelevant-for-test')
    client = APIClient()
    client.force_authenticate(user=user)

    response = client.get('/api/v1/finanzen/berichte/csv/?monat=2026-08')

    assert response.status_code == 400


# Rate-Limit (RATE_LIMIT_DATA_EXPORT) ----------------------------------------------


def test_report_endpoints_are_rate_limited_like_the_data_export(setup):
    caches['throttle'].clear()
    limit = 2  # Standardwert von RATE_LIMIT_DATA_EXPORT, siehe .env.example/settings.py

    for _ in range(limit):
        response = setup['client'].get('/api/v1/finanzen/berichte/csv/?monat=2026-08')
        assert response.status_code == 200

    blocked = setup['client'].get('/api/v1/finanzen/berichte/csv/?monat=2026-08')
    assert blocked.status_code == 429


def test_csv_and_pdf_share_the_same_rate_limit_bucket(setup):
    # dasselbe Limit für BEIDE Formate zusammen, nicht getrennt gezählt —
    # sonst ließe sich das Limit umgehen, indem man zwischen CSV und PDF
    # abwechselt.
    caches['throttle'].clear()

    assert setup['client'].get('/api/v1/finanzen/berichte/csv/?monat=2026-08').status_code == 200
    assert setup['client'].get('/api/v1/finanzen/berichte/pdf/?monat=2026-08').status_code == 200
    assert setup['client'].get('/api/v1/finanzen/berichte/csv/?monat=2026-08').status_code == 429
