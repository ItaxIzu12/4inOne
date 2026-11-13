"""Kalenderfreigabe wie in Outlook (31.10.2026): Anna gibt ihren Kalender für Ben frei.

Neue Termine sind privat. Ben sieht nur, was Anna ausdrücklich mit ihm teilt — erst nachdem er die Einladung
angenommen hat. Clara ist Kontakt ohne Freigabe, Dora völlig fremd."""

from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import Contact
from organisation.models import CalendarShare, EventShare, PersonalEvent

pytestmark = pytest.mark.django_db

EVENTS = '/api/v1/organisation/events/'
SHARES = '/api/v1/organisation/shares/'
INV = '/api/v1/invitations/'


def _user(name):
    return get_user_model().objects.create_user(
        username=f'{name}@example.com', email=f'{name}@example.com', password='irrelevant-1A', first_name=name.capitalize()
    )


def _client(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


def _contacts(a, b):
    Contact.objects.create(owner=a, other=b)
    Contact.objects.create(owner=b, other=a)


@pytest.fixture
def w():
    anna, ben, clara, dora = _user('anna'), _user('ben'), _user('clara'), _user('dora')
    _contacts(anna, ben)
    _contacts(anna, clara)
    # in 30 Minuten – aber nie über Mitternacht hinaus (sonst fehlt der Termin nach 23:30 in „Heute“)
    end_of_today = timezone.localtime().replace(hour=23, minute=59, second=0, microsecond=0)
    soon = min(timezone.now() + timedelta(minutes=30), end_of_today)
    return {'anna': anna, 'ben': ben, 'clara': clara, 'dora': dora, 'soon': soon}


def _invite(w, role='VIEWER', who='ben'):
    contact = Contact.objects.get(owner=w['anna'], other=w[who]).pk
    r = _client(w['anna']).post(
        INV, {'contact_id': contact, 'scope_type': 'MY_CALENDAR', 'scope_id': w['anna'].pk, 'role': role}, format='json'
    )
    assert r.status_code == 201, r.content
    return r.json()['id']


def _share(w, role='VIEWER', who='ben'):
    r = _client(w[who]).post(f'{INV}{_invite(w, role, who)}/accept/')
    assert r.status_code == 200, r.content


def _event(w, title, shared_with=None, by='anna'):
    body = {'title': title, 'starts_at': w['soon'].isoformat()}
    if shared_with is not None:
        body['shared_with'] = shared_with
    r = _client(w[by]).post(EVENTS, body, format='json')
    return r


def _titles(user):
    return sorted(e['title'] for e in _client(user).get(EVENTS).json())


# --------------------------------------------------------------------------- Einladen und Annehmen


def test_nothing_is_visible_before_the_invitation_is_accepted(w):
    _invite(w)
    r = _event(w, 'Geteilt', [w['ben'].pk])
    assert r.status_code == 400  # ohne angenommene Freigabe gibt es niemanden zum Teilen
    _event(w, 'Privat')
    assert _titles(w['ben']) == []
    assert not CalendarShare.objects.exists()


def test_only_the_owner_can_invite_to_her_own_calendar(w):
    contact = Contact.objects.get(owner=w['ben'], other=w['anna']).pk
    r = _client(w['ben']).post(
        INV, {'contact_id': contact, 'scope_type': 'MY_CALENDAR', 'scope_id': w['anna'].pk, 'role': 'VIEWER'}, format='json'
    )
    assert r.status_code in (403, 404)


# --------------------------------------------------------------------------- Privat ist der Normalfall


def test_new_events_are_private_and_only_explicitly_shared_ones_are_visible(w):
    _share(w)
    assert _event(w, 'Arzttermin').status_code == 201
    assert _event(w, 'Grillabend', [w['ben'].pk]).status_code == 201
    assert _titles(w['ben']) == ['Grillabend']
    assert _titles(w['clara']) == [] and _titles(w['dora']) == []


def test_the_audience_is_shown_only_to_the_owner(w):
    _share(w)
    event = _event(w, 'Grillabend', [w['ben'].pk]).json()
    assert event['shared_with'] == [w['ben'].pk]
    seen = _client(w['ben']).get(EVENTS).json()[0]
    assert seen['shared_with'] == []
    assert seen['shared_by'] == w['anna'].pk and event['shared_by'] is None
    assert seen['created_by'] == 'Anna'
    assert 'anna@example.com' not in str(seen)


def test_sharing_with_someone_without_a_share_is_rejected(w):
    _share(w)
    assert _event(w, 'X', [w['clara'].pk]).status_code == 400
    assert _event(w, 'Y', [w['dora'].pk]).status_code == 400
    assert _event(w, 'Z', [999999]).status_code == 400
    assert not PersonalEvent.objects.filter(title__in=['X', 'Y', 'Z']).exists()


def test_only_the_owner_can_change_who_sees_an_event(w):
    _share(w, 'EDITOR')
    event = _event(w, 'Grillabend', [w['ben'].pk]).json()
    r = _client(w['ben']).patch(f"{EVENTS}{event['id']}/", {'shared_with': []}, format='json')
    assert r.status_code == 403
    assert EventShare.objects.filter(event_id=event['id'], user=w['ben']).exists()


def test_making_an_event_private_again_hides_it(w):
    _share(w)
    event = _event(w, 'Grillabend', [w['ben'].pk]).json()
    r = _client(w['anna']).patch(f"{EVENTS}{event['id']}/", {'shared_with': []}, format='json')
    assert r.status_code == 200
    assert _titles(w['ben']) == []


# --------------------------------------------------------------------------- Rollen


def test_viewer_cannot_edit_or_delete(w):
    _share(w, 'VIEWER')
    event = _event(w, 'Grillabend', [w['ben'].pk]).json()
    ben = _client(w['ben'])
    assert ben.get(EVENTS).json()[0]['can_edit'] is False
    assert ben.patch(f"{EVENTS}{event['id']}/", {'title': 'Weg'}, format='json').status_code == 403
    assert ben.delete(f"{EVENTS}{event['id']}/").status_code == 403
    assert PersonalEvent.objects.get(pk=event['id']).title == 'Grillabend'


def test_editor_can_edit_shared_events_but_never_private_ones(w):
    _share(w, 'EDITOR')
    shared = _event(w, 'Grillabend', [w['ben'].pk]).json()
    private = _event(w, 'Arzttermin').json()
    ben = _client(w['ben'])
    assert ben.patch(f"{EVENTS}{shared['id']}/", {'title': 'Grillabend 19 Uhr'}, format='json').status_code == 200
    assert ben.patch(f"{EVENTS}{private['id']}/", {'title': 'Weg'}, format='json').status_code == 404
    assert ben.delete(f"{EVENTS}{private['id']}/").status_code == 404
    assert PersonalEvent.objects.get(pk=private['id']).title == 'Arzttermin'


def test_owner_changes_the_role(w):
    _share(w, 'VIEWER')
    event = _event(w, 'Grillabend', [w['ben'].pk]).json()
    r = _client(w['anna']).patch(f"{SHARES}given/{w['ben'].pk}/", {'role': 'EDITOR'}, format='json')
    assert r.status_code == 200
    assert r.json()['given'] == [{'user_id': w['ben'].pk, 'name': 'Ben', 'role': 'EDITOR'}]
    assert _client(w['ben']).patch(f"{EVENTS}{event['id']}/", {'title': 'Neu'}, format='json').status_code == 200
    assert _client(w['anna']).patch(f"{SHARES}given/{w['ben'].pk}/", {'role': 'OWNER'}, format='json').status_code == 400


# --------------------------------------------------------------------------- Beenden


def test_owner_ending_a_share_hides_events_at_once(w):
    _share(w)
    _event(w, 'Grillabend', [w['ben'].pk])
    assert _client(w['anna']).delete(f"{SHARES}given/{w['ben'].pk}/").status_code == 204
    assert _titles(w['ben']) == []
    assert not EventShare.objects.exists() and not CalendarShare.objects.exists()


def test_grantee_can_stop_seeing_a_calendar(w):
    _share(w)
    _event(w, 'Grillabend', [w['ben'].pk])
    assert _client(w['ben']).delete(f"{SHARES}received/{w['anna'].pk}/").status_code == 204
    assert _titles(w['ben']) == []


def test_foreign_shares_cannot_be_touched(w):
    _share(w)
    dora = _client(w['dora'])
    assert dora.delete(f"{SHARES}given/{w['ben'].pk}/").status_code == 404
    assert dora.delete(f"{SHARES}received/{w['anna'].pk}/").status_code == 404
    assert dora.patch(f"{SHARES}given/{w['ben'].pk}/", {'role': 'EDITOR'}, format='json').status_code == 404
    assert CalendarShare.objects.count() == 1


def test_share_overview_lists_both_directions_without_emails(w):
    _share(w)
    _invite(w, 'EDITOR', 'clara')
    anna = _client(w['anna']).get(SHARES).json()
    assert anna['owner_id'] == w['anna'].pk
    assert anna['given'] == [{'user_id': w['ben'].pk, 'name': 'Ben', 'role': 'VIEWER'}]
    assert [p['name'] for p in anna['pending']] == ['Clara']
    ben = _client(w['ben']).get(SHARES).json()
    assert ben['received'] == [{'user_id': w['anna'].pk, 'name': 'Anna', 'role': 'VIEWER'}]
    assert '@' not in str(anna) + str(ben)


# --------------------------------------------------------------------------- Heute und Kontakte


def test_today_shows_shared_but_never_private_events(w):
    _share(w)
    _event(w, 'Anna privat')
    _event(w, 'Anna geteilt', [w['ben'].pk])
    today = _client(w['ben']).get('/api/v1/organisation/today/').json()
    titles = [i['title'] for i in today['items']]
    assert 'Anna geteilt' in titles and 'Anna privat' not in titles


def test_contacts_show_calendar_shares_in_both_directions(w):
    _share(w)
    rows = {c['name']: c for c in _client(w['anna']).get('/api/v1/contacts/').json()['contacts']}
    assert {'kind': 'MY_CALENDAR', 'id': w['anna'].pk, 'title': 'Dein Kalender'} in rows['Ben']['shared']
    assert any(a['kind'] == 'MY_CALENDAR' for a in rows['Clara']['can_add_to'])
    ben_rows = {c['name']: c for c in _client(w['ben']).get('/api/v1/contacts/').json()['contacts']}
    assert {'kind': 'MY_CALENDAR', 'id': w['anna'].pk, 'title': 'Kalender von Anna'} in ben_rows['Anna']['shared']
