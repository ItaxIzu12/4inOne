"""Connection Engine V2 — abgeleitete Verbindungen (01.11.2026).

Pflicht-Szenario „Internetvertrag“ aus dem Entwicklungsplan (Abschnitt 2.5) und die kritischen Fälle QA-01 … QA-14
(docs/CONNECTION_ENGINE_V2_TEST_REPORT.md). Anna (Admin) und Ben (Mitglied) teilen einen Haushalt, Kim ist ein
Kind-Konto, Dora gehört zu einem anderen Haushalt."""

from datetime import date, timedelta
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError
from django.utils import timezone
from rest_framework.test import APIClient

from connections import auto_links
from connections.models import AutoKind, AutoLink, AutoLinkEvent, AutoStatus
from core.models import Household, HouseholdMembership
from finanzen.models import SavingsGoal, Transaction
from haushalt.models import FolderEntry, Task as HouseholdTask
from organisation.models import PersonalEvent, PersonalTask
from reisen.models import Trip, TripParticipant

pytestmark = pytest.mark.django_db

AUTO = '/api/v1/connections/auto/'
ORDNER = '/api/v1/haushalt/ordner/'
SUMMARY = '/api/v1/finanzen/private/summary/'


def _user(name):
    return get_user_model().objects.create_user(username=f'{name}@example.com', email=f'{name}@example.com',
                                                password='irrelevant-1A', first_name=name.capitalize())


