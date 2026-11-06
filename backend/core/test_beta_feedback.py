"""Beta-Rückmeldungen (Entwicklungsplan Phase 5): nur angemeldet, abschaltbar, datensparsam, nie für andere lesbar."""

from datetime import timedelta
from io import StringIO

import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import BetaFeedback

pytestmark = pytest.mark.django_db

URL = '/api/v1/feedback/'


def _client(name='anna'):
    user = get_user_model().objects.create_user(username=f'{name}@example.test', email=f'{name}@example.test',
                                                password='irrelevant-1A', first_name=name.capitalize())
    client = APIClient()
    client.force_authenticate(user)
    return user, client


def test_anonymous_requests_are_rejected():
    client = APIClient()
    assert client.get(URL).status_code == 401
    assert client.post(URL, {'message': 'x'}, format='json').status_code == 401
    assert not BetaFeedback.objects.exists()


@override_settings(BETA_FEEDBACK_ENABLED=False)
def test_switched_off_feedback_is_invisible_and_cannot_be_sent():
    _, client = _client()
    assert client.get(URL).data == {'enabled': False, 'areas': [], 'tasks': []}
    assert client.post(URL, {'message': 'Hallo'}, format='json').status_code == 404
    assert not BetaFeedback.objects.exists()


@override_settings(BETA_FEEDBACK_ENABLED=True)
def test_feedback_is_stored_minimal_and_only_the_id_comes_back():
    user, client = _client()
    info = client.get(URL)
    assert info.data['enabled'] is True and info['Cache-Control'] == 'no-store'
    assert [t['value'] for t in info.data['tasks']] == ['T1', 'T2', 'T3', 'T4', 'T5']
    r = client.post(URL, {'area': 'CONNECTIONS', 'task': 'T1', 'understood': 4, 'in_control': 5, 'saves_time': 'YES',
                          'would_continue': 'UNSURE', 'message': '  Klar, aber die Vorschau ist lang.  ',
                          'page': 'https://app.example/haushalt?tab=zuhause&token=abc#x'}, format='json')
    assert r.status_code == 201 and set(r.data) == {'id'}
    row = BetaFeedback.objects.get()
    assert (row.user, row.task, row.understood, row.message, row.page) == (user, 'T1', 4, 'Klar, aber die Vorschau ist lang.', '/haushalt')
    # Es gibt keine Liste und keinen Detail-Endpunkt — auch nicht für die eigene Rückmeldung.
    assert client.get(f'{URL}{row.id}/').status_code == 404


@override_settings(BETA_FEEDBACK_ENABLED=True)
@pytest.mark.parametrize('body', [
    {},
    {'message': '   '},
    {'understood': 0},
    {'understood': 6},
    {'in_control': 'viel'},
    {'area': 'NOPE', 'message': 'x'},
    {'task': 'T9', 'message': 'x'},
    {'saves_time': 'MAYBE'},
    {'message': 'x' * 2001},
])
def test_invalid_feedback_is_rejected(body):
    _, client = _client()
    assert client.post(URL, body, format='json').status_code == 400
    assert not BetaFeedback.objects.exists()


@override_settings(BETA_FEEDBACK_ENABLED=True)
def test_page_without_leading_slash_is_dropped_and_user_cannot_be_spoofed():
    _, client = _client()
    other, _ = _client('ben')
    client.post(URL, {'message': 'x', 'page': 'javascript:alert(1)', 'user': other.pk}, format='json')
    row = BetaFeedback.objects.get()
    assert row.page == '' and row.user != other


@override_settings(BETA_FEEDBACK_ENABLED=True, BETA_FEEDBACK_RETENTION_DAYS=180)
def test_feedback_is_deleted_with_the_account_and_after_the_retention_period():
    user, client = _client()
    client.post(URL, {'message': 'alt'}, format='json')
    client.post(URL, {'message': 'neu'}, format='json')
    BetaFeedback.objects.filter(message='alt').update(created_at=timezone.now() - timedelta(days=181))
    call_command('cleanup_expired', stdout=StringIO())
    assert list(BetaFeedback.objects.values_list('message', flat=True)) == ['neu']
    user.delete()
    assert not BetaFeedback.objects.exists()


@override_settings(BETA_FEEDBACK_ENABLED=True)
def test_report_is_pseudonymous_and_summarises_per_task():
    anna, a = _client('anna')
    _, b = _client('ben')
    a.post(URL, {'task': 'T1', 'understood': 4, 'would_continue': 'YES', 'message': 'Gut | verständlich'}, format='json')
    b.post(URL, {'task': 'T1', 'understood': 2, 'would_continue': 'NO'}, format='json')
    a.post(URL, {'task': 'T4', 'in_control': 5}, format='json')
    out = StringIO()
    call_command('beta_feedback_report', stdout=out)
    report = out.getvalue()
    assert 'Rückmeldungen: **3** von **2** Personen.' in report
    assert '| Vertrag anlegen und mit Finanzen und Organisation verbinden | 2 | 3.0 (n = 2) | — | — | Ja 1 · Nein 1 (n = 2) |' in report
    assert '| P1 |' in report and 'Gut \\| verständlich' in report
    assert 'anna' not in report.lower() and 'example.test' not in report


@override_settings(BETA_FEEDBACK_ENABLED=True)
def test_usage_report_counts_days_and_areas_without_content():
    from datetime import datetime
    from zoneinfo import ZoneInfo

    from core.models import Household, HouseholdMembership
    from haushalt.models import FolderEntry
    from organisation.models import PersonalTask

    anna, a = _client('anna')
    ben, _ = _client('ben')
    a.post(URL, {'message': 'x'}, format='json')
    home = Household.objects.create(name='Zuhause')
    HouseholdMembership.objects.create(user=anna, household=home, role=HouseholdMembership.Role.ADMIN)
    berlin = ZoneInfo('Europe/Berlin')
    entry = FolderEntry.objects.create(household=home, created_by=anna, kind='vertrag', name='Geheimvertrag')
    FolderEntry.objects.filter(pk=entry.pk).update(created_at=datetime(2026, 11, 10, 23, 30, tzinfo=berlin))
    for day in (11, 18):
        task = PersonalTask.objects.create(owner=anna, title='Geheime Aufgabe')
        PersonalTask.objects.filter(pk=task.pk).update(created_at=datetime(2026, 11, day, 9, tzinfo=berlin))
    out = StringIO()
    call_command('beta_usage_report', '--since', '2026-11-10', '--until', '2026-11-30', stdout=out)
    report = out.getvalue()
    assert 'Personen: **1**' in report  # ohne --users: nur wer Feedback gegeben hat
    assert '| P1 | 3 | 2 | — | 1 (1) | 2 (2) | — | — |' in report
    assert 'In mindestens zwei verschiedenen Wochen aktiv: **1 von 1**.' in report
    assert 'Geheim' not in report and 'anna' not in report.lower()
    # ausdrücklich genannte Testpersonen ohne Feedback zählen mit; unbekannte Adressen brechen ab
    out = StringIO()
    call_command('beta_usage_report', '--since', '2026-11-10', '--until', '2026-11-30',
                 '--users', 'anna@example.test,ben@example.test', stdout=out)
    assert '| P2 | 0 | 0 |' in out.getvalue()
    from django.core.management.base import CommandError
    with pytest.raises(CommandError):
        call_command('beta_usage_report', '--since', '2026-11-10', '--users', 'nobody@example.test', stdout=StringIO())
    with pytest.raises(CommandError):
        call_command('beta_usage_report', '--since', '2026-11-30', '--until', '2026-11-01', stdout=StringIO())
