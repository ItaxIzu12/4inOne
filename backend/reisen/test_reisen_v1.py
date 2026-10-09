"""Reisen V1 (docs/REISEN_V1.md): Reise als Container für Übersicht, Planung, Packliste und Budget."""

from datetime import timedelta
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import Contact
from reisen.models import PackingItem, Trip, TripExpense, TripParticipant, TripTask

pytestmark = pytest.mark.django_db
BASE = '/api/v1/reisen/'


@pytest.fixture
def users():
    return [get_user_model().objects.create_user(username=n, email=f'{n}@example.com', password='test-secret-234') for n in ['anna', 'ben', 'cleo']]


def api(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


def trip_for(owner, **kwargs):
    kwargs.setdefault('title', 'Berlin Wochenende')
    kwargs.setdefault('destination', 'Berlin')
    kwargs.setdefault('start_date', '2026-11-12')
    kwargs.setdefault('end_date', '2026-11-15')
    return Trip.objects.create(owner=owner, **kwargs)


def share(trip, user, role='EDITOR'):
    return TripParticipant.objects.create(trip=trip, user=user, role=role)


# ---------- Reise ----------

def test_create_trip_with_departure_and_required_fields(users):
    client = api(users[0])
    payload = {'title': 'Berlin Wochenende', 'destination': 'Berlin', 'start_date': '2026-11-12', 'end_date': '2026-11-15', 'departure': 'DUS'}
    response = client.post(BASE + 'trips/', payload, format='json')
    assert response.status_code == 201, response.data
    assert response.data['departure'] == 'DUS'
    assert response.data['status'] == 'PLANNED'

    for missing in ['title', 'destination', 'start_date', 'end_date']:
        incomplete = {k: v for k, v in payload.items() if k != missing}
        assert client.post(BASE + 'trips/', incomplete, format='json').status_code == 400, missing
    assert client.post(BASE + 'trips/', {**payload, 'destination': '  '}, format='json').status_code == 400


def test_end_before_start_is_rejected_with_a_clear_message(users):
    response = api(users[0]).post(
        BASE + 'trips/', {'title': 'x', 'destination': 'y', 'start_date': '2026-11-15', 'end_date': '2026-11-12'}, format='json'
    )
    assert response.status_code == 400
    assert 'Ende' in str(response.data['end_date'])


def test_a_past_trip_is_allowed(users):
    response = api(users[0]).post(
        BASE + 'trips/', {'title': 'Lissabon', 'destination': 'Lissabon', 'start_date': '2026-09-01', 'end_date': '2026-09-05', 'status': 'DONE'}, format='json'
    )
    assert response.status_code == 201


def test_edit_cancel_and_delete(users):
    client = api(users[0])
    trip = trip_for(users[0])
    assert client.patch(f'{BASE}trips/{trip.pk}/', {'title': 'Berlin lang'}, format='json').status_code == 200
    assert client.patch(f'{BASE}trips/{trip.pk}/', {'status': 'CANCELLED'}, format='json').data['status'] == 'CANCELLED'
    # Eine alte Reise ohne Ziel bleibt bearbeitbar, das Ziel darf aber nicht ausdrücklich geleert werden.
    old = trip_for(users[0], destination='')
    assert client.patch(f'{BASE}trips/{old.pk}/', {'title': 'Alt'}, format='json').status_code == 200
    assert client.patch(f'{BASE}trips/{trip.pk}/', {'destination': ''}, format='json').status_code == 400
    assert client.delete(f'{BASE}trips/{trip.pk}/').status_code == 204
    assert not Trip.objects.filter(pk=trip.pk).exists()


@pytest.mark.parametrize('status', ['IDEA', 'ACTIVE', 'DRAFT'])
def test_v1_has_no_draft_or_stored_active_status(users, status):
    trip = trip_for(users[0])
    assert api(users[0]).patch(f'{BASE}trips/{trip.pk}/', {'status': status}, format='json').status_code == 400


def test_overlap_is_detected_but_does_not_block_saving(users):
    client = api(users[0])
    japan = trip_for(users[0], title='Japan', start_date='2026-11-10', end_date='2026-11-15')
    overlaps = client.get(BASE + 'trips/overlaps/', {'start_date': '2026-11-13', 'end_date': '2026-11-18'}).data
    assert [t['title'] for t in overlaps] == ['Japan']
    # Trotzdem speichern ist erlaubt (Gruppenreise, Weiterreise …).
    response = client.post(BASE + 'trips/', {'title': 'Kyoto', 'destination': 'Kyoto', 'start_date': '2026-11-13', 'end_date': '2026-11-18'}, format='json')
    assert response.status_code == 201
    assert client.get(BASE + 'trips/overlaps/', {'start_date': '2026-11-10', 'end_date': '2026-11-15', 'exclude': japan.pk}).data[0]['title'] == 'Kyoto'


def test_scope_filters_upcoming_past_and_cancelled(users):
    today = timezone.localdate()
    trip_for(users[0], title='Kommt', start_date=today + timedelta(days=5), end_date=today + timedelta(days=7))
    trip_for(users[0], title='Läuft', start_date=today - timedelta(days=1), end_date=today + timedelta(days=1))
    trip_for(users[0], title='Vorbei', start_date=today - timedelta(days=30), end_date=today - timedelta(days=28))
    trip_for(users[0], title='Abgesagt', start_date=today + timedelta(days=9), end_date=today + timedelta(days=10), status='CANCELLED')
    client = api(users[0])
    titles = lambda scope: sorted(t['title'] for t in client.get(BASE + 'trips/', {'scope': scope}).data)  # noqa: E731
    assert titles('upcoming') == ['Kommt', 'Läuft']
    assert titles('past') == ['Vorbei']
    assert titles('cancelled') == ['Abgesagt']
    assert len(client.get(BASE + 'trips/').data) == 4


def test_owner_participant_and_stranger_permissions(users):
    anna, ben, cleo = users
    trip = trip_for(anna)
    share(trip, ben, 'VIEWER')
    assert api(ben).get(f'{BASE}trips/{trip.pk}/').status_code == 200
    assert api(ben).patch(f'{BASE}trips/{trip.pk}/', {'title': 'x'}, format='json').status_code == 403
    for method in ['get', 'patch', 'delete']:
        assert getattr(api(cleo), method)(f'{BASE}trips/{trip.pk}/').status_code == 404
    assert api(cleo).get(f'{BASE}trips/{trip.pk}/summary/').status_code == 404
    assert api(cleo).get(BASE + 'trips/overlaps/', {'start_date': '2026-11-01', 'end_date': '2026-11-30'}).data == []


def test_trip_list_counts_need_a_constant_number_of_queries(users):
    for i in range(3):
        trip = trip_for(users[0], title=f'Reise {i}')
        PackingItem.objects.create(trip=trip, title='Pass', is_packed=True)
        TripTask.objects.create(trip=trip, title='Hotel buchen')
        TripExpense.objects.create(trip=trip, title='Zug', amount=Decimal('10.00'), date='2026-10-01')
    client = api(users[0])
    with CaptureQueriesContext(connection) as few:
        client.get(BASE + 'trips/')
    for i in range(3, 8):
        trip_for(users[0], title=f'Reise {i}')
    with CaptureQueriesContext(connection) as many:
        data = client.get(BASE + 'trips/').data
    assert len(many) == len(few)
    first = next(t for t in data if t['title'] == 'Reise 0')
    assert (first['packing_total'], first['packing_packed'], first['tasks_open'], first['budget_spent']) == (1, 1, 1, '10.00')


# ---------- Übersicht ----------

def test_summary_bundles_the_overview_numbers(users):
    anna, ben = users[:2]
    trip = trip_for(anna, budget_amount=Decimal('700.00'))
    share(trip, anna, 'OWNER')
    share(trip, ben)
    for title, packed in [('Reisepass', True), ('Ladekabel', True), ('Jacke', False)]:
        PackingItem.objects.create(trip=trip, title=title, is_packed=packed)
    TripTask.objects.create(trip=trip, title='Hotel buchen')
    TripTask.objects.create(trip=trip, title='Pass prüfen', status='DONE')
    TripExpense.objects.create(trip=trip, title='Hotel', amount=Decimal('280.00'), date='2026-10-06')
    TripExpense.objects.create(trip=trip, title='Zug', amount=Decimal('140.00'), date='2026-10-06')
    data = api(ben).get(f'{BASE}trips/{trip.pk}/summary/').data
    assert data == {
        'open_tasks': 1, 'tasks_total': 2, 'packing_total': 3, 'packing_completed': 2, 'participants': 2,
        'budget_total': '700.00', 'budget_spent': '420.00', 'budget_remaining': '280.00', 'currency': 'EUR',
    }


def test_summary_without_budget_has_no_fake_zeroes(users):
    trip = trip_for(users[0])
    data = api(users[0]).get(f'{BASE}trips/{trip.pk}/summary/').data
    assert data['budget_total'] is None and data['budget_remaining'] is None
    assert data['budget_spent'] == '0.00'


# ---------- Aufgaben ----------

def test_trip_task_lifecycle_and_assignee(users):
    anna, ben, cleo = users
    trip = trip_for(anna)
    share(trip, ben)
    client = api(anna)
    created = client.post(BASE + 'tasks/', {'trip': trip.pk, 'title': 'Hotel buchen', 'assignee': ben.pk}, format='json')
    assert created.status_code == 201, created.data
    assert created.data['assignee_name'] == 'ben'
    pk = created.data['id']
    assert client.patch(f'{BASE}tasks/{pk}/', {'title': 'Hotel in Mitte buchen'}, format='json').status_code == 200
    assert client.patch(f'{BASE}tasks/{pk}/', {'status': 'DONE'}, format='json').data['status'] == 'DONE'
    assert client.get(f'{BASE}trips/{trip.pk}/summary/').data['open_tasks'] == 0
    assert client.patch(f'{BASE}tasks/{pk}/', {'status': 'OPEN'}, format='json').data['status'] == 'OPEN'

    # Nur Mitreisende können zuständig sein — für Fremde und unbekannte IDs dieselbe Meldung.
    stranger = client.patch(f'{BASE}tasks/{pk}/', {'assignee': cleo.pk}, format='json')
    unknown = client.patch(f'{BASE}tasks/{pk}/', {'assignee': 99999}, format='json')
    assert stranger.status_code == unknown.status_code == 400
    assert stranger.json()['assignee'] == unknown.json()['assignee']
    assert client.patch(f'{BASE}tasks/{pk}/', {'assignee': None}, format='json').data['assignee'] is None

    # Die Aufgabe gehört genau zu dieser Reise und ist für Fremde unsichtbar.
    assert api(cleo).get(f'{BASE}tasks/{pk}/').status_code == 404
    assert api(cleo).patch(f'{BASE}tasks/{pk}/', {'status': 'DONE'}, format='json').status_code == 404
    assert client.delete(f'{BASE}tasks/{pk}/').status_code == 204


def test_assignee_who_leaves_the_trip_keeps_the_task_unassigned(users):
    anna, ben = users[:2]
    trip = trip_for(anna)
    membership = share(trip, ben)
    task = TripTask.objects.create(trip=trip, title='Tickets laden', assignee=ben)
    membership.delete()
    ben.delete()
    task.refresh_from_db()
    assert task.assignee is None


def test_viewer_cannot_change_tasks(users):
    anna, ben = users[:2]
    trip = trip_for(anna)
    share(trip, ben, 'VIEWER')
    task = TripTask.objects.create(trip=trip, title='Pass prüfen')
    assert api(ben).patch(f'{BASE}tasks/{task.pk}/', {'status': 'DONE'}, format='json').status_code == 403
    assert api(ben).post(BASE + 'tasks/', {'trip': trip.pk, 'title': 'x'}, format='json').status_code == 400


# ---------- Packliste ----------

def test_packing_list_add_edit_check_reopen_delete_and_progress(users):
    trip = trip_for(users[0])
    client = api(users[0])
    ids = [client.post(BASE + 'packing-items/', {'trip': trip.pk, 'title': t}, format='json').data['id'] for t in ['Reisepass', 'Ladekabel', 'Jacke']]
    assert client.patch(f'{BASE}packing-items/{ids[2]}/', {'title': 'Regenjacke', 'category': 'KLEIDUNG'}, format='json').status_code == 200
    for pk in ids[:2]:
        assert client.patch(f'{BASE}packing-items/{pk}/', {'is_packed': True}, format='json').data['packed_at']
    summary = client.get(f'{BASE}trips/{trip.pk}/summary/').data
    assert (summary['packing_completed'], summary['packing_total']) == (2, 3)

    reopened = client.patch(f'{BASE}packing-items/{ids[0]}/', {'is_packed': False}, format='json').data
    assert reopened['packed_at'] is None
    assert client.delete(f'{BASE}packing-items/{ids[1]}/').status_code == 204
    summary = client.get(f'{BASE}trips/{trip.pk}/summary/').data
    assert (summary['packing_completed'], summary['packing_total']) == (0, 2)


def test_packing_item_without_category_lands_in_sonstiges(users):
    trip = trip_for(users[0])
    item = api(users[0]).post(BASE + 'packing-items/', {'trip': trip.pk, 'title': 'Ladekabel'}, format='json').data
    assert item['category'] == 'SONSTIGES'


def test_packing_list_is_private_to_the_trip(users):
    anna, _, cleo = users
    item = PackingItem.objects.create(trip=trip_for(anna), title='Reisepass')
    assert api(cleo).get(f'{BASE}packing-items/{item.pk}/').status_code == 404
    assert api(cleo).patch(f'{BASE}packing-items/{item.pk}/', {'is_packed': True}, format='json').status_code == 404
    assert api(cleo).post(f'{BASE}packing-items/zuruecksetzen/?trip={item.trip_id}').status_code == 404


# ---------- Budget ----------

def test_budget_700_minus_420_leaves_280_in_decimal(users):
    trip = trip_for(users[0], start_date='2026-11-12', end_date='2026-11-15')
    client = api(users[0])
    assert client.patch(f'{BASE}trips/{trip.pk}/', {'budget_amount': '700.00'}, format='json').status_code == 200
    for title, amount in [('Hotel', '280.00'), ('Zug', '140.00')]:
        assert client.post(BASE + 'expenses/', {'trip': trip.pk, 'title': title, 'amount': amount, 'date': '2026-11-12'}, format='json').status_code == 201
    data = client.get(f'{BASE}trips/{trip.pk}/summary/').data
    assert (data['budget_total'], data['budget_spent'], data['budget_remaining']) == ('700.00', '420.00', '280.00')
    assert isinstance(Trip.objects.get(pk=trip.pk).budget_amount, Decimal)
    assert all(isinstance(e.amount, Decimal) for e in TripExpense.objects.filter(trip=trip))


def test_category_budget_planned_vs_spent(users):
    trip = trip_for(users[0])
    client = api(users[0])
    assert client.post(BASE + 'budget-categories/', {'trip': trip.pk, 'category': 'UNTERKUNFT', 'planned_amount': '300.00'}, format='json').status_code == 201
    client.post(BASE + 'expenses/', {'trip': trip.pk, 'title': 'Hotel', 'amount': '280.00', 'date': '2026-11-12', 'category': 'UNTERKUNFT'}, format='json')
    # Ohne Gesamtbudget gilt die Summe der Kategorien als Budget.
    data = client.get(f'{BASE}trips/{trip.pk}/summary/').data
    assert (data['budget_total'], data['budget_remaining']) == ('300.00', '20.00')
    # Je Kategorie nur einmal geplant.
    assert client.post(BASE + 'budget-categories/', {'trip': trip.pk, 'category': 'UNTERKUNFT', 'planned_amount': '10.00'}, format='json').status_code == 400


def test_expense_before_the_trip_starts_is_allowed(users):
    trip = trip_for(users[0], start_date='2026-11-12', end_date='2026-11-15')
    response = api(users[0]).post(BASE + 'expenses/', {'trip': trip.pk, 'title': 'Ticket', 'amount': '89.90', 'date': '2026-10-06'}, format='json')
    assert response.status_code == 201
    assert response.data['date'] == '2026-10-06'


@pytest.mark.parametrize('amount', ['0', '0.00', '-5'])
def test_expense_amount_must_be_positive(users, amount):
    trip = trip_for(users[0])
    response = api(users[0]).post(BASE + 'expenses/', {'trip': trip.pk, 'title': 'x', 'amount': amount, 'date': '2026-11-12'}, format='json')
    assert response.status_code == 400
    assert 'größer als 0' in str(response.data['amount'])


def test_expenses_and_budget_of_a_foreign_trip_are_invisible(users):
    anna, _, cleo = users
    trip = trip_for(anna, budget_amount=Decimal('700.00'))
    expense = TripExpense.objects.create(trip=trip, title='Hotel', amount=Decimal('280.00'), date='2026-10-01')
    assert api(cleo).get(f'{BASE}expenses/{expense.pk}/').status_code == 404
    assert api(cleo).get(f'{BASE}expenses/?trip={trip.pk}').data == []
    assert api(cleo).post(BASE + 'expenses/', {'trip': trip.pk, 'title': 'x', 'amount': '1.00', 'date': '2026-10-01'}, format='json').status_code == 400


def test_a_travel_expense_creates_no_finance_transaction(users):
    from finanzen.models import Transaction

    trip = trip_for(users[0])
    before = Transaction.objects.count()
    api(users[0]).post(BASE + 'expenses/', {'trip': trip.pk, 'title': 'Hotel', 'amount': '280.00', 'date': '2026-11-12'}, format='json')
    assert Transaction.objects.count() == before


# ---------- Teilnehmer und Privatsphäre ----------

def test_participant_sees_the_shared_trip_but_nothing_else_of_the_owner(users):
    from organisation.models import PersonalNote, PersonalTask

    anna, ben = users[:2]
    contact = Contact.objects.create(owner=anna, other=ben)
    shared = trip_for(anna, title='Berlin')
    trip_for(anna, title='Privat')
    task = PersonalTask.objects.create(owner=anna, title='Arzttermin')
    note = PersonalNote.objects.create(owner=anna, title='Geheim', body='privat')
    added = api(anna).post(BASE + 'participants/', {'trip': shared.pk, 'contact_id': contact.pk, 'role': 'EDITOR'}, format='json')
    assert added.status_code == 201, added.data

    client = api(ben)
    assert [t['title'] for t in client.get(BASE + 'trips/').data] == ['Berlin']
    rows = lambda r: r.data['results'] if isinstance(r.data, dict) else r.data  # noqa: E731
    assert rows(client.get('/api/v1/organisation/tasks/')) == []
    assert rows(client.get('/api/v1/organisation/notes/')) == []
    assert client.get(f'/api/v1/organisation/tasks/{task.pk}/').status_code == 404
    assert client.get(f'/api/v1/organisation/notes/{note.pk}/').status_code == 404
