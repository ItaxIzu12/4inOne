"""Wiederkehrende Aufgaben mit Rotation, Kalender-Verknüpfung und
Lastanzeige."""

from datetime import timedelta

import pytest
from django.utils import timezone

from haushalt.models import Task, TaskCompletion
from organisation.models import CalendarEvent

pytestmark = pytest.mark.django_db

URL = '/api/v1/haushalt/aufgaben/'
LOAD = '/api/v1/haushalt/aufgaben/verteilung/'


def test_recurring_task_moves_on_and_rotates_after_completion(anna, ben, client_for):
    client = client_for(anna)
    created = client.post(
        URL,
        {
            'title': 'Bad putzen',
            'recurrence_days': 7,
            'effort': 3,
            'rotate': True,
            'rotation_member_ids': [anna.id, ben.id],
        },
        format='json',
    )
    assert created.status_code == 201, created.data
    assert created.data['assigned_to'] == anna.id  # erste Person der Rotation
    assert created.data['due_date'] == timezone.localdate().isoformat()

    done = client.post(f'{URL}{created.data["id"]}/erledigt/')

    assert done.status_code == 200
    assert done.data['assigned_to'] == ben.id
    assert done.data['due_date'] == (timezone.localdate() + timedelta(days=7)).isoformat()
    assert done.data['is_done'] is False
    assert done.data['last_done_by_name'] == 'Anna'

    again = client_for(ben).post(f'{URL}{created.data["id"]}/erledigt/')
    assert again.data['assigned_to'] == anna.id


def test_one_off_task_disappears_after_completion(anna, client_for):
    client = client_for(anna)
    task = client.post(URL, {'title': 'Glühbirne wechseln'}, format='json').data

    client.post(f'{URL}{task["id"]}/erledigt/')

    assert client.get(URL).data == []
    assert Task.objects.get(pk=task['id']).is_done is True


def test_dated_task_appears_in_calendar_and_leaves_it_when_done(anna, household, client_for):
    client = client_for(anna)
    due = timezone.localdate() + timedelta(days=2)
    task = client.post(URL, {'title': 'Müll rausbringen', 'due_date': due.isoformat()}, format='json').data

    event = CalendarEvent.objects.get(household=household, source=CalendarEvent.Source.TASK)
    assert event.all_day is True
    assert timezone.localtime(event.starts_at).date() == due
    assert Task.objects.get(pk=task['id']).calendar_event == event

    client.post(f'{URL}{task["id"]}/erledigt/')
    assert not CalendarEvent.objects.filter(household=household).exists()


def test_recurring_task_calendar_event_follows_the_next_due_date(anna, household, client_for):
    client = client_for(anna)
    task = client.post(URL, {'title': 'Blumen gießen', 'recurrence_days': 3}, format='json').data
    client.post(f'{URL}{task["id"]}/erledigt/')

    event = CalendarEvent.objects.get(household=household)
    assert timezone.localtime(event.starts_at).date() == timezone.localdate() + timedelta(days=3)


def test_deleting_a_task_removes_its_calendar_event(anna, household, client_for):
    client = client_for(anna)
    task = client.post(URL, {'title': 'Fenster', 'due_date': timezone.localdate().isoformat()}, format='json').data
    client.delete(f'{URL}{task["id"]}/')
    assert not CalendarEvent.objects.filter(household=household).exists()


def test_rotation_requires_recurrence_and_two_people(anna, ben, client_for):
    client = client_for(anna)
    no_recurrence = client.post(
        URL, {'title': 'X', 'rotate': True, 'rotation_member_ids': [anna.id, ben.id]}, format='json'
    )
    one_person = client.post(
        URL, {'title': 'X', 'recurrence_days': 7, 'rotate': True, 'rotation_member_ids': [anna.id]}, format='json'
    )
    assert no_recurrence.status_code == 400
    assert one_person.status_code == 400


def test_task_cannot_be_assigned_to_someone_from_another_household(anna, fremd, client_for):
    response = client_for(anna).post(URL, {'title': 'Staubsaugen', 'assigned_to': fremd.id}, format='json')
    assert response.status_code == 400
    assert Task.objects.count() == 0


def test_tasks_of_another_household_are_invisible(anna, fremd, client_for):
    task = client_for(fremd).post(URL, {'title': 'Geheim'}, format='json').data
    client = client_for(anna)
    assert client.get(URL).data == []
    assert client.post(f'{URL}{task["id"]}/erledigt/').status_code == 404


def test_load_view_shows_effort_points_per_member_including_zero(anna, ben, client_for):
    client = client_for(anna)
    heavy = client.post(URL, {'title': 'Keller aufräumen', 'effort': 3}, format='json').data
    light = client.post(URL, {'title': 'Spülmaschine', 'effort': 1, 'recurrence_days': 1}, format='json').data
    client.post(f'{URL}{heavy["id"]}/erledigt/')
    client.post(f'{URL}{light["id"]}/erledigt/')

    members = {m['name']: m for m in client.get(LOAD).data['members']}
    assert members['Anna']['points'] == 4
    assert members['Anna']['count'] == 2
    assert members['Ben']['points'] == 0


def test_changing_effort_later_does_not_rewrite_history(anna, client_for):
    client = client_for(anna)
    task = client.post(URL, {'title': 'Wäsche', 'effort': 1, 'recurrence_days': 7}, format='json').data
    client.post(f'{URL}{task["id"]}/erledigt/')
    client.patch(f'{URL}{task["id"]}/', {'effort': 3}, format='json')
    assert TaskCompletion.objects.get().effort == 1


def test_overdue_flag(anna, household, client_for):
    Task.objects.create(household=household, title='Alt', due_date=timezone.localdate() - timedelta(days=1))
    assert client_for(anna).get(URL).data[0]['is_overdue'] is True


def test_open_task_limit_per_household(anna, household, client_for, monkeypatch):
    from haushalt import services

    monkeypatch.setattr(services, 'MAX_OPEN_TASKS', 2)
    client = client_for(anna)
    assert client.post(URL, {'title': 'Eins'}, format='json').status_code == 201
    assert client.post(URL, {'title': 'Zwei'}, format='json').status_code == 201
    assert client.post(URL, {'title': 'Drei'}, format='json').status_code == 400
