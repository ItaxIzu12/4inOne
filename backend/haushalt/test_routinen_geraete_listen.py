"""Routinen (pausieren, Serie, Erledigungsrate), Geräte (Raum, Modell,
letzte Wartung) und mehrere Einkaufslisten pro Haushalt."""

from datetime import date, datetime, time, timedelta

import pytest
from django.utils import timezone

from haushalt import services
from haushalt.models import FolderEntry, ShoppingItem, ShoppingList, Task, TaskCompletion

pytestmark = pytest.mark.django_db

TASKS = '/api/v1/haushalt/aufgaben/'
ROUTINE_STATS = '/api/v1/haushalt/aufgaben/routinen/'
FOLDER = '/api/v1/haushalt/ordner/'
LISTS = '/api/v1/haushalt/einkauf/listen/'
SHOPPING = '/api/v1/haushalt/einkauf/'
ITEMS = '/api/v1/haushalt/einkauf/eintraege/'


def _done(task, day: date):
    TaskCompletion.objects.create(
        task=task,
        household=task.household,
        title=task.title,
        done_at=timezone.make_aware(datetime.combine(day, time(12))),
        effort=task.effort,
    )


# ---------------------------------------------------------------------------
# Routinen
# ---------------------------------------------------------------------------


def test_paused_routine_cannot_be_completed_and_resumes_from_today(anna, household, client_for):
    client = client_for(anna)
    routine = client.post(TASKS, {'title': 'Müll rausbringen', 'recurrence': 'daily'}, format='json').data
    Task.objects.filter(pk=routine['id']).update(due_date=timezone.localdate() - timedelta(days=9))

    paused = client.patch(f'{TASKS}{routine["id"]}/', {'is_paused': True}, format='json')
    assert paused.status_code == 200 and paused.data['is_paused'] is True
    assert client.post(f'{TASKS}{routine["id"]}/erledigt/').status_code == 400

    resumed = client.patch(f'{TASKS}{routine["id"]}/', {'is_paused': False}, format='json')
    assert resumed.data['is_paused'] is False
    assert resumed.data['due_date'] == timezone.localdate().isoformat()


def test_only_routines_can_be_paused(anna, client_for):
    client = client_for(anna)
    task = client.post(TASKS, {'title': 'Glühbirne wechseln'}, format='json').data
    response = client.patch(f'{TASKS}{task["id"]}/', {'is_paused': True}, format='json')
    assert response.status_code == 400
    assert 'is_paused' in response.data


def test_paused_routines_stay_out_of_today_and_overview(anna, household, client_for):
    Task.objects.create(
        household=household, title='Pflanzen gießen', recurrence_days=1, due_date=timezone.localdate(), is_paused=True
    )
    client = client_for(anna)
    assert client.get('/api/v1/haushalt/uebersicht/').data['today'] == []
    today = client.get('/api/v1/today/').data
    assert 'Pflanzen gießen' not in str(today)


@pytest.mark.parametrize(
    ('recurrence', 'done_offsets', 'expected'),
    [
        # täglich: heute noch offen bricht die Serie nicht, die Lücke vor drei Tagen schon
        ({'recurrence_days': 1}, [1, 2, 4], 2),
        ({'recurrence_days': 1}, [0, 1, 2], 3),
        # wöchentlich nach Kalenderwochen (Sonntag, 4.10.2026 → Woche ab 28.9.)
        ({'recurrence_days': 7}, [7, 14, 21], 3),
        ({'recurrence_days': 7}, [0, 21], 1),
        # monatlich nach Kalendermonaten
        ({'recurrence_months': 1}, [5, 35, 66], 3),
        ({'recurrence_days': 1}, [], 0),
    ],
)
def test_routine_streak_counts_periods_in_a_row(household, recurrence, done_offsets, expected):
    today = date(2026, 10, 4)
    task = Task.objects.create(household=household, title='Routine', **recurrence)
    days = [today - timedelta(days=offset) for offset in done_offsets]
    assert services.routine_streak(task, days, today) == expected


