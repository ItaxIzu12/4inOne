"""Haushalt V1: Aufgabenfelder, Routinen, wieder öffnen, Übersicht — und
dass fremde Haushalte weder les- noch änderbar sind."""

from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from haushalt.models import ShoppingItem, Task, TaskCompletion
from haushalt.services import add_months

pytestmark = pytest.mark.django_db

URL = '/api/v1/haushalt/aufgaben/'
OVERVIEW = '/api/v1/haushalt/uebersicht/'


def test_task_has_description_time_and_status(anna, client_for):
    client = client_for(anna)
    r = client.post(
        URL,
        {'title': 'Wäsche waschen', 'description': '  Buntwäsche  ', 'due_date': '2030-01-05', 'due_time': '15:00'},
        format='json',
    )
    assert r.status_code == 201, r.data
    assert r.data['description'] == 'Buntwäsche'
    assert r.data['due_time'] == '15:00:00'
    assert r.data['status'] == 'open'
    assert r.data['recurrence'] is None


@pytest.mark.parametrize('choice,days,months', [('daily', 1, None), ('weekly', 7, None), ('monthly', None, 1)])
def test_routine_recurrence_choices(anna, client_for, choice, days, months):
    client = client_for(anna)
    r = client.post(URL, {'title': 'Bad reinigen', 'recurrence': choice}, format='json')
    assert r.status_code == 201, r.data
    assert (r.data['recurrence_days'], r.data['recurrence_months']) == (days, months)
    assert r.data['recurrence'] == choice
    assert r.data['due_date'] == timezone.localdate().isoformat()  # Startpunkt: heute


def test_switching_recurrence_clears_the_other_interval(anna, client_for):
    client = client_for(anna)
    task = client.post(URL, {'title': 'Pflanzen gießen', 'recurrence': 'monthly'}, format='json').data
    r = client.patch(f'{URL}{task["id"]}/', {'recurrence': 'weekly'}, format='json')
    assert (r.data['recurrence_days'], r.data['recurrence_months']) == (7, None)
    r = client.patch(f'{URL}{task["id"]}/', {'recurrence': None}, format='json')
    assert (r.data['recurrence_days'], r.data['recurrence_months']) == (None, None)
    assert client.post(URL, {'title': 'X', 'recurrence': 'hourly'}, format='json').status_code == 400
    yearly = client.post(URL, {'title': 'Y', 'recurrence': 'yearly'}, format='json').data
    assert (yearly['recurrence_days'], yearly['recurrence_months'], yearly['recurrence']) == (None, 12, 'yearly')


def test_monthly_task_moves_one_calendar_month(anna, client_for):
    client = client_for(anna)
    task = client.post(URL, {'title': 'Filter wechseln', 'recurrence': 'monthly'}, format='json').data
    done = client.post(f'{URL}{task["id"]}/erledigt/')
    assert done.status_code == 200
    assert done.data['due_date'] == add_months(timezone.localdate(), 1).isoformat()
    assert done.data['status'] == 'open'


def test_complete_and_reopen_one_off_task(anna, client_for):
    client = client_for(anna)
    task = client.post(URL, {'title': 'Glühbirne wechseln'}, format='json').data
    assert client.post(f'{URL}{task["id"]}/wieder-oeffnen/').status_code == 400  # noch offen

    done = client.post(f'{URL}{task["id"]}/erledigt/')
    assert done.data['status'] == 'done'
    assert client.post(f'{URL}{task["id"]}/erledigt/').status_code == 400  # nicht doppelt
    assert client.get(URL).data == []
    assert [t['id'] for t in client.get(URL + '?status=done').data] == [task['id']]
    assert TaskCompletion.objects.filter(task_id=task['id']).count() == 1

    reopened = client.post(f'{URL}{task["id"]}/wieder-oeffnen/')
    assert reopened.status_code == 200 and reopened.data['status'] == 'open'
    assert [t['id'] for t in client.get(URL).data] == [task['id']]
    assert client.get(URL + '?status=done').data == []
    assert TaskCompletion.objects.filter(task_id=task['id']).count() == 0  # Lastanzeige zählt nicht doppelt


def test_done_task_can_be_deleted(anna, client_for):
    client = client_for(anna)
    task = client.post(URL, {'title': 'Einmalig'}, format='json').data
    client.post(f'{URL}{task["id"]}/erledigt/')
    assert client.delete(f'{URL}{task["id"]}/').status_code == 204
    assert not Task.objects.filter(pk=task['id']).exists()


