"""Haushalt V1: Aufgabenfelder, Routinen, wieder öffnen, Übersicht — und
dass fremde Haushalte weder les- noch änderbar sind."""

from datetime import timedelta

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
    assert client.post(URL, {'title': 'X', 'recurrence': 'yearly'}, format='json').status_code == 400


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
    assert client_for(user).get(OVERVIEW).data == {
        'open_tasks': 0,
        'overdue_tasks': 0,
        'today': [],
        'upcoming': [],
        'open_shopping_items': 0,
        'devices': 0,
        'device_list': [],
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