def test_streak_is_part_of_the_task_and_none_for_one_off_tasks(anna, household, client_for):
    routine = Task.objects.create(household=household, title='Küche', recurrence_days=1, due_date=timezone.localdate())
    Task.objects.create(household=household, title='Einmalig')
    today = timezone.localdate()
    for offset in (1, 2, 3):
        _done(routine, today - timedelta(days=offset))

    rows = {row['title']: row for row in client_for(anna).get(TASKS).data}
    assert rows['Küche']['streak'] == 3
    assert rows['Einmalig']['streak'] is None


def test_routine_completion_rate_over_four_weeks(anna, household, client_for):
    weekly = Task.objects.create(household=household, title='Bad', recurrence_days=7, due_date=timezone.localdate())
    Task.objects.filter(pk=weekly.pk).update(created_at=timezone.now() - timedelta(days=60))
    today = timezone.localdate()
    for offset in (1, 8, 15):  # 3 von 4 Wochen erledigt
        _done(weekly, today - timedelta(days=offset))
    Task.objects.create(household=household, title='Pausiert', recurrence_days=1, is_paused=True)

    data = client_for(anna).get(ROUTINE_STATS).data
    assert data == {'completion_rate': 75, 'done': 3, 'expected': 4}


def test_routine_stats_without_routines(anna, client_for):
    assert client_for(anna).get(ROUTINE_STATS).data['completion_rate'] is None


# ---------------------------------------------------------------------------
# Geräte
# ---------------------------------------------------------------------------


def test_device_keeps_room_model_and_records_last_maintenance(anna, client_for):
    client = client_for(anna)
    created = client.post(
        FOLDER,
        {
            'kind': 'geraet',
            'name': 'Waschmaschine',
            'provider': 'Bosch',
            'model': ' Serie 6 (WGG244Z0CH) ',
            'room': 'bad',
            'maintenance_interval_months': 12,
        },
        format='json',
    )
    assert created.status_code == 201, created.data
    assert created.data['model'] == 'Serie 6 (WGG244Z0CH)'
    assert created.data['room'] == 'bad'
    assert created.data['last_maintenance'] is None

    done = client.post(f'{FOLDER}{created.data["id"]}/wartung-erledigt/')
    assert done.data['last_maintenance'] == timezone.localdate().isoformat()


def test_device_fields_are_dropped_for_contracts_and_validated(anna, client_for):
    client = client_for(anna)
    contract = client.post(FOLDER, {'kind': 'vertrag', 'name': 'Strom', 'room': 'flur', 'model': 'X'}, format='json')
    assert contract.data['room'] == '' and contract.data['model'] == ''

    future = (timezone.localdate() + timedelta(days=3)).isoformat()
    bad = client.post(FOLDER, {'kind': 'geraet', 'name': 'Ofen', 'last_maintenance': future}, format='json')
    assert bad.status_code == 400 and 'last_maintenance' in bad.data
    assert client.post(FOLDER, {'kind': 'geraet', 'name': 'Ofen', 'room': 'dachboden'}, format='json').status_code == 400


# ---------------------------------------------------------------------------
# Mehrere Einkaufslisten
# ---------------------------------------------------------------------------


def test_lists_are_created_with_counts_and_a_default_list_exists(anna, household, client_for):
    client = client_for(anna)
    lists = client.get(LISTS).data
    assert [row['name'] for row in lists] == ['Wocheneinkauf']

    created = client.post(LISTS, {'name': 'Drogerie', 'icon': 'drogerie', 'description': ' Bad & Pflege '}, format='json')
    assert created.status_code == 201, created.data
    assert created.data['description'] == 'Bad & Pflege'
    assert created.data['created_by_name'] == 'Anna'

    client.post(ITEMS, {'name': 'Shampoo', 'shopping_list': created.data['id']}, format='json')
    item = client.post(ITEMS, {'name': 'Zahnpasta', 'shopping_list': created.data['id']}, format='json').data
    client.patch(f'{ITEMS}{item["id"]}/', {'is_checked': True}, format='json')

    rows = {row['name']: row for row in client.get(LISTS).data}
    assert rows['Drogerie']['item_count'] == 2 and rows['Drogerie']['checked_count'] == 1
    assert rows['Wocheneinkauf']['item_count'] == 0


