"""Unabhängige QA der Connection Engine V2 (02.11.2026) — Szenarien mit den fiktiven Testdaten aus dem QA-Auftrag.

Personen: A = Eigentümerin (Haushalts-Admin), B = Haushaltsmitglied, C = Außenstehende (eigener Haushalt).
Das Datum ist auf den 02.11.2026 (Europe/Berlin) festgesetzt, damit die Fälle mit Daten in 2027 nicht veralten.
IDs (QA2-…) und Ergebnisse: docs/qa/CONNECTION_V2_RESULTS.md. Tests, die eine FEHLENDE Funktion belegen, prüfen das
heutige Verhalten und sind mit „MISSING“ kommentiert (docs/qa/CONNECTION_V2_BUGS.md)."""

from datetime import date, datetime, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

import pytest
from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from connections.models import AutoKind, AutoLink, AutoLinkEvent
from core.models import Household, HouseholdMembership
from finanzen.models import Category, Transaction
from haushalt.models import FolderEntry, Task as HouseholdTask
from reisen.models import Trip, TripExpense

pytestmark = pytest.mark.django_db

AUTO = '/api/v1/connections/auto/'
CALENDAR = '/api/v1/connections/auto/calendar/'
HH_TASKS = '/api/v1/connections/auto/household-tasks/'
ORDNER = '/api/v1/haushalt/ordner/'
AUFGABEN = '/api/v1/haushalt/aufgaben/'
ITEMS = '/api/v1/haushalt/einkauf/eintraege/'
COMPLETE = '/api/v1/haushalt/einkauf/eintraege/abschliessen/'
SUMMARY = '/api/v1/finanzen/private/summary/'
TX = '/api/v1/finanzen/private/transactions/'
TRIPS = '/api/v1/reisen/trips/'
EXPENSES = '/api/v1/reisen/expenses/'
BUDGET_CATS = '/api/v1/reisen/budget-categories/'
ORG = '/api/v1/organisation/'

TODAY = date(2026, 11, 2)
BERLIN = ZoneInfo('Europe/Berlin')


@pytest.fixture(autouse=True)
def fixed_today(monkeypatch):
    now = datetime(2026, 11, 2, 10, 0, tzinfo=BERLIN)
    monkeypatch.setattr(timezone, 'now', lambda: now)
    monkeypatch.setattr(timezone, 'localdate', lambda value=None, tz=None: TODAY if value is None else value.astimezone(tz or BERLIN).date())


def _user(name):
    return get_user_model().objects.create_user(username=f'{name}@example.test', email=f'{name}@example.test',
                                                password='irrelevant-1A', first_name=name.upper())