def _client(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


@pytest.fixture
def w():
    anna, ben, kim, dora = _user('anna'), _user('ben'), _user('kim'), _user('dora')
    home = Household.objects.create(name='Zuhause')
    HouseholdMembership.objects.create(user=anna, household=home, role=HouseholdMembership.Role.ADMIN)
    HouseholdMembership.objects.create(user=ben, household=home)
    HouseholdMembership.objects.create(user=kim, household=home, role=HouseholdMembership.Role.CHILD_ACCOUNT)
    other = Household.objects.create(name='Fremd')
    HouseholdMembership.objects.create(user=dora, household=other, role=HouseholdMembership.Role.ADMIN)
    return {'anna': anna, 'ben': ben, 'kim': kim, 'dora': dora, 'home': home}


def _month(day: date) -> str:
    return day.strftime('%Y-%m')


def _next_month(day: date) -> date:
    return (day.replace(day=28) + timedelta(days=4)).replace(day=1)


def _contract(user, **extra):
    today = timezone.localdate()
    body = {'kind': 'vertrag', 'name': 'Internet', 'cost': '39.99', 'billing_cycle': 'MONTHLY',
            'start_date': today.replace(day=1).isoformat(), 'end_date': (today + timedelta(days=400)).isoformat(),
            'notice_period_days': 30, **extra}
    r = _client(user).post(ORDNER, body, format='json')
    assert r.status_code == 201, r.data
    return r.data['id']


def _link(user, kind, source_id, expect=(200, 201)):
    r = _client(user).post(AUTO, {'kind': kind, 'source_id': source_id}, format='json')
    assert r.status_code in (expect if isinstance(expect, tuple) else (expect,)), r.data
    return r.data


def _planned(user, month: date):
    data = _client(user).get(SUMMARY, {'month': _month(month)}).data
    return [i for i in data['planned_items'] if i['kind'] == 'CONTRACT']


def _calendar(user, start, end):
    r = _client(user).get(f'{AUTO}calendar/', {'start': start.isoformat(), 'end': end.isoformat()})
    assert r.status_code == 200, r.data
    return r.data


# --------------------------------------------------------------------------- Pflicht-Szenario „Internetvertrag“


def test_internet_contract_end_to_end(w):
    anna, today = w['anna'], timezone.localdate()
    contract = _contract(anna)
    states = {s['kind']: s for s in _client(anna).get(AUTO, {'source_type': 'CONTRACT', 'source_id': contract}).data}
    assert states['CONTRACT_FINANCE']['preview'].startswith('Finanzen › Geplant: 39,99 € monatlich')
    assert states['CONTRACT_REMINDER']['preview'].startswith('Organisation › Kalender: „Kündigen bis: Internet“')

    # 2./3. beide Verbindungen aktivieren → genau ein Planposten im Monat, genau eine Erinnerung
    finance = _link(anna, 'CONTRACT_FINANCE', contract)
    _link(anna, 'CONTRACT_REMINDER', contract)
    planned = _planned(anna, today)
    assert len(planned) == 1 and planned[0]['amount'] == '39.99'
    deadline = today + timedelta(days=400) - timedelta(days=30)  # Vertragsende − Kündigungsfrist
    reminders = _calendar(anna, today, today + timedelta(days=400))
    # Hinweis 14 Tage vorher (Standard) und der Fristtag selbst
    assert [r['title'] for r in reminders] == [f'Kündigung vorbereiten: Internet (bis {deadline:%d.%m.%Y})', 'Kündigen bis: Internet']
    assert [r['date'] for r in reminders] == [(deadline - timedelta(days=14)).isoformat(), deadline.isoformat()]

    # 4. Preis 34,99 → künftige Planwerte folgen
    assert _client(anna).patch(f'{ORDNER}{contract}/', {'cost': '34.99'}, format='json').status_code == 200
    assert [p['amount'] for p in _planned(anna, _next_month(today))] == ['34.99']

    # 5. Vertragsende ändern → Erinnerung neu berechnet (Ende − 30 Tage)
    new_end = today + timedelta(days=200)
    _client(anna).patch(f'{ORDNER}{contract}/', {'end_date': new_end.isoformat()}, format='json')
    reminders = _calendar(anna, today, today + timedelta(days=400))
    assert [r['date'] for r in reminders] == [(new_end - timedelta(days=44)).isoformat(), (new_end - timedelta(days=30)).isoformat()]

    # 6. erneut anlegen/speichern → keine Duplikate
    again = _link(anna, 'CONTRACT_FINANCE', contract, expect=200)
    assert again['link_id'] == finance['link_id']
    assert AutoLink.objects.filter(owner=anna).count() == 2
    assert len(_planned(anna, _next_month(today))) == 1

    # 7. pausieren → nichts erscheint, Einstellung bleibt
    r = _client(anna).patch(f"{AUTO}{finance['link_id']}/", {'status': 'PAUSED'}, format='json')
    assert r.status_code == 200 and r.data['status'] == 'PAUSED'
    assert _planned(anna, _next_month(today)) == []

    # 8. aufheben → echte Buchung bleibt unverändert
    booked = Transaction.objects.create(owner=anna, amount=Decimal('39.99'), description='Internet', datum=today.replace(day=1))
    assert _client(anna).delete(f"{AUTO}{finance['link_id']}/").status_code == 204
    booked.refresh_from_db()
    assert booked.amount == Decimal('39.99') and booked.deleted_at is None
    assert list(AutoLinkEvent.objects.filter(owner=anna, kind='CONTRACT_FINANCE').values_list('action', flat=True)) == ['UNLINK', 'PAUSE', 'CREATE']

    # 9. andere Person / anderer Haushalt → kein Zugriff
    assert _client(w['dora']).get(AUTO, {'source_type': 'CONTRACT', 'source_id': contract}).status_code == 404
    assert _calendar(w['dora'], today, today + timedelta(days=400)) == []


# --------------------------------------------------------------------------- QA-01 … QA-14


def test_qa01_saving_twice_and_racing_creates_still_mean_one_planned_item(w, monkeypatch):
    anna, today = w['anna'], timezone.localdate()
    contract = _contract(anna)
    _link(anna, 'CONTRACT_FINANCE', contract)
    _client(anna).patch(f'{ORDNER}{contract}/', {'name': 'Internet'}, format='json')
    _link(anna, 'CONTRACT_FINANCE', contract)
    assert len(_planned(anna, today)) == 1
    # QA-12 Gleichzeitigkeit: die zweite Anfrage sieht die erste noch nicht → Datenbank verhindert die zweite Zeile
    with pytest.raises(IntegrityError):
        AutoLink.objects.create(owner=anna, kind='CONTRACT_FINANCE', source_id=contract)


def test_qa02_qa03_price_change_only_affects_the_future_and_bookings_replace_the_plan(w):
    anna, today = w['anna'], timezone.localdate()
    contract = _contract(anna)
    _link(anna, 'CONTRACT_FINANCE', contract)
    last_month = (today.replace(day=1) - timedelta(days=1)).replace(day=1)
    assert _planned(anna, last_month) == []  # Vergangenheit wird nie geplant
    paid = Transaction.objects.create(owner=anna, amount=Decimal('39.99'), description='Internet', datum=today.replace(day=1))
    assert _planned(anna, today) == []  # gebucht ersetzt geplant — nicht doppelt
    _client(anna).patch(f'{ORDNER}{contract}/', {'cost': '44.99'}, format='json')
    paid.refresh_from_db()
    assert paid.amount == Decimal('39.99')
    assert [p['amount'] for p in _planned(anna, _next_month(today))] == ['44.99']


def test_qa04_no_invented_deadlines(w):
    anna, today = w['anna'], timezone.localdate()
    no_notice = _contract(anna, notice_period_days=None)
    no_end = _contract(anna, name='Strom', end_date=None)
    states = {s['kind']: s for s in _client(anna).get(AUTO, {'source_type': 'CONTRACT', 'source_id': no_notice}).data}
    assert states['CONTRACT_REMINDER']['preview'] == '' and 'Kündigungsfrist fehlt' in states['CONTRACT_REMINDER']['problem']
    _link(anna, 'CONTRACT_REMINDER', no_notice)
    _link(anna, 'CONTRACT_REMINDER', no_end)
    assert _calendar(anna, today - timedelta(days=0), today + timedelta(days=400)) == []
    yearly = _contract(anna, name='Versicherung', billing_cycle='YEARLY', start_date=None)
    states = {s['kind']: s for s in _client(anna).get(AUTO, {'source_type': 'CONTRACT', 'source_id': yearly}).data}
    assert 'Startdatum' in states['CONTRACT_FINANCE']['problem']
    _link(anna, 'CONTRACT_FINANCE', yearly)
    assert _planned(anna, today) == []


def test_qa05_trip_budget_is_never_a_finance_expense(w):
    anna, today = w['anna'], timezone.localdate()
    trip = Trip.objects.create(owner=anna, title='Rom', destination='Rom', start_date=today + timedelta(days=30),
                               end_date=today + timedelta(days=35), budget_amount=Decimal('1500.00'))
    _link(anna, 'TRIP_CALENDAR', trip.pk)
    for month in (today, _next_month(today)):
        data = _client(anna).get(SUMMARY, {'month': _month(month)}).data
        assert data['planned_items'] == [] and data['spent'] == '0.00'


def test_qa06_moving_a_trip_moves_only_the_derived_calendar_span(w):
    anna, today = w['anna'], timezone.localdate()
    trip = Trip.objects.create(owner=anna, title='Rom', destination='Rom', start_date=today + timedelta(days=30), end_date=today + timedelta(days=35))
    own_event = PersonalEvent.objects.create(owner=anna, title='Flug', starts_at=timezone.now() + timedelta(days=30))
    _link(anna, 'TRIP_CALENDAR', trip.pk)
    trip.start_date, trip.end_date = today + timedelta(days=60), today + timedelta(days=62)
    trip.save()
    span = [i for i in _calendar(anna, today, today + timedelta(days=90)) if i['kind'] == 'TRIP_CALENDAR']
    assert [(i['date'], i['end_date']) for i in span] == [((today + timedelta(days=60)).isoformat(), (today + timedelta(days=62)).isoformat())]
    own_event.refresh_from_db()
    assert own_event.starts_at.date() == (timezone.now() + timedelta(days=30)).date()  # eigener Termin unangetastet


def test_qa07_household_task_done_in_organisation_is_the_same_task(w):
    anna, ben, home = w['anna'], w['ben'], w['home']
    mine = HouseholdTask.objects.create(household=home, title='Bad putzen', assigned_to=anna, due_date=timezone.localdate())
    open_task = HouseholdTask.objects.create(household=home, title='Müll', due_date=timezone.localdate())
    bens = HouseholdTask.objects.create(household=home, title='Rasen', assigned_to=ben)
    assert _client(anna).get(f'{AUTO}household-tasks/').data['tasks'] == []  # nur wenn verbunden
    _link(anna, 'HOUSEHOLD_TASKS', home.pk)
    titles = [t['title'] for t in _client(anna).get(f'{AUTO}household-tasks/').data['tasks']]
    assert titles == ['Bad putzen', 'Müll'] and 'Rasen' not in titles
    # erledigen über die Haushalt-API (derselbe Datensatz) → in beiden Ansichten erledigt
    r = _client(anna).post(f'/api/v1/haushalt/aufgaben/{mine.pk}/erledigt/', {}, format='json')
    assert r.status_code in (200, 201), r.data
    titles = [t['title'] for t in _client(anna).get(f'{AUTO}household-tasks/').data['tasks']]
    assert 'Bad putzen' not in titles
    assert not PersonalTask.objects.exists()  # keine Kopie in Organisation
    assert bens.pk and open_task.pk


def test_qa08_paused_link_shows_nothing_and_resume_brings_it_back(w):
    anna, today = w['anna'], timezone.localdate()
    goal = SavingsGoal.objects.create(owner=anna, title='Fahrrad', target_amount=Decimal('800'), target_date=today + timedelta(days=60))
    link = _link(anna, 'SAVINGS_REMINDER', goal.pk)
    assert [i['title'] for i in _calendar(anna, today, today + timedelta(days=90))] == ['Sparziel: Fahrrad']
    _client(anna).patch(f"{AUTO}{link['link_id']}/", {'status': 'PAUSED'}, format='json')
    assert _calendar(anna, today, today + timedelta(days=90)) == []
    _client(anna).patch(f"{AUTO}{link['link_id']}/", {'status': 'ACTIVE'}, format='json')
    assert len(_calendar(anna, today, today + timedelta(days=90))) == 1
    goal.refresh_from_db()
    assert goal.current_amount == 0  # eine Erinnerung löst nie eine Zahlung aus (CON-10)


def test_qa09_unlink_and_deleted_source_never_delete_other_data(w):
    anna, today = w['anna'], timezone.localdate()
    contract = _contract(anna)
    link = _link(anna, 'CONTRACT_REMINDER', contract)
    task = PersonalTask.objects.create(owner=anna, title='Kündigen')
    assert _client(anna).delete(f"{AUTO}{link['link_id']}/").status_code == 204
    assert FolderEntry.objects.filter(pk=contract).exists() and PersonalTask.objects.filter(pk=task.pk).exists()
    _link(anna, 'CONTRACT_REMINDER', contract)
    assert _client(anna).delete(f'{ORDNER}{contract}/').status_code == 204
    assert not AutoLink.objects.exists()
    assert AutoLinkEvent.objects.filter(action='SOURCE_GONE').count() == 1
    assert PersonalTask.objects.filter(pk=task.pk).exists()
    assert _calendar(anna, today, today + timedelta(days=400)) == []


def test_qa10_others_cannot_see_use_or_change_my_links(w):
    anna, ben, dora, kim, today = w['anna'], w['ben'], w['dora'], w['kim'], timezone.localdate()
    contract = _contract(anna)
    link = _link(anna, 'CONTRACT_REMINDER', contract)
    for intruder in (ben, dora):
        assert _client(intruder).patch(f"{AUTO}{link['link_id']}/", {'status': 'PAUSED'}, format='json').status_code == 404
        assert _client(intruder).delete(f"{AUTO}{link['link_id']}/").status_code == 404
    assert _client(dora).post(AUTO, {'kind': 'CONTRACT_REMINDER', 'source_id': contract}, format='json').status_code == 404
    assert _client(kim).post(AUTO, {'kind': 'CONTRACT_REMINDER', 'source_id': contract}, format='json').status_code == 404
    # Ben darf die Erinnerung für sich selbst anlegen (er sieht den Vertrag), aber nicht den privaten Betrag planen
    assert _client(ben).post(AUTO, {'kind': 'CONTRACT_REMINDER', 'source_id': contract}, format='json').status_code == 201
    r = _client(ben).post(AUTO, {'kind': 'CONTRACT_FINANCE', 'source_id': contract}, format='json')
    assert r.status_code == 403 and 'Betrag' in r.data['detail']
    assert '39' not in str(_client(ben).get(AUTO, {'source_type': 'CONTRACT', 'source_id': contract}).data)
    assert _calendar(dora, today, today + timedelta(days=400)) == []


def test_qa11_revoked_access_hides_everything_at_once(w):
    anna, ben, today = w['anna'], w['ben'], timezone.localdate()
    trip = Trip.objects.create(owner=anna, title='Rom', destination='Rom', start_date=today + timedelta(days=10), end_date=today + timedelta(days=12))
    participant = TripParticipant.objects.create(trip=trip, user=ben, role='VIEWER')
    link = _link(ben, 'TRIP_CALENDAR', trip.pk)
    assert len(_calendar(ben, today, today + timedelta(days=30))) == 1
    participant.delete()
    assert _calendar(ben, today, today + timedelta(days=30)) == []
    assert _client(ben).patch(f"{AUTO}{link['link_id']}/", {'status': 'PAUSED'}, format='json').status_code == 404
    # Haushalt verlassen → Haushaltsaufgaben und Vertragserinnerungen weg
    contract = _contract(anna)
    _link(ben, 'CONTRACT_REMINDER', contract)
    _link(ben, 'HOUSEHOLD_TASKS', w['home'].pk)
    HouseholdTask.objects.create(household=w['home'], title='Müll')
    HouseholdMembership.objects.filter(user=ben).delete()
    assert _calendar(ben, today, today + timedelta(days=400)) == []
    assert _client(ben).get(f'{AUTO}household-tasks/').data['tasks'] == []


def test_qa13_manual_changes_cannot_conflict_because_nothing_is_copied(w):
    anna, today = w['anna'], timezone.localdate()
    device = _client(anna).post(ORDNER, {'kind': 'geraet', 'name': 'Heizung', 'maintenance_due_date': (today + timedelta(days=20)).isoformat()}, format='json').data['id']
    _link(anna, 'DEVICE_MAINTENANCE', device)
    before = PersonalEvent.objects.count() + PersonalTask.objects.count()
    _client(anna).patch(f'{ORDNER}{device}/', {'maintenance_due_date': (today + timedelta(days=40)).isoformat()}, format='json')
    assert [i['date'] for i in _calendar(anna, today, today + timedelta(days=60))] == [(today + timedelta(days=40)).isoformat()]
    assert PersonalEvent.objects.count() + PersonalTask.objects.count() == before


def test_qa14_retry_after_error_is_safe(w, monkeypatch):
    anna = w['anna']
    contract = _contract(anna)
    calls = {'n': 0}
    original = auto_links._log

    def flaky(*args, **kwargs):
        calls['n'] += 1
        if calls['n'] == 1:
            raise RuntimeError('Datenbank kurz weg')
        return original(*args, **kwargs)

    monkeypatch.setattr(auto_links, '_log', flaky)
    with pytest.raises(RuntimeError):
        auto_links.create(anna, 'CONTRACT_FINANCE', contract)
    assert not AutoLink.objects.exists()  # Fehler → nichts halb angelegt (eine Transaktion)
    link, created = auto_links.create(anna, 'CONTRACT_FINANCE', contract)
    again, created_again = auto_links.create(anna, 'CONTRACT_FINANCE', contract)
    assert created and not created_again and link.pk == again.pk


def test_invalid_input_is_rejected_cleanly(w):
    anna, today = w['anna'], timezone.localdate()
    client = _client(anna)
    assert client.post(AUTO, {'kind': 'EVIL', 'source_id': 1}, format='json').status_code == 400
    assert client.post(AUTO, {'kind': 'CONTRACT_FINANCE', 'source_id': 'x'}, format='json').status_code == 400
    assert client.post(AUTO, {'kind': 'CONTRACT_FINANCE', 'source_id': 2**63}, format='json').status_code == 400
    assert client.post(AUTO, {'kind': 'CONTRACT_FINANCE', 'source_id': 999999}, format='json').status_code == 404
    assert client.get(AUTO, {'source_type': 'EVIL', 'source_id': 1}).status_code == 400
    assert client.get(f'{AUTO}calendar/', {'start': 'gestern', 'end': today.isoformat()}).status_code == 400
    assert client.get(f'{AUTO}calendar/', {'start': today.isoformat(), 'end': (today + timedelta(days=500)).isoformat()}).status_code == 400
    assert client.patch(f'{AUTO}1/', {'status': 'KAPUTT'}, format='json').status_code in (400, 404)
    assert APIClient().get(f'{AUTO}calendar/', {'start': today.isoformat(), 'end': today.isoformat()}).status_code in (401, 403)


def test_payment_days_follow_the_billing_cycle():
    class Entry:
        billing_cycle, start_date, end_date, auto_renewal = 'QUARTERLY', date(2026, 1, 31), None, False

    days = auto_links.contract_payment_days(Entry, date(2026, 1, 1), date(2027, 1, 1))
    assert days == [date(2026, 1, 31), date(2026, 4, 30), date(2026, 7, 31), date(2026, 10, 31)]
    Entry.billing_cycle, Entry.end_date = 'MONTHLY', date(2026, 3, 15)
    assert auto_links.contract_payment_days(Entry, date(2026, 1, 1), date(2026, 6, 1)) == [date(2026, 1, 31), date(2026, 2, 28)]
    Entry.auto_renewal = True
    assert len(auto_links.contract_payment_days(Entry, date(2026, 1, 1), date(2026, 6, 1))) == 5
    Entry.billing_cycle = 'ONE_TIME'
    assert auto_links.contract_payment_days(Entry, date(2026, 1, 1), date(2026, 6, 1)) == [date(2026, 1, 31)]


def test_savings_reminder_uses_target_date_or_the_last_planned_month_and_never_guesses(w):
    anna, today = w['anna'], timezone.localdate()
    end_month = _next_month(_next_month(today))
    by_period = SavingsGoal.objects.create(owner=anna, title='Urlaub', target_amount=Decimal('500'), plan_month=today.replace(day=1), plan_end_month=end_month)
    open_ended = SavingsGoal.objects.create(owner=anna, title='Notgroschen', target_amount=Decimal('500'), plan_month=today.replace(day=1))
    states = _client(anna).get(AUTO, {'source_type': 'SAVINGS_GOAL', 'source_id': by_period.pk}).data
    assert '(letzter Monat)' in states[0]['preview']
    assert 'offener Zeitraum' in _client(anna).get(AUTO, {'source_type': 'SAVINGS_GOAL', 'source_id': open_ended.pk}).data[0]['problem']
    _link(anna, 'SAVINGS_REMINDER', by_period.pk)
    _link(anna, 'SAVINGS_REMINDER', open_ended.pk)
    assert [(i['title'], i['date']) for i in _calendar(anna, today, today + timedelta(days=120))] == [('Sparziel: Urlaub', end_month.isoformat())]


def test_a_linked_contract_replaces_a_recurring_booking_with_the_same_name_never_both(w):
    """Gefunden beim E2E-Test (01.11.2026): wiederkehrend markierte Buchung „Strom“ + verbundener Vertrag „Strom“
    standen im Folgemonat beide unter „Geplant“ — doppelt gezählt. Jetzt ersetzt der Vertrag die Planung."""
    anna, today = w['anna'], timezone.localdate()
    last_month = (today.replace(day=1) - timedelta(days=1)).replace(day=1)
    Transaction.objects.create(owner=anna, amount=Decimal('67.40'), description='Strom', datum=last_month, recurring=True)
    nxt = _next_month(today)
    before = [i for i in _client(anna).get(SUMMARY, {'month': _month(nxt)}).data['planned_items'] if i['title'] == 'Strom']
    assert [i['kind'] for i in before] == ['RECURRING']
    contract = _contract(anna, name='Strom', cost='84.00')
    _link(anna, 'CONTRACT_FINANCE', contract)
    after = [i for i in _client(anna).get(SUMMARY, {'month': _month(nxt)}).data['planned_items'] if i['title'] == 'Strom']
    assert [(i['kind'], i['amount']) for i in after] == [('CONTRACT', '84.00')]