def test_overview_shows_the_chosen_list_with_members(anna, ben, household, client_for):
    client = client_for(anna)
    drogerie = client.post(LISTS, {'name': 'Drogerie'}, format='json').data
    client.post(ITEMS, {'name': 'Seife', 'shopping_list': drogerie['id']}, format='json')
    client.post(ITEMS, {'name': 'Milch'}, format='json')

    data = client.get(SHOPPING, {'liste': drogerie['id']}).data
    assert data['list']['name'] == 'Drogerie'
    assert [item['name'] for item in data['items']] == ['Seife']
    assert {m['name']: m['is_owner'] for m in data['members']} == {'Anna': True, 'Ben': False}

    default = client.get(SHOPPING).data
    assert [item['name'] for item in default['items']] == ['Milch']


def test_foreign_lists_are_invisible(anna, fremd, client_for):
    own = client_for(anna).post(LISTS, {'name': 'Baumarkt'}, format='json').data
    intruder = client_for(fremd)

    assert intruder.get(SHOPPING, {'liste': own['id']}).status_code == 404
    assert intruder.patch(f'{LISTS}{own["id"]}/', {'name': 'X'}, format='json').status_code == 404
    assert intruder.post(ITEMS, {'name': 'Nagel', 'shopping_list': own['id']}, format='json').status_code == 400
    assert own['id'] not in [row['id'] for row in intruder.get(LISTS).data]
    assert not ShoppingItem.objects.filter(name='Nagel').exists()


def test_completing_a_list_only_takes_its_checked_items(anna, household, client_for):
    client = client_for(anna)
    party = client.post(LISTS, {'name': 'Party', 'icon': 'party'}, format='json').data
    chips = client.post(ITEMS, {'name': 'Chips', 'shopping_list': party['id']}, format='json').data
    milk = client.post(ITEMS, {'name': 'Milch'}, format='json').data
    for item in (chips, milk):
        client.patch(f'{ITEMS}{item["id"]}/', {'is_checked': True}, format='json')

    done = client.post(f'{ITEMS}abschliessen/', {'amount': None, 'shopping_list': party['id']}, format='json')
    assert done.status_code == 201 and done.data['item_count'] == 1
    assert list(ShoppingItem.objects.values_list('name', flat=True)) == ['Milch']


def test_the_last_list_cannot_be_deleted_and_changes_touch_updated_at(anna, household, client_for):
    client = client_for(anna)
    default = client.get(LISTS).data[0]
    assert client.delete(f'{LISTS}{default["id"]}/').status_code == 400

    ShoppingList.objects.filter(pk=default['id']).update(updated_at=timezone.now() - timedelta(days=3))
    client.post(ITEMS, {'name': 'Brot'}, format='json')
    touched = ShoppingList.objects.get(pk=default['id']).updated_at
    assert timezone.now() - touched < timedelta(minutes=1)

    extra = client.post(LISTS, {'name': 'Getränke'}, format='json').data
    assert client.delete(f'{LISTS}{extra["id"]}/').status_code == 204


def test_list_icon_must_be_known_and_lists_are_limited(anna, household, client_for, monkeypatch):
    client = client_for(anna)
    assert client.post(LISTS, {'name': 'X', 'icon': 'rakete'}, format='json').status_code == 400
    monkeypatch.setattr(services, 'MAX_SHOPPING_LISTS', 2)
    client.get(LISTS)
    assert client.post(LISTS, {'name': 'Zwei'}, format='json').status_code == 201
    assert client.post(LISTS, {'name': 'Drei'}, format='json').status_code == 400


def test_folder_entry_model_is_untouched_for_existing_rows(household):
    entry = FolderEntry.objects.create(household=household, kind='geraet', name='Heizung')
    assert entry.room == '' and entry.model == '' and entry.last_maintenance is None


def test_calendar_week_runs_monday_to_sunday():
    from datetime import date
    from haushalt.services import calendar_week
    assert calendar_week(date(2026, 10, 6)) == (date(2026, 10, 5), date(2026, 10, 11))
    assert calendar_week(date(2026, 10, 11)) == (date(2026, 10, 5), date(2026, 10, 11))  # Sonntag
    assert calendar_week(date(2026, 10, 12)) == (date(2026, 10, 12), date(2026, 10, 18))  # Montag
