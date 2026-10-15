"""Persistence & Integrity Audit (Beta): Daten überleben Neuladen und Ab-/Anmelden, Geld bleibt exakt, Datumswerte
verschieben sich nicht, doppelte Anfragen erzeugen nichts doppelt, gelöschte Eltern hinterlassen keine kaputten
Verweise, API-Antworten werden nicht zwischengespeichert.

Grund-CRUD je Bereich steht in den Bereichs-Tests (finanzen/tests, haushalt/test_*, organisation, reisen); hier
die bereichsübergreifenden Fälle und die Funde dieses Audits."""

from datetime import date, timedelta
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.test import Client
from django.utils import timezone
from rest_framework.test import APIClient

from connections.models import Connection
from core.models import Contact, Household, HouseholdMembership, Invitation
from finanzen.models import SavingsContribution, SavingsGoal
from haushalt.models import FolderEntry, Task, TaskCompletion
from reisen.models import Trip, TripParticipant, TripTask

pytestmark = pytest.mark.django_db
PASSWORD = 'Sicher123!x'


def make_user(name, household=None, role=HouseholdMembership.Role.ADMIN):
    user = get_user_model().objects.create_user(
        username=f'{name}@example.com', email=f'{name}@example.com', password=PASSWORD, first_name=name.title()
    )
    home = household or Household.objects.create(name=f'Zuhause {name}')
    HouseholdMembership.objects.create(user=user, household=home, role=role)
    return user