def test_overview_counts_and_today_list(anna, household, client_for):
    today = timezone.localdate()
    Task.objects.create(household=household, title='Überfällig', due_date=today - timedelta(days=2))
    Task.objects.create(household=household, title='Heute', due_date=today, due_time='08:00')
    Task.objects.create(household=household, title='Später', due_date=today + timedelta(days=3))
    Task.objects.create(household=household, title='Erledigt', due_date=today, is_done=True)
    r = client_for(anna).get(OVERVIEW)
    assert r.status_code == 200
    assert r.data['open_tasks'] == 3 and r.data['overdue_tasks'] == 1
    assert [t['title'] for t in r.data['today']] == ['Überfällig', 'Heute']
    assert [t['title'] for t in r.data['upcoming']] == ['Später']


def test_overview_works_for_single_user_without_family(db, client_for):
    from django.contrib.auth import get_user_model

    from core.models import Household, HouseholdMembership

    user = get_user_model().objects.create_user(username='solo', email='solo@example.com', password='x')
    HouseholdMembership.objects.create(user=user, household=Household.objects.create(name='Solo'))
    client = client_for(user)
    r = client.post(URL, {'title': 'Müll rausbringen', 'recurrence': 'weekly'}, format='json')
    assert r.status_code == 201
    assert client.get(OVERVIEW).data['open_tasks'] == 1


def test_overview_without_household_is_empty(db, client_for):
    from django.contrib.auth import get_user_model

    user = get_user_model().objects.create_user(username='nohome', email='nohome@example.com', password='x')
    data = client_for(user).get(OVERVIEW).data
    assert set(data['summary'].values()) == {0}
    assert data['shopping'] == {'open_items': 0, 'preview': [], 'list_id': None}
    assert data['deadlines'] == []
    data.pop('summary'), data.pop('shopping'), data.pop('deadlines')
    assert data == {
        'open_tasks': 0,
        'overdue_tasks': 0,
        'today': [],
        'upcoming': [],
        'open_shopping_items': 0,
        'devices': 0,
        'device_list': [],
        'contracts': 0,
        'contracts_monthly': '0.00',
        'contract_list': [],
    }


# ---------------------------------------------------------------------------
# Sicherheit: User A ↔ User B (verschiedene Haushalte)
# ---------------------------------------------------------------------------


def test_foreign_user_sees_only_own_household_data(anna, fremd, household, client_for):
    mine = Task.objects.create(household=household, title='Nur Anna', due_date=timezone.localdate())
    done = Task.objects.create(household=household, title='Erledigt', is_done=True)
    b = client_for(fremd)

    for query in ['', '?status=done', '?status=all']:
        assert b.get(URL + query).data == []
    overview = b.get(OVERVIEW).data
    assert overview['open_tasks'] == 0 and overview['today'] == []
    assert b.get(f'{URL}{mine.id}/').status_code == 404


def test_foreign_user_cannot_change_tasks(anna, fremd, household, client_for):
    open_task = Task.objects.create(household=household, title='Offen', due_date=timezone.localdate())
    done_task = Task.objects.create(household=household, title='Fertig', is_done=True)
    b = client_for(fremd)

    assert b.patch(f'{URL}{open_task.id}/', {'title': 'Gehackt'}, format='json').status_code == 404
    assert b.post(f'{URL}{open_task.id}/erledigt/').status_code == 404
    assert b.post(f'{URL}{done_task.id}/wieder-oeffnen/').status_code == 404
    assert b.delete(f'{URL}{open_task.id}/').status_code == 404
    assert b.delete(f'{URL}{done_task.id}/').status_code == 404

    open_task.refresh_from_db(); done_task.refresh_from_db()
    assert open_task.title == 'Offen' and not open_task.is_done and done_task.is_done


def test_foreign_user_cannot_assign_or_inject_household(anna, fremd, household, client_for):
    b = client_for(fremd)
    r = b.post(URL, {'title': 'Fremd', 'household': household.id, 'assigned_to': anna.id}, format='json')
    assert r.status_code == 400  # Anna gehört nicht zu Fremds Haushalt
    r = b.post(URL, {'title': 'Fremd', 'household': household.id}, format='json')
    assert r.status_code == 201
    assert Task.objects.get(pk=r.data['id']).household_id != household.id


