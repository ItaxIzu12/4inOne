"""Haushaltsordner: Verträge und Geräte, Fristen, eigene Vertragskosten
(ADR-001: keine Verknüpfung mehr zu den eingefrorenen Haushaltsfinanzen)."""

from datetime import date, timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from finanzen.models import RecurringDeduction
from haushalt import services
from haushalt.models import FolderEntry
from organisation.models import CalendarEvent

pytestmark = pytest.mark.django_db

URL = '/api/v1/haushalt/ordner/'


def _deadline_days(entry):
    return {deadline['titel']: date.fromisoformat(deadline['datum']) for deadline in entry['deadlines']}


def test_add_months_clamps_to_month_end():
    assert services.add_months(date(2026, 1, 31), 1) == date(2026, 2, 28)
    assert services.add_months(date(2026, 3, 31), -1) == date(2026, 2, 28)
    assert services.add_months(date(2026, 11, 15), 3) == date(2027, 2, 15)


def test_contract_cancel_by_date_is_a_deadline(anna, household, client_for):
    end = timezone.localdate() + timedelta(days=200)
    response = client_for(anna).post(
        URL,
        {'kind': 'vertrag', 'name': 'Stromvertrag', 'contract_end': end.isoformat(), 'notice_period_months': 3},
        format='json',
    )

    assert response.status_code == 201, response.data
    expected = services.add_months(end, -3)
    assert response.data['cancel_by'] == expected.isoformat()
    assert _deadline_days(response.data) == {'Kündigen bis: Stromvertrag': expected}


def test_contract_has_its_own_monthly_cost(anna, client_for):
    client = client_for(anna)
    response = client.post(URL, {'kind': 'vertrag', 'name': 'Internet', 'monthly_cost': '39.99'}, format='json')
    assert response.status_code == 201, response.data
    assert response.data['monthly_cost'] == '39.99'

    changed = client.patch(f'{URL}{response.data["id"]}/', {'monthly_cost': None}, format='json')
    assert changed.data['monthly_cost'] is None

    too_much = client.post(URL, {'kind': 'vertrag', 'name': 'X', 'monthly_cost': '100000.00'}, format='json')
    assert too_much.status_code == 400
    negative = client.post(URL, {'kind': 'vertrag', 'name': 'X', 'monthly_cost': '-1.00'}, format='json')
    assert negative.status_code == 400


def test_folder_no_longer_touches_frozen_household_finances(anna, household, client_for):
    deduction = RecurringDeduction.objects.create(household=household, name='Internet', amount=Decimal('39.99'))
    client = client_for(anna)
    assert client.get(f'{URL}abzuege/').status_code == 404
    response = client.post(
        URL, {'kind': 'vertrag', 'name': 'Internet', 'recurring_deduction_id': deduction.id}, format='json'
    )
    assert 'recurring_deduction_id' not in response.data
    assert 'deduction_active' not in response.data
    assert response.data['monthly_cost'] is None


def test_device_has_no_monthly_cost(anna, client_for):
    response = client_for(anna).post(URL, {'kind': 'geraet', 'name': 'Föhn', 'monthly_cost': '5.00'}, format='json')
    assert FolderEntry.objects.get(pk=response.data['id']).monthly_cost is None


def test_device_warranty_and_maintenance_are_deadlines(anna, household, client_for):
    warranty = timezone.localdate() + timedelta(days=400)
    response = client_for(anna).post(
        URL,
        {
            'kind': 'geraet',
            'name': 'Heizung',
            'warranty_until': warranty.isoformat(),
            'maintenance_interval_months': 12,
        },
        format='json',
    )

    assert response.status_code == 201, response.data
    first_maintenance = services.add_months(timezone.localdate(), 12)
    assert response.data['next_maintenance'] == first_maintenance.isoformat()
    assert _deadline_days(response.data) == {
        'Garantie endet: Heizung': warranty,
        'Wartung: Heizung': first_maintenance,
    }


def test_old_device_gets_next_upcoming_maintenance_not_one_in_the_past(anna, client_for):
    bought = timezone.localdate() - timedelta(days=3 * 365)
    response = client_for(anna).post(
        URL,
        {'kind': 'geraet', 'name': 'Rauchmelder', 'purchase_date': bought.isoformat(), 'maintenance_interval_months': 12},
        format='json',
    )
    assert date.fromisoformat(response.data['next_maintenance']) >= timezone.localdate()


def test_maintenance_done_schedules_the_next_one(anna, household, client_for):
    client = client_for(anna)
    entry = client.post(
        URL,
        {
            'kind': 'geraet',
            'name': 'Heizung',
            'maintenance_interval_months': 6,
            'next_maintenance': timezone.localdate().isoformat(),
        },
        format='json',
    ).data

    response = client.post(f'{URL}{entry["id"]}/wartung-erledigt/')

    expected = services.add_months(timezone.localdate(), 6)
    assert response.data['next_maintenance'] == expected.isoformat()
    assert _deadline_days(response.data) == {'Wartung: Heizung': expected}


def test_folder_deadlines_are_not_copied_into_the_old_calendar(anna, household, client_for):
    client = client_for(anna)
    entry = client.post(
        URL, {'kind': 'geraet', 'name': 'Waschmaschine', 'warranty_until': '2030-01-01'}, format='json'
    ).data
    assert _deadline_days(entry) == {'Garantie endet: Waschmaschine': date(2030, 1, 1)}

    cleared = client.patch(f'{URL}{entry["id"]}/', {'warranty_until': None}, format='json').data
    assert cleared['deadlines'] == []
    assert not CalendarEvent.objects.filter(household=household).exists()


def test_fields_of_the_other_kind_are_ignored(anna, client_for):
    response = client_for(anna).post(
        URL, {'kind': 'geraet', 'name': 'Föhn', 'notice_period_months': 3, 'contract_end': '2030-01-01'}, format='json'
    )
    entry = FolderEntry.objects.get(pk=response.data['id'])
    assert entry.notice_period_months is None
    assert entry.contract_end is None


def test_child_accounts_have_no_access(kind, client_for):
    client = client_for(kind)
    assert client.get(URL).status_code == 403
    assert client.post(URL, {'kind': 'geraet', 'name': 'X'}, format='json').status_code == 403


def test_entries_of_another_household_are_invisible(anna, fremd, client_for):
    entry = client_for(fremd).post(URL, {'kind': 'geraet', 'name': 'Geheim'}, format='json').data
    client = client_for(anna)
    assert client.get(URL).data == []
    assert client.patch(f'{URL}{entry["id"]}/', {'name': 'Gehackt'}, format='json').status_code == 404


def test_folder_entry_limit_per_household(anna, client_for, monkeypatch):
    monkeypatch.setattr(services, 'MAX_FOLDER_ENTRIES', 1)
    client = client_for(anna)
    assert client.post(URL, {'kind': 'geraet', 'name': 'Eins'}, format='json').status_code == 201
    assert client.post(URL, {'kind': 'geraet', 'name': 'Zwei'}, format='json').status_code == 400