def _client(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


@pytest.fixture
def abc():
    a, b, c = _user('a'), _user('b'), _user('c')
    home = Household.objects.create(name='Haushalt A')
    HouseholdMembership.objects.create(user=a, household=home, role=HouseholdMembership.Role.ADMIN)
    HouseholdMembership.objects.create(user=b, household=home)
    HouseholdMembership.objects.create(user=c, household=Household.objects.create(name='Haushalt C'),
                                       role=HouseholdMembership.Role.ADMIN)
    return {'a': a, 'b': b, 'c': c, 'home': home, 'A': _client(a), 'B': _client(b), 'C': _client(c)}


def _telekom(client, **extra):
    body = {'kind': 'vertrag', 'name': 'Telekom Internet', 'provider': 'Telekom', 'cost': '39.99',
            'billing_cycle': 'MONTHLY', 'start_date': '2027-01-01', 'end_date': '2027-12-31',
            'notice_period_days': 30, **extra}
    r = client.post(ORDNER, body, format='json')
    assert r.status_code == 201, r.data
    return r.data['id']


def _link(client, kind, source_id):
    r = client.post(AUTO, {'kind': kind, 'source_id': source_id}, format='json')
    assert r.status_code in (200, 201), r.data
    return r


def _contract_items(client, month):
    data = client.get(SUMMARY, {'month': month}).data
    return [i for i in data['planned_items'] if i['kind'] == 'CONTRACT']


def _calendar(client, start, end):
    r = client.get(CALENDAR, {'start': start, 'end': end})
    assert r.status_code == 200, r.data
    return r.data


# --- QA2-01 … 06: Telekom-Vertrag ----------------------------------------------------------------------------------

def test_qa2_01_timezone_is_berlin():
    assert settings.TIME_ZONE == 'Europe/Berlin' and settings.USE_TZ is True
    assert timezone.localdate() == TODAY


def test_qa2_02_telekom_plans_39_99_every_month_of_2027_and_nothing_after(abc):
    A = abc['A']
    cid = _telekom(A)
    _link(A, AutoKind.CONTRACT_FINANCE, cid)
    assert _contract_items(A, '2026-12') == []  # vor Vertragsbeginn
    for month in ('2027-01', '2027-06', '2027-12'):
        items = _contract_items(A, month)
        assert len(items) == 1 and items[0]['amount'] == '39.99' and items[0]['title'] == 'Telekom Internet', month
        assert items[0]['date'] == f'{month}-01'
    assert _contract_items(A, '2028-01') == []  # Vertragsende, keine automatische Verlängerung
    assert not Transaction.all_objects.exists()  # Planung ist nie eine Buchung


def test_qa2_03_saving_and_linking_twice_gives_one_link_and_one_planned_item(abc):
    A = abc['A']
    cid = _telekom(A)
    first, second = _link(A, AutoKind.CONTRACT_FINANCE, cid), _link(A, AutoKind.CONTRACT_FINANCE, cid)
    assert (first.status_code, second.status_code) == (201, 200)
    assert AutoLink.objects.filter(owner=abc['a'], kind=AutoKind.CONTRACT_FINANCE).count() == 1
    assert A.patch(f'{ORDNER}{cid}/', {'name': 'Telekom Internet'}, format='json').status_code == 200  # erneut speichern
    assert len(_contract_items(A, '2027-02')) == 1


def test_qa2_04_cancellation_deadline_with_one_month_notice_and_14_days_lead(abc):
    """1 Monat Frist zum 31.12.2027 → letzter Kündigungstag 30.11.2027 (BUG-QA2-02) und ein Hinweis 14 Tage vorher am
    16.11.2027 (BUG-QA2-03), beide behoben 02.11.2026."""
    A = abc['A']
    cid = _telekom(A, notice_period_days=None, notice_period_months=1)
    entry = A.get(f'{ORDNER}{cid}/').data
    assert (entry['notice_period_months'], entry['notice_period_days'], entry['reminder_lead_days']) == (1, None, 14)
    assert entry['cancellation_deadline'] == '2027-11-30'
    states = A.get(AUTO, {'source_type': 'CONTRACT', 'source_id': cid}).data
    reminder = next(s for s in states if s['kind'] == AutoKind.CONTRACT_REMINDER)
    assert 'am 30.11.2027' in reminder['preview'] and 'Hinweis 14 Tage vorher (16.11.2027)' in reminder['preview']
    _link(A, AutoKind.CONTRACT_REMINDER, cid)
    items = _calendar(A, '2027-11-01', '2027-12-31')
    assert [(i['date'], i['title'], i['source_id']) for i in items] == [
        ('2027-11-16', 'Kündigung vorbereiten: Telekom Internet (bis 30.11.2027)', cid),
        ('2027-11-30', 'Kündigen bis: Telekom Internet', cid),
    ]
    assert len({i['key'] for i in items}) == 2
    assert '39' not in str(items)  # Erinnerung verrät keinen Betrag
    # Vorlauf wählbar: 0 = nur am Fristtag; andere Werte als 0/7/14/30 werden abgelehnt.
    assert A.patch(f'{ORDNER}{cid}/', {'reminder_lead_days': 0}, format='json').status_code == 200
    assert [i['date'] for i in _calendar(A, '2027-11-01', '2027-12-31')] == ['2027-11-30']
    assert A.patch(f'{ORDNER}{cid}/', {'reminder_lead_days': 30}, format='json').status_code == 200
    assert [i['date'] for i in _calendar(A, '2027-10-01', '2027-12-31')] == ['2027-10-31', '2027-11-30']
    for bad in (1, 21, -7):
        assert A.patch(f'{ORDNER}{cid}/', {'reminder_lead_days': bad}, format='json').status_code == 400


def test_qa2_04d_lead_reminder_disappears_once_the_deadline_has_passed(abc):
    A = abc['A']
    cid = A.post(ORDNER, {'kind': 'vertrag', 'name': 'Alt', 'end_date': '2026-11-20', 'notice_period_days': 10},
                 format='json').data['id']  # Frist 10.11.2026, Hinweis 27.10.2026 liegt schon zurück
    _link(A, AutoKind.CONTRACT_REMINDER, cid)
    assert [i['date'] for i in _calendar(A, '2026-10-01', '2026-11-30')] == ['2026-10-27', '2026-11-10']
    past = A.post(ORDNER, {'kind': 'vertrag', 'name': 'Vorbei', 'end_date': '2026-11-05', 'notice_period_days': 10,
                           'auto_renewal': True}, format='json').data['id']  # Frist 26.10. ist vorbei
    _link(A, AutoKind.CONTRACT_REMINDER, past)
    assert [i['title'] for i in _calendar(A, '2026-10-01', '2026-10-31') if i['source_id'] == past] == ['Kündigen bis: Vorbei']


def test_qa2_04b_notice_in_days_is_unchanged_and_units_replace_each_other(abc):
    A = abc['A']
    cid = _telekom(A)  # 30 Tage
    assert A.get(f'{ORDNER}{cid}/').data['cancellation_deadline'] == '2027-12-01'
    switched = A.patch(f'{ORDNER}{cid}/', {'notice_period_months': 3}, format='json')
    assert switched.status_code == 200, switched.data
    assert (switched.data['notice_period_days'], switched.data['cancellation_deadline']) == (None, '2027-09-30')
    back = A.patch(f'{ORDNER}{cid}/', {'notice_period_days': 14}, format='json').data
    assert (back['notice_period_months'], back['cancellation_deadline']) == (None, '2027-12-17')
    both = A.post(ORDNER, {'kind': 'vertrag', 'name': 'x', 'notice_period_days': 30, 'notice_period_months': 1},
                  format='json')
    assert both.status_code == 400 and 'notice_period_months' in both.data
    for bad in (0, 37, -1):
        assert A.patch(f'{ORDNER}{cid}/', {'notice_period_months': bad}, format='json').status_code == 400


@pytest.mark.parametrize('end, months, deadline', [
    ('2027-12-31', 1, '2027-11-30'),
    ('2027-06-30', 3, '2027-03-31'),
    ('2027-12-15', 1, '2027-11-15'),
    ('2027-02-28', 1, '2027-01-31'),
    ('2028-03-31', 1, '2028-02-29'),  # Schaltjahr
    ('2027-12-31', 12, '2026-12-31'),
])
def test_qa2_04c_month_notice_is_calendar_based(abc, end, months, deadline):
    r = abc['A'].post(ORDNER, {'kind': 'vertrag', 'name': 'Vertrag', 'end_date': end, 'notice_period_months': months},
                      format='json')
    assert r.status_code == 201, r.data
    assert r.data['cancellation_deadline'] == deadline


def test_qa2_05_price_change_from_a_date(abc):
    """Preis 34,99 € ab 01.03.2027: Januar und Februar bleiben 39,99 € (BUG-QA2-04, behoben 02.11.2026)."""
    A = abc['A']
    cid = _telekom(A)
    _link(A, AutoKind.CONTRACT_FINANCE, cid)
    r = A.patch(f'{ORDNER}{cid}/', {'next_cost': '34.99', 'next_cost_from': '2027-03-01'}, format='json')
    assert r.status_code == 200, r.data
    assert (r.data['cost'], r.data['next_cost'], r.data['next_cost_from']) == ('39.99', '34.99', '2027-03-01')
    assert [_contract_items(A, m)[0]['amount'] for m in ('2027-01', '2027-02', '2027-03', '2027-12')] == [
        '39.99', '39.99', '34.99', '34.99']
    states = A.get(AUTO, {'source_type': 'CONTRACT', 'source_id': cid}).data
    assert 'ab 01.03.2027 34,99 €' in next(s for s in states if s['kind'] == AutoKind.CONTRACT_FINANCE)['preview']
    # nur zusammen; ein Tag heute oder früher gilt sofort als neuer Preis
    assert A.patch(f'{ORDNER}{cid}/', {'next_cost': None}, format='json').status_code == 400
    assert A.patch(f'{ORDNER}{cid}/', {'next_cost': '0'}, format='json').status_code == 400
    now = A.patch(f'{ORDNER}{cid}/', {'next_cost': '29.99', 'next_cost_from': '2026-11-02'}, format='json').data
    assert (now['cost'], now['next_cost'], now['next_cost_from']) == ('29.99', None, None)
    cleared = A.patch(f'{ORDNER}{cid}/', {'next_cost': '31.00', 'next_cost_from': '2027-06-01'}, format='json')
    assert cleared.status_code == 200
    assert A.patch(f'{ORDNER}{cid}/', {'next_cost': None, 'next_cost_from': None}, format='json').data['next_cost'] is None


def test_qa2_05b_announced_price_takes_over_on_its_day_and_stays_private(abc, monkeypatch):
    A, B = abc['A'], abc['B']
    cid = _telekom(A, start_date='2026-11-01')
    A.patch(f'{ORDNER}{cid}/', {'next_cost': '34.99', 'next_cost_from': '2026-12-01'}, format='json')
    member = B.get(f'{ORDNER}{cid}/').data
    assert (member['cost'], member['next_cost'], member['next_cost_from']) == (None, None, None)  # privat wie der Preis
    assert B.patch(f'{ORDNER}{cid}/', {'next_cost': '1.00', 'next_cost_from': '2027-01-01'}, format='json').status_code == 200
    assert FolderEntry.objects.get(pk=cid).next_cost == Decimal('34.99')  # B kann ihn nicht überschreiben
    # Am 01.12.2026 gilt der neue Preis — Anzeige sofort, gespeichert beim nächsten Sichern.
    later = datetime(2026, 12, 1, 9, 0, tzinfo=BERLIN)
    monkeypatch.setattr(timezone, 'now', lambda: later)
    monkeypatch.setattr(timezone, 'localdate', lambda value=None, tz=None: date(2026, 12, 1) if value is None else value.astimezone(tz or BERLIN).date())
    shown = A.get(f'{ORDNER}{cid}/').data
    assert (shown['cost'], shown['next_cost'], shown['monthly_equivalent']) == ('34.99', None, '34.99')
    assert A.patch(f'{ORDNER}{cid}/', {'name': 'Telekom'}, format='json').status_code == 200
    entry = FolderEntry.objects.get(pk=cid)
    assert (entry.cost, entry.next_cost, entry.next_cost_from) == (Decimal('34.99'), None, None)


def test_qa2_06_booked_payment_replaces_the_plan_and_survives_a_price_change(abc):
    A, a = abc['A'], abc['a']
    cid = _telekom(A, start_date='2026-11-01')
    _link(A, AutoKind.CONTRACT_FINANCE, cid)
    cat = Category.objects.create(owner=a, name='Internet')
    paid = A.post(TX, {'amount': '39.99', 'type': 'EXPENSE', 'date': '2026-11-01', 'category': cat.id,
                       'note': 'Telekom Internet'}, format='json')
    assert paid.status_code == 201, paid.data
    assert _contract_items(A, '2026-11') == []  # gebucht ersetzt geplant — keine Doppelzählung
    A.patch(f'{ORDNER}{cid}/', {'cost': '34.99'}, format='json')
    assert Transaction.objects.get(pk=paid.data['id']).amount == Decimal('39.99')  # historische Zahlung unverändert
    assert _contract_items(A, '2026-12')[0]['amount'] == '34.99'


# --- QA2-07: mehrere Verträge -------------------------------------------------------------------------------------

def test_qa2_07_two_contracts_are_planned_side_by_side(abc):
    A = abc['A']
    telekom = _telekom(A)
    strom = A.post(ORDNER, {'kind': 'vertrag', 'name': 'Strom', 'cost': '75.00', 'billing_cycle': 'MONTHLY',
                            'start_date': '2027-01-15'}, format='json').data['id']
    for cid in (telekom, strom):
        _link(A, AutoKind.CONTRACT_FINANCE, cid)
    items = _contract_items(A, '2027-01')
    assert sorted((i['title'], i['amount'], i['date']) for i in items) == [
        ('Strom', '75.00', '2027-01-15'), ('Telekom Internet', '39.99', '2027-01-01')]
    total = A.get(SUMMARY, {'month': '2027-01'}).data['planned']
    assert Decimal(total) == Decimal('114.99')


# --- QA2-08: wöchentliche Aufgabe ---------------------------------------------------------------------------------

def test_qa2_08_weekly_task_appears_in_organisation_and_completing_moves_it_on(abc):
    A = abc['A']
    task = A.post(AUFGABEN, {'title': 'Wohnung reinigen', 'recurrence_days': 7}, format='json')
    assert task.status_code == 201, task.data
    _link(A, AutoKind.HOUSEHOLD_TASKS, abc['home'].id)
    listed = A.get(HH_TASKS).data
    titles = [t['title'] for t in (listed['tasks'] if isinstance(listed, dict) else listed)]
    assert titles.count('Wohnung reinigen') == 1
    done = A.post(f"{AUFGABEN}{task.data['id']}/erledigt/")
    assert done.status_code == 200 and done.data['due_date'] == '2026-11-09'
    assert HouseholdTask.objects.filter(title='Wohnung reinigen').count() == 1  # kein Duplikat
    # C sieht die Haushaltsaufgaben von A nie, auch nicht über die Verbindungs-API.
    other = abc['C'].get(HH_TASKS).data
    assert 'Wohnung reinigen' not in str(other)


# --- QA2-09/10: Gerät ---------------------------------------------------------------------------------------------

def test_qa2_09_device_with_serial_number_only_in_the_detail_view(abc):
    """Seriennummer TEST-ABC-123 (BUG-QA2-01, behoben 02.11.2026): gespeichert, nur in der Detailansicht."""
    A = abc['A']
    r = A.post(ORDNER, {'kind': 'geraet', 'name': 'Waschmaschine', 'provider': 'Samsung', 'model': 'TEST-WM-100',
                        'serial_number': ' TEST-ABC-123 ', 'maintenance_interval_months': 6,
                        'maintenance_due_date': '2027-01-01'}, format='json')
    assert r.status_code == 201, r.data
    assert (r.data['model'], r.data['serial_number']) == ('TEST-WM-100', 'TEST-ABC-123')
    assert A.get(f"{ORDNER}{r.data['id']}/").data['serial_number'] == 'TEST-ABC-123'
    assert 'TEST-ABC-123' not in str(A.get(ORDNER).data)  # nie in Listen
    assert 'TEST-ABC-123' not in str(abc['C'].get(f"{ORDNER}{r.data['id']}/").data)
    contract = A.post(ORDNER, {'kind': 'vertrag', 'name': 'x', 'serial_number': 'NOPE'}, format='json').data
    assert 'serial_number' not in contract  # Verträge haben keine Seriennummer
    assert A.post(ORDNER, {'kind': 'geraet', 'name': 'y', 'serial_number': 'x' * 61}, format='json').status_code == 400
    _link(A, AutoKind.DEVICE_MAINTENANCE, r.data['id'])
    assert [i['date'] for i in _calendar(A, '2026-12-01', '2027-02-28')] == ['2027-01-01']


def test_qa2_10_last_maintenance_sets_the_next_one(abc):
    """Letzte Wartung 01.07.2026, Intervall 6 → nächste 01.01.2027; letzte auf 01.08.2026 → 01.02.2027
    (BUG-QA2-05, behoben 02.11.2026). Wie „Wartung erledigt“: nächste = letzte + Intervall."""
    A = abc['A']
    r = A.post(ORDNER, {'kind': 'geraet', 'name': 'Waschmaschine', 'model': 'TEST-WM-100',
                        'last_maintenance': '2026-07-01', 'maintenance_interval_months': 6}, format='json')
    assert r.status_code == 201, r.data
    assert r.data['maintenance_due_date'] == '2027-01-01'
    eid = r.data['id']
    # so sendet es das Formular: alle Felder, der alte Termin unverändert dabei → wird neu berechnet
    moved = A.patch(f'{ORDNER}{eid}/', {'last_maintenance': '2026-08-01', 'maintenance_due_date': '2027-01-01',
                                       'maintenance_interval_months': 6}, format='json')
    assert moved.status_code == 200 and moved.data['maintenance_due_date'] == '2027-02-01'
    longer = A.patch(f'{ORDNER}{eid}/', {'maintenance_interval_months': 12}, format='json').data
    assert longer['maintenance_due_date'] == '2027-08-01'
    # ein ausdrücklich gesetzter Termin gewinnt
    manual = A.patch(f'{ORDNER}{eid}/', {'maintenance_due_date': '2027-03-15'}, format='json').data
    assert manual['maintenance_due_date'] == '2027-03-15'
    same = A.patch(f'{ORDNER}{eid}/', {'name': 'Waschmaschine Keller'}, format='json').data
    assert same['maintenance_due_date'] == '2027-03-15'
    # länger her: der Termin liegt in der Vergangenheit → überfällig statt geraten
    old = A.post(ORDNER, {'kind': 'geraet', 'name': 'Therme', 'last_maintenance': '2025-01-10',
                          'maintenance_interval_months': 12}, format='json').data
    assert old['maintenance_due_date'] == '2026-01-10'


# --- QA2-11: Einkauf ----------------------------------------------------------------------------------------------

def test_qa2_11_shopping_24_50_books_exactly_once(abc):
    A = abc['A']
    for name in ('Milch', 'Reis', 'Brot', 'Gemüse'):
        item = A.post(ITEMS, {'name': name}, format='json').data
        assert A.patch(f"{ITEMS}{item['id']}/", {'is_checked': True}, format='json').status_code == 200
    assert not Transaction.all_objects.exists()  # Abhaken ist keine Buchung
    assert A.post(COMPLETE, {'amount': '24.50'}, format='json').status_code == 201
    assert A.post(COMPLETE, {'amount': '24.50'}, format='json').status_code != 201  # Wiederholung
    tx = Transaction.objects.get()
    assert tx.amount == Decimal('24.50') and tx.owner_id == abc['a'].id
    # B (gleicher Haushalt) sieht die private Buchung von A nicht.
    assert abc['B'].get(f'{TX}{tx.id}/').status_code == 404


# --- QA2-12 … 15: Reise Japan -------------------------------------------------------------------------------------

def _japan(client, **extra):
    r = client.post(TRIPS, {'title': 'Japan', 'destination': 'Tokio', 'start_date': '2027-03-12',
                            'end_date': '2027-03-19', 'budget_amount': '2000.00', 'currency': 'EUR', **extra},
                    format='json')
    assert r.status_code == 201, r.data
    return r.data['id']


def test_qa2_12_japan_budget_planned_and_paid_without_double_counting(abc):
    A = abc['A']
    trip = _japan(A)
    for category, amount in (('TRANSPORT', '750.00'), ('UNTERKUNFT', '550.00')):
        r = A.post(BUDGET_CATS, {'trip': trip, 'category': category, 'planned_amount': amount}, format='json')
        assert r.status_code == 201, r.data
    planned_only = A.get(f'{TRIPS}{trip}/summary/').data
    assert (planned_only['budget_spent'], planned_only['budget_remaining']) == ('0.00', '2000.00')  # geplant ≠ bezahlt
    for title, category, amount in (('Flug', 'TRANSPORT', '750.00'), ('Hotel', 'UNTERKUNFT', '550.00')):
        r = A.post(EXPENSES, {'trip': trip, 'title': title, 'category': category, 'amount': amount,
                              'date': '2027-03-12'}, format='json')
        assert r.status_code == 201, r.data
    summary = A.get(f'{TRIPS}{trip}/summary/').data
    assert (summary['budget_total'], summary['budget_spent'], summary['budget_remaining']) == ('2000.00', '1300.00', '700.00')
    assert not Transaction.all_objects.exists()  # Reisekosten erscheinen nicht in Finanzen
    assert A.get(SUMMARY, {'month': '2027-03'}).data['planned_items'] == []


def test_qa2_13_trip_calendar_follows_a_moved_end_date(abc):
    A = abc['A']
    trip = _japan(A)
    _link(A, AutoKind.TRIP_CALENDAR, trip)
    before = _calendar(A, '2027-03-01', '2027-03-31')
    assert [(i['date'], i['end_date']) for i in before] == [('2027-03-12', '2027-03-19')]
    assert A.patch(f'{TRIPS}{trip}/', {'end_date': '2027-03-21'}, format='json').status_code == 200
    after = _calendar(A, '2027-03-01', '2027-03-31')
    assert [(i['date'], i['end_date']) for i in after] == [('2027-03-12', '2027-03-21')]
    assert AutoLink.objects.count() == 1  # nichts kopiert, nichts doppelt


def test_qa2_14_overlapping_trip_is_reported_but_not_blocked(abc):
    A = abc['A']
    japan = _japan(A, end_date='2027-03-21')
    overlaps = A.get(f'{TRIPS}overlaps/', {'start_date': '2027-03-18', 'end_date': '2027-03-20'}).data
    assert [t['id'] for t in overlaps] == [japan]
    second = A.post(TRIPS, {'title': 'Kyoto', 'destination': 'Kyoto', 'start_date': '2027-03-18',
                            'end_date': '2027-03-20'}, format='json')
    assert second.status_code == 201  # rein informativ
    assert abc['C'].get(f'{TRIPS}overlaps/', {'start_date': '2027-03-18', 'end_date': '2027-03-20'}).data == []


def test_qa2_15_trip_in_foreign_currency_is_not_converted_or_booked(abc):
    A = abc['A']
    trip = _japan(A, currency='JPY', budget_amount='300000.00')
    r = A.post(EXPENSES, {'trip': trip, 'title': 'Ryokan', 'category': 'UNTERKUNFT', 'amount': '45000.00',
                          'currency': 'JPY', 'date': '2027-03-13'}, format='json')
    assert r.status_code == 201, r.data
    assert r.data['amount_trip'] == '45000.00'  # gleiche Währung: Kurs 1, nichts geraten
    summary = A.get(f'{TRIPS}{trip}/summary/').data
    assert (summary['currency'], summary['budget_remaining']) == ('JPY', '255000.00')
    assert not Transaction.all_objects.exists()


# --- QA2-16 … 19: Berechtigungen A/B/C ----------------------------------------------------------------------------

def test_qa2_16_private_expense_of_a_is_invisible_to_b_and_c(abc):
    A = abc['A']
    cat = Category.objects.create(owner=abc['a'], name='Privat')
    r = A.post(TX, {'amount': '300.00', 'type': 'EXPENSE', 'date': '2026-11-02', 'category': cat.id,
                    'note': 'Privatausgabe'}, format='json')
    assert r.status_code == 201, r.data
    for who in ('B', 'C'):
        client = abc[who]
        assert client.get(f"{TX}{r.data['id']}/").status_code == 404
        assert client.patch(f"{TX}{r.data['id']}/", {'amount': '1.00'}, format='json').status_code == 404
        assert client.delete(f"{TX}{r.data['id']}/").status_code == 404
        assert client.get(SUMMARY, {'month': '2026-11'}).data['spent'] == '0.00'
    assert Transaction.objects.get(pk=r.data['id']).amount == Decimal('300.00')


def test_qa2_17_member_b_cannot_use_or_change_the_connection_of_a(abc):
    A, B = abc['A'], abc['B']
    cid = _telekom(A)
    link_id = _link(A, AutoKind.CONTRACT_FINANCE, cid).data['link_id']
    _link(A, AutoKind.CONTRACT_REMINDER, cid)
    # B sieht den Vertrag (gemeinsamer Haushalt), aber nicht die Verbindung von A …
    states = B.get(AUTO, {'source_type': 'CONTRACT', 'source_id': cid}).data
    assert all(s['link_id'] is None for s in states)
    assert '39' not in str(states)  # … und nicht den Betrag
    assert B.patch(f'{AUTO}{link_id}/', {'status': 'PAUSED'}, format='json').status_code == 404
    assert B.delete(f'{AUTO}{link_id}/').status_code == 404
    # Betrag eines anderen planen ist verboten; die Fristerinnerung (ohne Betrag) darf B für sich einschalten.
    assert B.post(AUTO, {'kind': AutoKind.CONTRACT_FINANCE, 'source_id': cid}, format='json').status_code == 403
    assert _contract_items(B, '2027-01') == []
    assert _calendar(B, '2027-11-01', '2027-12-31') == []  # Verbindung von A wirkt nicht für B
    _link(B, AutoKind.CONTRACT_REMINDER, cid)
    assert len(_calendar(B, '2027-11-01', '2027-12-31')) == 2  # Hinweis 14 Tage vorher + Fristtag
    assert AutoLink.objects.get(pk=link_id).status == 'ACTIVE'


def test_qa2_18_outsider_c_gets_404_everywhere(abc):
    A, C = abc['A'], abc['C']
    cid = _telekom(A)
    trip = _japan(A)
    link_id = _link(A, AutoKind.CONTRACT_FINANCE, cid).data['link_id']
    _link(A, AutoKind.TRIP_CALENDAR, trip)
    assert C.get(f'{ORDNER}{cid}/').status_code == 404
    assert C.get(f'{TRIPS}{trip}/summary/').status_code == 404
    assert C.get(AUTO, {'source_type': 'CONTRACT', 'source_id': cid}).status_code == 404
    for kind, source in ((AutoKind.CONTRACT_REMINDER, cid), (AutoKind.TRIP_CALENDAR, trip),
                         (AutoKind.HOUSEHOLD_TASKS, abc['home'].id)):
        assert C.post(AUTO, {'kind': kind, 'source_id': source}, format='json').status_code == 404, kind
    assert C.patch(f'{AUTO}{link_id}/', {'status': 'PAUSED'}, format='json').status_code == 404
    assert C.delete(f'{AUTO}{link_id}/').status_code == 404
    assert _calendar(C, '2027-01-01', '2027-12-31') == []
    assert not AutoLink.objects.filter(owner=abc['c']).exists()


def test_qa2_19_leaving_the_household_removes_derived_items_but_keeps_data(abc):
    A, B = abc['A'], abc['B']
    cid = _telekom(A)
    _link(B, AutoKind.CONTRACT_REMINDER, cid)
    assert len(_calendar(B, '2027-11-01', '2027-12-31')) == 2
    HouseholdMembership.objects.filter(user=abc['b']).delete()
    assert _calendar(B, '2027-11-01', '2027-12-31') == []  # Verbindung gewährt nie Zugriff
    assert FolderEntry.objects.filter(pk=cid).exists()


# --- QA2-20 … 22: Eingaben, Idempotenz, Lebenszyklus --------------------------------------------------------------

@pytest.mark.parametrize('amount', ['-5.00', '0', 'abc', '1e15'])
def test_qa2_20_invalid_amounts_are_rejected_everywhere(abc, amount):
    A = abc['A']
    cat = Category.objects.create(owner=abc['a'], name='Test')
    assert A.post(TX, {'amount': amount, 'type': 'EXPENSE', 'date': '2026-11-02', 'category': cat.id},
                  format='json').status_code == 400
    trip = _japan(A)
    assert A.post(EXPENSES, {'trip': trip, 'title': 'x', 'amount': amount, 'date': '2027-03-12'},
                  format='json').status_code == 400
    if amount != '0':
        assert A.post(ORDNER, {'kind': 'vertrag', 'name': 'x', 'cost': amount}, format='json').status_code == 400
        assert A.post(BUDGET_CATS, {'trip': trip, 'category': 'ESSEN', 'planned_amount': amount},
                      format='json').status_code == 400
    assert not Transaction.all_objects.exists() and not TripExpense.objects.exists()


def test_qa2_21_invalid_connection_requests(abc):
    A = abc['A']
    cid = _telekom(A)
    assert A.post(AUTO, {'kind': 'NOPE', 'source_id': cid}, format='json').status_code == 400
    assert A.post(AUTO, {'kind': AutoKind.CONTRACT_FINANCE, 'source_id': 'x'}, format='json').status_code == 400
    assert A.post(AUTO, {'kind': AutoKind.CONTRACT_FINANCE, 'source_id': 999999}, format='json').status_code == 404
    assert A.get(CALENDAR, {'start': '2027-01-01', 'end': '2028-12-31'}).status_code == 400  # > 400 Tage
    assert A.get(CALENDAR, {'start': '2027-02-01', 'end': '2027-01-01'}).status_code == 400
    link_id = _link(A, AutoKind.CONTRACT_FINANCE, cid).data['link_id']
    assert A.patch(f'{AUTO}{link_id}/', {'status': 'WHATEVER'}, format='json').status_code == 400
    assert not AutoLink.objects.exclude(pk=link_id).exists()


def test_qa2_22_pause_resume_unlink_and_delete_source(abc):
    A = abc['A']
    cid = _telekom(A)
    link_id = _link(A, AutoKind.CONTRACT_FINANCE, cid).data['link_id']
    A.patch(f'{AUTO}{link_id}/', {'status': 'PAUSED'}, format='json')
    assert _contract_items(A, '2027-01') == []
    A.patch(f'{AUTO}{link_id}/', {'status': 'ACTIVE'}, format='json')
    assert len(_contract_items(A, '2027-01')) == 1
    assert A.delete(f'{AUTO}{link_id}/').status_code == 204
    assert _contract_items(A, '2027-01') == [] and FolderEntry.objects.filter(pk=cid).exists()
    _link(A, AutoKind.CONTRACT_FINANCE, cid)
    assert A.delete(f'{ORDNER}{cid}/').status_code == 204
    assert not AutoLink.objects.exists()
    actions = list(AutoLinkEvent.objects.order_by('id').values_list('action', flat=True))
    assert actions == ['CREATE', 'PAUSE', 'RESUME', 'UNLINK', 'CREATE', 'SOURCE_GONE']
    assert 'Telekom' not in str(list(AutoLinkEvent.objects.values()))  # Protokoll ohne Inhalte


# --- QA2-23: alle vier Module ohne Verbindungen -------------------------------------------------------------------

def test_qa2_23_crud_in_all_four_modules_without_connections(abc):
    A = abc['A']
    # Haushalt
    task = A.post(AUFGABEN, {'title': 'Wohnung reinigen', 'recurrence_days': 7}, format='json').data
    assert A.patch(f"{AUFGABEN}{task['id']}/", {'title': 'Wohnung putzen'}, format='json').status_code == 200
    assert A.delete(f"{AUFGABEN}{task['id']}/").status_code == 204
    cid = _telekom(A)
    assert A.get(f'{ORDNER}{cid}/').data['name'] == 'Telekom Internet'
    assert A.delete(f'{ORDNER}{cid}/').status_code == 204
    # Finanzen
    cat = Category.objects.create(owner=abc['a'], name='Alltag')
    tx = A.post(TX, {'amount': '12.00', 'type': 'EXPENSE', 'date': '2026-11-02', 'category': cat.id}, format='json').data
    assert A.patch(f"{TX}{tx['id']}/", {'amount': '13.00'}, format='json').data['amount'] == '13.00'
    assert A.delete(f"{TX}{tx['id']}/").status_code == 204
    # Organisation
    event = A.post(f'{ORG}events/', {'title': 'Zahnarzt', 'starts_at': '2026-11-10T09:00:00+01:00'}, format='json')
    assert event.status_code == 201, event.data
    assert A.patch(f"{ORG}events/{event.data['id']}/", {'title': 'Zahnarzt Kontrolle'}, format='json').status_code == 200
    assert A.delete(f"{ORG}events/{event.data['id']}/").status_code == 204
    otask = A.post(f'{ORG}tasks/', {'title': 'Steuer'}, format='json')
    assert otask.status_code == 201, otask.data
    assert A.delete(f"{ORG}tasks/{otask.data['id']}/").status_code == 204
    note = A.post(f'{ORG}notes/', {'title': 'Idee', 'body': 'Text'}, format='json')
    assert note.status_code == 201, note.data
    assert A.delete(f"{ORG}notes/{note.data['id']}/").status_code == 204
    # Reisen
    trip = _japan(A)
    assert A.patch(f'{TRIPS}{trip}/', {'title': 'Japan 2027'}, format='json').status_code == 200
    assert A.delete(f'{TRIPS}{trip}/').status_code == 204
    assert not Trip.objects.exists()
    # Nichts davon hat eine Verbindung angelegt.
    assert not AutoLink.objects.exists()
    assert not AutoLinkEvent.objects.exclude(action='SOURCE_GONE').exists()