def test_foreign_user_cannot_touch_shopping_items(anna, fremd, household, client_for):
    a = client_for(anna)
    item = a.post('/api/v1/haushalt/einkauf/eintraege/', {'name': 'Milch'}, format='json').data
    b = client_for(fremd)
    assert all(i['name'] != 'Milch' for i in b.get('/api/v1/haushalt/einkauf/').data['items'])
    url = f'/api/v1/haushalt/einkauf/eintraege/{item["id"]}/'
    assert b.patch(url, {'is_checked': True}, format='json').status_code == 404
    assert b.delete(url).status_code == 404
    assert ShoppingItem.objects.get(pk=item['id']).is_checked is False


@pytest.mark.parametrize('path', ['aufgaben/', 'uebersicht/', 'einkauf/', 'ordner/'])
def test_authentication_required(path):
    assert APIClient().get('/api/v1/haushalt/' + path).status_code == 401


def test_overview_device_list_is_scoped_and_hidden_from_child_accounts(anna, kind, fremd, household, client_for):
    from haushalt.models import FolderEntry

    FolderEntry.objects.create(household=household, kind='geraet', name='Waschmaschine', provider='AEG')
    FolderEntry.objects.create(household=household, kind='vertrag', name='Strom')
    mine = client_for(anna).get(OVERVIEW).data
    assert mine['devices'] == 1
    assert [(d['name'], d['provider']) for d in mine['device_list']] == [('Waschmaschine', 'AEG')]
    assert client_for(fremd).get(OVERVIEW).data['device_list'] == []
    # Kind-Konten erreichen den Haushaltsordner nicht (NoChildAccount)
    child = client_for(kind).get(OVERVIEW).data
    assert child['devices'] == 0 and child['device_list'] == []


def test_overview_lists_contracts_by_next_cancel_date_and_hides_them_from_children(anna, kind, fremd, household, client_for):
    from datetime import date
    from decimal import Decimal

    from haushalt.models import FolderEntry

    # Beträge sieht nur, wer sie erfasst hat (services.can_see_cost) — hier Anna.
    FolderEntry.objects.create(household=household, kind='vertrag', name='Internet', cost=Decimal('39.99'), created_by=anna)
    FolderEntry.objects.create(
        household=household, kind='vertrag', name='Strom', provider='Stadtwerke', cost=Decimal('80.00'),
        end_date=date(2030, 6, 30), notice_period_days=92, created_by=anna,
    )
    FolderEntry.objects.create(household=household, kind='geraet', name='Waschmaschine')
    mine = client_for(anna).get(OVERVIEW).data
    assert mine['contracts'] == 2
    assert mine['contracts_monthly'] == '119.99'
    assert [(c['name'], str(c['cancellation_deadline'])) for c in mine['contract_list']] == [('Strom', '2030-03-30'), ('Internet', 'None')]
    assert client_for(fremd).get(OVERVIEW).data['contract_list'] == []
    child = client_for(kind).get(OVERVIEW).data
    assert child['contracts'] == 0 and child['contract_list'] == [] and child['contracts_monthly'] == '0.00'


# ---------------------------------------------------------------------------
# Haushalt V1 final (docs/HAUSHALT_V1.md)
# ---------------------------------------------------------------------------

FOLDER = '/api/v1/haushalt/ordner/'
LISTS = '/api/v1/haushalt/einkauf/listen/'


def _task(household, **fields):
    return Task.objects.create(household=household, title=fields.pop('title', 'Bad putzen'), **fields)


def test_weekly_task_advances_from_its_due_date_keeping_the_weekday(household):
    from datetime import date

    from haushalt import services

    task = _task(household, recurrence_days=7, due_date=date(2026, 10, 6))  # Dienstag
    assert services.next_due_date(task, today=date(2026, 10, 6)) == date(2026, 10, 13)
    # Zu spät erledigt: weiter im Rhythmus, nicht „heute + 7“.
    assert services.next_due_date(task, today=date(2026, 10, 9)) == date(2026, 10, 13)
    assert services.next_due_date(task, today=date(2026, 10, 20)) == date(2026, 10, 27)
    monthly = _task(household, recurrence_months=1, due_date=date(2026, 1, 31))
    assert services.next_due_date(monthly, today=date(2026, 1, 31)) == date(2026, 2, 28)
    yearly = _task(household, recurrence_months=12, due_date=date(2026, 10, 6))
    assert services.next_due_date(yearly, today=date(2026, 10, 6)) == date(2027, 10, 6)


