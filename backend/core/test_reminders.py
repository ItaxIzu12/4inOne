"""O1 – Erinnerung per E-Mail: freiwillig, nur bestätigte Adressen, nur eigene/sichtbare Einträge, nie doppelt."""

from datetime import date, timedelta

import pytest
from allauth.account.models import EmailAddress
from django.contrib.auth import get_user_model
from django.core import mail
from django.core.management import call_command
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import Household, HouseholdMembership, UserPreference
from core.reminders import due_today, send_due_reminders
from haushalt.models import FolderEntry, Task as HouseholdTask
from organisation.models import PersonalTask
from reisen.models import Trip, TripTask

pytestmark = pytest.mark.django_db


def _user(name, verified=True, reminder='daily'):
    user = get_user_model().objects.create_user(username=f'{name}@example.com', email=f'{name}@example.com', password='x', first_name=name.capitalize())
    if verified:
        EmailAddress.objects.create(user=user, email=user.email, verified=True, primary=True)
    UserPreference.objects.create(user=user, reminder_email=reminder)
    return user


def test_profile_reads_and_changes_the_setting():
    user = get_user_model().objects.create_user(username='p@example.com', email='p@example.com', password='x')
    client = APIClient()
    client.force_authenticate(user)
    assert client.get('/api/v1/auth/me/').data['reminder_email'] == 'off'
    assert client.patch('/api/v1/auth/me/', {'reminder_email': 'weekly'}, format='json').data['reminder_email'] == 'weekly'
    assert client.patch('/api/v1/auth/me/', {'reminder_email': 'hourly'}, format='json').status_code == 400


def test_daily_digest_lists_today_tasks_and_near_deadlines_of_the_person_only():
    anna, ben = _user('anna'), _user('ben', reminder='off')
    home = Household.objects.create(name='Zuhause')
    HouseholdMembership.objects.create(user=anna, household=home)
    HouseholdMembership.objects.create(user=ben, household=home)
    today = timezone.localdate()
    PersonalTask.objects.create(owner=anna, title='Arzt anrufen', due_date=today)
    PersonalTask.objects.create(owner=ben, title='Bens Geheimnis', due_date=today)
    HouseholdTask.objects.create(household=home, title='Müll rausbringen', due_date=today - timedelta(days=1))
    HouseholdTask.objects.create(household=home, title='Bens Aufgabe', due_date=today, assigned_to=ben)
    FolderEntry.objects.create(household=home, kind='geraet', name='Heizung', maintenance_due_date=today + timedelta(days=2))
    FolderEntry.objects.create(household=home, kind='geraet', name='Später', maintenance_due_date=today + timedelta(days=10))
    trip = Trip.objects.create(owner=anna, title='Lissabon', start_date=today + timedelta(days=4), end_date=today + timedelta(days=6))
    TripTask.objects.create(trip=trip, title='Online Check-in', due_date=today)

    stats = send_due_reminders(today)

    assert stats['sent'] == 1 and len(mail.outbox) == 1
    message = mail.outbox[0]
    assert message.to == ['anna@example.com']
    for expected in ('Arzt anrufen', 'Müll rausbringen', 'überfällig', 'Online Check-in', 'Lissabon', 'Wartung: Heizung', '/einstellungen/profil'):
        assert expected in message.body, expected
    for hidden in ('Bens Geheimnis', 'Bens Aufgabe', 'Später'):
        assert hidden not in message.body, hidden


def test_never_twice_a_day_nothing_without_content_and_only_verified_addresses():
    today = timezone.localdate()
    anna = _user('anna')
    _user('unverified', verified=False)
    quiet = _user('quiet')
    PersonalTask.objects.create(owner=anna, title='Arzt anrufen', due_date=today)

    first = send_due_reminders(today)
    second = send_due_reminders(today)

    assert len(mail.outbox) == 1
    assert first == {'sent': 1, 'empty': 1, 'skipped': 1, 'failed': 0}
    assert second['sent'] == 0
    assert UserPreference.objects.get(user=quiet).reminder_last_sent == today


def test_weekly_only_on_monday_and_dry_run_sends_nothing():
    pref = UserPreference(reminder_email='weekly')
    monday = date(2026, 11, 23)
    assert due_today(pref, monday) is True
    assert due_today(pref, monday + timedelta(days=1)) is False
    assert due_today(UserPreference(reminder_email='off'), monday) is False

    anna = _user('anna')
    PersonalTask.objects.create(owner=anna, title='Arzt anrufen', due_date=timezone.localdate())
    call_command('send_reminder_emails', '--dry-run')
    assert mail.outbox == []
    assert UserPreference.objects.get(user=anna).reminder_last_sent is None