def api(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


# --------------------------------------------------------------------------- Neuladen, Ab-/Anmelden


def test_data_survives_logout_and_login_with_exact_values():
    anna = make_user('anna')
    browser = Client()
    access = browser.post('/api/v1/auth/login/', {'email': 'anna@example.com', 'password': PASSWORD},
                          content_type='application/json').json()['access']
    auth = {'HTTP_AUTHORIZATION': f'Bearer {access}'}
    created = {
        'note': browser.post('/api/v1/organisation/notes/', {'title': 'Ideen', 'body': 'Ünïcödé ✓', 'pinned': True},
                             content_type='application/json', **auth).json()['id'],
        'task': browser.post('/api/v1/organisation/tasks/', {'title': 'Arzt', 'due_date': '2026-11-12'},
                             content_type='application/json', **auth).json()['id'],
        'goal': browser.post('/api/v1/finanzen/private/goals/', {'title': 'Urlaub', 'target_amount': '1234.56'},
                             content_type='application/json', **auth).json()['id'],
    }
    csrf = browser.get('/api/v1/auth/csrf/').json()['csrfToken']
    assert browser.post('/api/v1/auth/logout/', HTTP_X_CSRFTOKEN=csrf).status_code == 204
    assert browser.get(f'/api/v1/organisation/notes/{created["note"]}/', **auth).status_code == 401  # abgemeldet

    again = Client()
    access = again.post('/api/v1/auth/login/', {'email': 'anna@example.com', 'password': PASSWORD},
                        content_type='application/json').json()['access']
    auth = {'HTTP_AUTHORIZATION': f'Bearer {access}'}
    note = again.get(f'/api/v1/organisation/notes/{created["note"]}/', **auth).json()
    assert (note['title'], note['body'], note['pinned']) == ('Ideen', 'Ünïcödé ✓', True)
    assert again.get(f'/api/v1/organisation/tasks/{created["task"]}/', **auth).json()['due_date'] == '2026-11-12'
    assert again.get(f'/api/v1/finanzen/private/goals/{created["goal"]}/', **auth).json()['target_amount'] == '1234.56'


# --------------------------------------------------------------------------- Datum


@pytest.mark.parametrize('day', ['2026-11-12', '2026-12-31', '2027-01-01', '2028-02-29', '2026-03-29', '2026-10-25'])
def test_date_only_values_never_shift(day):
    """Auch an Jahreswechsel, Schalttag und den Umstellungstagen der Sommerzeit (29.03./25.10.)."""
    anna = make_user('anna')
    c = api(anna)
    task = c.post('/api/v1/organisation/tasks/', {'title': 'X', 'due_date': day}, format='json').data
    assert c.get(f'/api/v1/organisation/tasks/{task["id"]}/').data['due_date'] == day
    home_task = c.post('/api/v1/haushalt/aufgaben/', {'title': 'Y', 'due_date': day}, format='json').data
    assert c.get(f'/api/v1/haushalt/aufgaben/{home_task["id"]}/').data['due_date'] == day
    trip = Trip.objects.create(owner=anna, title='T', destination='Z', start_date=day, end_date=day)
    data = c.get(f'/api/v1/reisen/trips/{trip.pk}/').data
    assert (data['start_date'], data['end_date']) == (day, day)


def test_all_day_event_keeps_its_calendar_day():
    anna = make_user('anna')
    c = api(anna)
    event = c.post('/api/v1/organisation/events/', {
        'title': 'Geburtstag', 'starts_at': '2026-11-12T00:00:00+01:00', 'all_day': True,
    }, format='json').data
    stored = c.get(f'/api/v1/organisation/events/{event["id"]}/').data['starts_at']
    assert stored.startswith('2026-11-12')


# --------------------------------------------------------------------------- Geld


def test_money_stays_exact_through_savings_contributions():
    anna = make_user('anna')
    c = api(anna)
    goal = c.post('/api/v1/finanzen/private/goals/', {'title': 'Rad', 'target_amount': '0.30'}, format='json').data
    c.patch(f'/api/v1/finanzen/private/goals/{goal["id"]}/', {'current_amount': '0.10'}, format='json')
    c.patch(f'/api/v1/finanzen/private/goals/{goal["id"]}/', {'current_amount': '0.30'}, format='json')
    assert c.get(f'/api/v1/finanzen/private/goals/{goal["id"]}/').data['current_amount'] == '0.30'
    total = sum((x.amount for x in SavingsContribution.objects.filter(goal_id=goal['id'])), Decimal('0'))
    assert total == Decimal('0.30')
    assert isinstance(SavingsGoal.objects.get().current_amount, Decimal)


def test_rejects_amounts_with_more_than_two_decimals_instead_of_rounding_silently():
    anna = make_user('anna')
    response = api(anna).post('/api/v1/finanzen/private/goals/', {'title': 'X', 'target_amount': '10.005'}, format='json')
    assert response.status_code == 400


# --------------------------------------------------------------------------- Doppelte Anfragen


def test_double_completion_of_a_recurring_task_counts_once_and_keeps_the_series():
    anna = make_user('anna')
    c = api(anna)
    today = timezone.localdate()
    task = c.post('/api/v1/haushalt/aufgaben/', {'title': 'Blumen', 'recurrence_days': 7, 'due_date': today.isoformat()},
                  format='json').data
    for _ in range(2):  # Doppelklick / Netzwerk-Wiederholung mit demselben Termin
        response = c.post(f'/api/v1/haushalt/aufgaben/{task["id"]}/erledigt/', {'due_date': today.isoformat()}, format='json')
        assert response.status_code == 200
    stored = Task.objects.get(pk=task['id'])
    assert stored.due_date == today + timedelta(days=7)
    assert TaskCompletion.objects.filter(task=stored).count() == 1
    # der nächste Termin lässt sich ganz normal abhaken
    c.post(f'/api/v1/haushalt/aufgaben/{task["id"]}/erledigt/', {'due_date': stored.due_date.isoformat()}, format='json')
    assert Task.objects.get(pk=task['id']).due_date == today + timedelta(days=14)
    assert c.post(f'/api/v1/haushalt/aufgaben/{task["id"]}/erledigt/', {'due_date': 'kaputt'}, format='json').status_code == 400


def test_duplicate_connections_and_dismissals_are_prevented_by_the_database():
    from django.db import IntegrityError, transaction

    anna = make_user('anna')
    home = anna.households.get()
    device = FolderEntry.objects.create(household=home, kind='geraet', name='Waschmaschine', created_by=anna)
    goal = SavingsGoal.objects.create(owner=anna, title='Neue Waschmaschine', target_amount=Decimal('500'), current_amount=0)
    payload = {'source_type': 'DEVICE', 'source_id': device.pk, 'target_type': 'SAVINGS_GOAL', 'target_id': goal.pk}
    first = api(anna).post('/api/v1/connections/', payload, format='json')
    second = api(anna).post('/api/v1/connections/', payload, format='json')
    assert first.status_code == 201 and second.status_code in (200, 400, 409)
    assert Connection.objects.count() == 1
    with pytest.raises(IntegrityError), transaction.atomic():
        Connection.objects.create(source_type='DEVICE', source_id=device.pk, target_type='SAVINGS_GOAL',
                                  target_id=goal.pk, relation_type='FUNDED_BY', created_by=anna)


# --------------------------------------------------------------------------- Gelöschte Eltern, Mitgliedschaften


def test_deleting_a_linked_object_removes_its_connections():
    anna = make_user('anna')
    home = anna.households.get()
    device = FolderEntry.objects.create(household=home, kind='geraet', name='Herd', created_by=anna)
    goal = SavingsGoal.objects.create(owner=anna, title='Neuer Herd', target_amount=Decimal('500'), current_amount=0)
    Connection.objects.create(source_type='DEVICE', source_id=device.pk, target_type='SAVINGS_GOAL', target_id=goal.pk,
                              relation_type='FUNDED_BY', created_by=anna)
    assert api(anna).delete(f'/api/v1/haushalt/ordner/{device.pk}/').status_code == 204
    assert not Connection.objects.exists()


def test_removed_household_member_keeps_no_assignments_or_rotation_place():
    anna = make_user('anna')
    home = anna.households.get()
    ben = make_user('ben', household=home, role=HouseholdMembership.Role.MEMBER)
    task = Task.objects.create(household=home, title='Bad', assigned_to=ben, recurrence_days=7, rotate=True,
                               due_date=timezone.localdate(), created_by=anna)
    task.rotation_members.set([anna, ben])
    membership = HouseholdMembership.objects.get(user=ben, household=home)
    assert api(anna).delete(f'/api/v1/household/members/{membership.pk}/').status_code == 204
    task.refresh_from_db()
    assert task.assigned_to is None
    assert list(task.rotation_members.all()) == [anna]
    # die Rotation verteilt danach nie an Ben
    api(anna).post(f'/api/v1/haushalt/aufgaben/{task.pk}/erledigt/', {'due_date': task.due_date.isoformat()}, format='json')
    task.refresh_from_db()
    assert task.assigned_to in (None, anna)


def test_leaving_a_trip_frees_the_trip_tasks_of_that_person():
    anna = make_user('anna')
    ben = make_user('ben')
    trip = Trip.objects.create(owner=anna, title='Berlin', destination='Berlin',
                               start_date=timezone.localdate(), end_date=timezone.localdate() + timedelta(days=2))
    participant = TripParticipant.objects.create(trip=trip, user=ben, role='EDITOR')
    task = TripTask.objects.create(trip=trip, title='Tickets', assignee=ben)
    assert api(ben).delete(f'/api/v1/reisen/participants/{participant.pk}/').status_code == 204
    task.refresh_from_db()
    assert task.assignee is None


@pytest.mark.parametrize('scope', ['TRIP', 'HOUSEHOLD'])
def test_deleting_a_shared_area_revokes_its_open_invitations(scope):
    anna = make_user('anna')
    ben = make_user('ben')
    Contact.objects.create(owner=anna, other=ben)
    if scope == 'TRIP':
        target = Trip.objects.create(owner=anna, title='Rom', destination='Rom',
                                     start_date=timezone.localdate(), end_date=timezone.localdate())
    else:
        target = anna.households.get()
    invitation = Invitation.objects.create(inviter=anna, invitee=ben, scope_type=scope, scope_id=target.pk,
                                           role='VIEWER' if scope == 'TRIP' else 'MEMBER',
                                           expires_at=timezone.now() + timedelta(days=14))
    target.delete()
    invitation.refresh_from_db()
    assert invitation.status == 'REVOKED' and invitation.responded_at is not None
    assert api(ben).get('/api/v1/invitations/').data['received'] == []


# --------------------------------------------------------------------------- Besitz und fremde IDs


def test_forged_owner_and_foreign_parent_ids_are_ignored_or_rejected():
    anna = make_user('anna')
    eve = make_user('eve')
    eve_trip = Trip.objects.create(owner=eve, title='Eve', destination='X',
                                   start_date=timezone.localdate(), end_date=timezone.localdate())
    c = api(anna)
    note = c.post('/api/v1/organisation/notes/', {'title': 'Meins', 'owner': eve.pk}, format='json').data
    assert get_user_model().objects.get(personal_notes__id=note['id']) == anna
    goal = c.post('/api/v1/finanzen/private/goals/', {'title': 'Z', 'target_amount': '5', 'owner': eve.pk}, format='json').data
    assert SavingsGoal.objects.get(pk=goal['id']).owner == anna
    assert c.post('/api/v1/reisen/tasks/', {'trip': eve_trip.pk, 'title': 'fremd'}, format='json').status_code in (400, 403, 404)
    home_task = c.post('/api/v1/haushalt/aufgaben/', {'title': 'H', 'household': eve.households.get().pk}, format='json').data
    assert Task.objects.get(pk=home_task['id']).household == anna.households.get()


# --------------------------------------------------------------------------- Kein Zwischenspeichern


@pytest.mark.parametrize('url', [
    '/api/v1/finanzen/private/summary/', '/api/v1/haushalt/uebersicht/', '/api/v1/today/', '/api/v1/contacts/',
    '/api/v1/invitations/', '/api/v1/notifications/', '/api/v1/auth/me/', '/api/v1/reisen/trips/',
])
def test_personal_api_responses_are_never_cached(url):
    anna = make_user('anna')
    response = api(anna).get(url)
    assert response.status_code == 200
    assert 'no-store' in response['Cache-Control']


# --------------------------------------------------------------------------- Aufräumen


def test_cleanup_removes_only_expired_helper_data():
    from django.core.management import call_command
    from rest_framework_simplejwt.tokens import RefreshToken

    from core.models import IdempotencyRecord, Notification, PasswordResetToken, UserSession
    from organisation.models import PersonalNote

    anna = make_user('anna')
    note = PersonalNote.objects.create(owner=anna, title='bleibt', body='x')
    old = timezone.now() - timedelta(days=200)
    RefreshToken.for_user(anna)  # gültig, bleibt
    UserSession.objects.create(user=anna, sid='alt' * 4, current_jti='x', last_seen=old)
    UserSession.objects.create(user=anna, sid='neu' * 4, current_jti='y', last_seen=timezone.now())
    PasswordResetToken.objects.create(user=anna, token='h' * 64, expires_at=old)
    record = IdempotencyRecord.objects.create(user=anna, scope='s', key='k' * 10, fingerprint='f', status_code=201)
    IdempotencyRecord.objects.filter(pk=record.pk).update(created_at=old)
    call_command('cleanup_expired', stdout=open('/dev/null', 'w'))
    assert list(UserSession.objects.values_list('sid', flat=True)) == ['neu' * 4]
    assert not PasswordResetToken.objects.exists() and not IdempotencyRecord.objects.exists()
    assert PersonalNote.objects.filter(pk=note.pk).exists()  # Fachdaten bleiben unangetastet
    assert Notification.objects.count() == 0