def test_completing_a_recurring_task_moves_it_without_new_records(anna, household, client_for):
    today = timezone.localdate()
    task = _task(household, recurrence_days=7, due_date=today)
    response = client_for(anna).post(f'{URL}{task.id}/erledigt/')
    assert response.status_code == 200
    assert response.data['due_date'] == (today + timedelta(days=7)).isoformat()
    assert response.data['status'] == 'open'
    assert Task.objects.filter(household=household).count() == 1
    assert TaskCompletion.objects.filter(task=task).count() == 1


def test_every_x_weeks_is_a_day_interval(anna, client_for):
    response = client_for(anna).post(
        URL, {'title': 'Fenster', 'recurrence_days': 14, 'due_date': timezone.localdate().isoformat()}, format='json'
    )
    assert response.status_code == 201
    assert (response.data['recurrence_days'], response.data['recurrence_months']) == (14, None)


def test_cancellation_deadline_is_end_minus_notice_days(anna, client_for):
    from datetime import date

    from haushalt import services
    from haushalt.models import FolderEntry

    entry = FolderEntry(kind='vertrag', name='Strom', end_date=date(2026, 12, 31), notice_period_days=30)
    assert services.cancellation_deadline(entry) == date(2026, 12, 1)
    response = client_for(anna).post(
        FOLDER,
        {'kind': 'vertrag', 'name': 'Strom', 'cost': '80.00', 'end_date': '2026-12-31', 'notice_period_days': 30},
        format='json',
    )
    assert response.status_code == 201, response.data
    assert response.data['cancellation_deadline'] == '2026-12-01'


def test_contract_validation(anna, client_for):
    client = client_for(anna)
    base = {'kind': 'vertrag', 'name': 'Strom'}
    backwards = client.post(FOLDER, {**base, 'start_date': '2026-05-01', 'end_date': '2026-04-30'}, format='json')
    assert backwards.status_code == 400 and 'end_date' in backwards.data
    assert client.post(FOLDER, {**base, 'notice_period_days': -1}, format='json').status_code == 400
    assert client.post(FOLDER, {**base, 'cost': '0'}, format='json').status_code == 400
    assert client.post(FOLDER, {**base, 'billing_cycle': 'WEEKLY'}, format='json').status_code == 400
    assert client.post(FOLDER, {**base, 'status': 'EXPIRING'}, format='json').status_code == 400
    assert client.post(FOLDER, {**base, 'status': 'REPAIR'}, format='json').status_code == 400
    same_day = client.post(FOLDER, {**base, 'start_date': '2026-05-01', 'end_date': '2026-05-01'}, format='json')
    assert same_day.status_code == 201


def test_contract_status_is_computed(household):
    from datetime import date

    from haushalt import services
    from haushalt.models import FolderEntry

    today = date(2026, 10, 6)
    soon = FolderEntry(kind='vertrag', name='A', end_date=date(2026, 12, 31), notice_period_days=70)
    assert services.contract_status(soon, today) == 'EXPIRING'  # Frist 22.10.
    later = FolderEntry(kind='vertrag', name='B', end_date=date(2027, 12, 31), notice_period_days=30)
    assert services.contract_status(later, today) == 'ACTIVE'
    over = FolderEntry(kind='vertrag', name='C', end_date=date(2026, 9, 30))
    assert services.contract_status(over, today) == 'ENDED'
    renews = FolderEntry(kind='vertrag', name='D', end_date=date(2026, 9, 30), auto_renewal=True)
    assert services.contract_status(renews, today) == 'ACTIVE'
    cancelled = FolderEntry(kind='vertrag', name='E', end_date=date(2026, 12, 31), notice_period_days=70, status='CANCELLED')
    assert services.contract_status(cancelled, today) == 'CANCELLED'
    assert services.folder_deadlines(cancelled, today) == []


def test_contract_number_only_in_detail_and_never_for_others(anna, fremd, client_for):
    client = client_for(anna)
    created = client.post(
        FOLDER, {'kind': 'vertrag', 'name': 'Strom', 'contract_number': ' 12-345 '}, format='json'
    ).data
    assert created['contract_number'] == '12-345'
    assert 'contract_number' not in client.get(FOLDER).data[0]
    assert client.get(f'{FOLDER}{created["id"]}/').data['contract_number'] == '12-345'
    assert 'contract_number' not in str(client.get(OVERVIEW).data)
    assert client_for(fremd).get(f'{FOLDER}{created["id"]}/').status_code == 404
    assert client_for(fremd).patch(f'{FOLDER}{created["id"]}/', {'name': 'x'}, format='json').status_code == 404


def test_device_status_and_past_dates(anna, client_for):
    client = client_for(anna)
    device = client.post(
        FOLDER,
        {
            'kind': 'geraet', 'name': 'Waschmaschine', 'provider': 'AEG', 'category': 'Küche',
            'purchase_date': '2019-03-01', 'warranty_end_date': '2021-03-01', 'maintenance_due_date': '2025-01-01',
        },
        format='json',
    )
    assert device.status_code == 201, device.data
    assert device.data['status'] == 'ACTIVE' and device.data['effective_status'] == 'ACTIVE'
    assert client.patch(f'{FOLDER}{device.data["id"]}/', {'status': 'CANCELLED'}, format='json').status_code == 400
    repair = client.patch(f'{FOLDER}{device.data["id"]}/', {'status': 'REPAIR'}, format='json')
    assert repair.data['status'] == 'REPAIR'
    retired = client.patch(f'{FOLDER}{device.data["id"]}/', {'status': 'RETIRED'}, format='json')
    assert retired.data['status'] == 'RETIRED' and retired.data['deadlines'] == []
    assert client.delete(f'{FOLDER}{device.data["id"]}/').status_code == 204


def test_upcoming_uses_one_30_day_window(anna, household, client_for):
    from haushalt import services
    from haushalt.models import FolderEntry

    today = timezone.localdate()
    FolderEntry.objects.create(household=household, kind='geraet', name='Heizung', maintenance_due_date=today + timedelta(days=30))
    FolderEntry.objects.create(household=household, kind='geraet', name='Router', warranty_end_date=today + timedelta(days=31))
    FolderEntry.objects.create(
        household=household, kind='vertrag', name='Strom', end_date=today + timedelta(days=40), notice_period_days=30
    )
    FolderEntry.objects.create(
        household=household, kind='geraet', name='Alt', status='RETIRED', maintenance_due_date=today + timedelta(days=2)
    )
    assert services.UPCOMING_DAYS == 30
    data = client_for(anna).get(OVERVIEW).data
    assert [(d['name'], d['art'], d['days']) for d in data['deadlines']] == [
        ('Strom', 'kuendigung', 10),
        ('Heizung', 'wartung', 30),
    ]
    assert data['summary']['upcoming'] == 2
    assert data['summary']['contracts_expiring'] == 1


def test_summary_counts_only_the_own_household(anna, fremd, household, client_for):
    today = timezone.localdate()
    _task(household, due_date=today)
    _task(household, due_date=today - timedelta(days=2))
    _task(household, recurrence_days=7, due_date=today + timedelta(days=3))
    shopping = client_for(anna).post('/api/v1/haushalt/einkauf/eintraege/', {'name': 'Milch'}, format='json')
    assert shopping.status_code == 201
    summary = client_for(anna).get(OVERVIEW).data
    assert {k: summary['summary'][k] for k in ('open_tasks', 'due_today', 'overdue_tasks', 'recurring_tasks', 'open_shopping_items')} == {
        'open_tasks': 3, 'due_today': 1, 'overdue_tasks': 1, 'recurring_tasks': 1, 'open_shopping_items': 1,
    }
    assert summary['shopping']['preview'] == ['Milch']
    other = client_for(fremd).get(OVERVIEW).data
    assert other['summary']['open_tasks'] == 0 and other['shopping']['preview'] == []


def test_archived_lists_are_hidden_and_never_default(anna, household, client_for):
    from haushalt import services

    client = client_for(anna)
    first = client.get(LISTS).data[0]
    assert client.patch(f'{LISTS}{first["id"]}/', {'archived': True}, format='json').status_code == 400
    second = client.post(LISTS, {'name': 'Drogerie'}, format='json').data
    archived = client.patch(f'{LISTS}{first["id"]}/', {'archived': True}, format='json')
    assert archived.status_code == 200 and archived.data['archived'] is True
    assert [row['id'] for row in client.get(LISTS).data] == [second['id']]
    assert [row['id'] for row in client.get(f'{LISTS}?archiviert=1').data] == [first['id']]
    assert services.active_shopping_list(household).pk == second['id']
    restored = client.patch(f'{LISTS}{first["id"]}/', {'archived': False}, format='json')
    assert restored.data['archived'] is False


def test_shopping_item_notes(anna, client_for):
    item = client_for(anna).post(
        '/api/v1/haushalt/einkauf/eintraege/', {'name': 'Brot', 'notes': ' Vollkorn '}, format='json'
    ).data
    assert item['notes'] == 'Vollkorn' and item['updated_at']


@pytest.mark.django_db(transaction=True)
def test_migration_converts_notice_months_to_exact_days():
    from datetime import date

    from django.db import connection
    from django.db.migrations.executor import MigrationExecutor

    executor = MigrationExecutor(connection)
    executor.migrate([('haushalt', '0007_routinen_geraete_listen')])
    old_apps = executor.loader.project_state([('haushalt', '0007_routinen_geraete_listen')]).apps
    Household = old_apps.get_model('core', 'Household')
    OldEntry = old_apps.get_model('haushalt', 'FolderEntry')
    home = Household.objects.create(name='Alt')
    OldEntry.objects.create(
        household=home, kind='vertrag', name='Strom', monthly_cost=Decimal('80.00'),
        contract_end=date(2026, 12, 31), notice_period_months=1,
    )
    OldEntry.objects.create(household=home, kind='vertrag', name='Ohne Ende', notice_period_months=2)
    OldEntry.objects.create(household=home, kind='geraet', name='Heizung', warranty_until=date(2027, 1, 1), next_maintenance=date(2026, 11, 1))

    executor = MigrationExecutor(connection)
    executor.loader.build_graph()
    executor.migrate(executor.loader.graph.leaf_nodes())
    from haushalt.models import FolderEntry

    from haushalt import services

    strom = FolderEntry.objects.get(name='Strom')
    # „1 Monat vor dem 31.12.“ war der 30.11. — derselbe Kündigungstag in Tagen.
    assert (strom.cost, strom.end_date, strom.notice_period_days, strom.billing_cycle) == (
        Decimal('80.00'), date(2026, 12, 31), 31, 'MONTHLY',
    )
    assert services.cancellation_deadline(strom) == date(2026, 11, 30)
    assert FolderEntry.objects.get(name='Ohne Ende').notice_period_days == 60
    heizung = FolderEntry.objects.get(name='Heizung')
    assert (heizung.warranty_end_date, heizung.maintenance_due_date, heizung.status) == (
        date(2027, 1, 1), date(2026, 11, 1), 'ACTIVE',
    )


# ---------------------------------------------------------------------------
# Dashboard V1: tagesbezogene Zahlen und Fristen für „Für dich“ — nur der eigene Haushalt
# ---------------------------------------------------------------------------

def test_dashboard_day_counts_and_deadlines_never_leak(anna, kind, fremd, household, client_for):
    from haushalt.models import FolderEntry

    today = timezone.localdate()
    Task.objects.create(household=household, title='Heute 1', due_date=today)
    Task.objects.create(household=household, title='Heute 2', due_date=today)
    Task.objects.create(household=household, title='Überfällig', due_date=today - timedelta(days=1))
    Task.objects.create(household=household, title='Pausiert', due_date=today, is_paused=True)
    FolderEntry.objects.create(household=household, kind='geraet', name='Geschirrspüler', maintenance_due_date=today + timedelta(days=10))

    mine = client_for(anna).get(OVERVIEW).data
    assert (mine['summary']['due_today'], mine['overdue_tasks']) == (2, 1)
    assert [d['name'] for d in mine['deadlines']] == ['Geschirrspüler']

    # Kind-Konto: dieselben Aufgaben-Zahlen, aber keine Geräte-/Vertragsfristen (keine indirekten Hinweise).
    child = client_for(kind).get(OVERVIEW).data
    assert (child['summary']['due_today'], child['overdue_tasks']) == (2, 1)
    assert child['deadlines'] == []

    # Fremder Haushalt: weder Zahlen noch Fristen.
    other = client_for(fremd).get(OVERVIEW).data
    assert (other['summary']['due_today'], other['overdue_tasks'], other['deadlines']) == (0, 0, [])
