"""Gemeinsame Kalender (31.10.2026): teilen, ohne dass Privates durchsickert.

Anna besitzt den Kalender „Familie“. Ben ist Kontakt von Anna und wird eingeladen (je nach Test als VIEWER oder
EDITOR). Clara ist Kontakt, aber nicht eingeladen. Dora ist völlig fremd."""

from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from connections.models import Connection
from core.models import Contact, Invitation
from organisation.models import CalendarMember, PersonalEvent, SharedCalendar

pytestmark = pytest.mark.django_db

CAL = '/api/v1/organisation/calendars/'
EVENTS = '/api/v1/organisation/events/'
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
    tomorrow = timezone.now() + timedelta(days=1)
    private = PersonalEvent.objects.create(owner=anna, title='Arzttermin Anna', starts_at=tomorrow)
    ben_private = PersonalEvent.objects.create(owner=ben, title='Bens Geheimnis', starts_at=tomorrow)
    calendar_id = _client(anna).post(CAL, {'name': 'Familie', 'color': 'green'}, format='json').json()['id']
    return {'anna': anna, 'ben': ben, 'clara': clara, 'dora': dora, 'private': private, 'ben_private': ben_private,
            'cal': calendar_id, 'tomorrow': tomorrow}


def _invite_and_accept(w, role='EDITOR', who='ben'):
    contact = Contact.objects.get(owner=w['anna'], other=w[who]).pk
    r = _client(w['anna']).post(INV, {'contact_id': contact, 'scope_type': 'CALENDAR', 'scope_id': w['cal'], 'role': role}, format='json')
    assert r.status_code == 201, r.content
    r = _client(w[who]).post(f"{INV}{r.json()['id']}/accept/")
    assert r.status_code == 200, r.content


def _shared_event(w, by='anna', title='Abendessen bei Oma'):
    r = _client(w[by]).post(EVENTS, {'title': title, 'starts_at': w['tomorrow'].isoformat(), 'calendar': w['cal']}, format='json')
    assert r.status_code == 201, r.content
    return r.json()


def _titles(user, ranged=False):
    if ranged:
        day = timezone.localdate()
        url = f'{EVENTS}?start={day}&end={day + timedelta(days=3)}'
    else:
        url = EVENTS
    return sorted(e['title'] for e in _client(user).get(url).json())


# --------------------------------------------------------------------------- Anlegen und Sehen


def test_creating_a_calendar_makes_me_owner_and_nobody_else_sees_it(w):
    r = _client(w['anna']).get(CAL).json()
    assert [(c['name'], c['role'], c['is_owner']) for c in r] == [('Familie', 'OWNER', True)]
    assert [m['name'] for m in r[0]['members']] == ['Anna']
    assert 'email' not in str(r[0]['members'])
    for other in ('ben', 'clara', 'dora'):
        assert _client(w[other]).get(CAL).json() == []
        # Fremder Kalender: nicht von „gibt es nicht“ zu unterscheiden
        assert _client(w[other]).patch(f"{CAL}{w['cal']}/", {'name': 'x'}, format='json').status_code == 404


def test_an_open_invitation_grants_nothing_accepting_shows_only_the_shared_events(w):
    _shared_event(w)
    contact = Contact.objects.get(owner=w['anna'], other=w['ben']).pk
    _client(w['anna']).post(INV, {'contact_id': contact, 'scope_type': 'CALENDAR', 'scope_id': w['cal'], 'role': 'VIEWER'}, format='json')
    assert 'Abendessen bei Oma' not in _titles(w['ben'])  # offen = kein Zugriff
    pending = _client(w['anna']).get(CAL).json()[0]['pending']
    assert [p['name'] for p in pending] == ['Ben']

    invitation = Invitation.objects.get(invitee=w['ben'], scope_type='CALENDAR')
    assert _client(w['ben']).post(f'{INV}{invitation.pk}/accept/').status_code == 200
    ben_sees = _titles(w['ben'])
    assert 'Abendessen bei Oma' in ben_sees and 'Bens Geheimnis' in ben_sees
    assert 'Arzttermin Anna' not in ben_sees  # Annas privater Termin bleibt privat
    assert 'Arzttermin Anna' not in _titles(w['ben'], ranged=True)
    anna_sees = _titles(w['anna'], ranged=True)
    assert 'Bens Geheimnis' not in anna_sees and 'Abendessen bei Oma' in anna_sees
    # Wer nicht eingeladen ist, sieht nichts
    for other in ('clara', 'dora'):
        assert 'Abendessen bei Oma' not in _titles(w[other], ranged=True)


def test_shared_event_carries_calendar_name_and_who_entered_it_but_never_an_email(w):
    _invite_and_accept(w, 'EDITOR')
    _shared_event(w, by='ben', title='Kino')
    event = next(e for e in _client(w['anna']).get(EVENTS).json() if e['title'] == 'Kino')
    assert event['calendar_name'] == 'Familie' and event['calendar_color'] == 'green'
    assert event['created_by'] == 'Ben' and event['can_edit'] is True
    assert '@' not in str(event)
    mine = next(e for e in _client(w['ben']).get(EVENTS).json() if e['title'] == 'Kino')
    assert mine['created_by'] == ''


# --------------------------------------------------------------------------- Rollen


def test_viewer_can_see_but_not_create_change_or_delete(w):
    _invite_and_accept(w, 'VIEWER')
    event = _shared_event(w)
    ben = _client(w['ben'])
    r = ben.post(EVENTS, {'title': 'Versuch', 'starts_at': w['tomorrow'].isoformat(), 'calendar': w['cal']}, format='json')
    assert r.status_code == 403
    assert ben.patch(f"{EVENTS}{event['id']}/", {'title': 'Geändert'}, format='json').status_code == 403
    assert ben.delete(f"{EVENTS}{event['id']}/").status_code == 403
    assert PersonalEvent.objects.get(pk=event['id']).title == 'Abendessen bei Oma'
    assert next(e for e in ben.get(EVENTS).json() if e['id'] == event['id'])['can_edit'] is False


def test_editor_can_create_change_and_delete_shared_events(w):
    _invite_and_accept(w, 'EDITOR')
    event = _shared_event(w)
    ben = _client(w['ben'])
    assert ben.patch(f"{EVENTS}{event['id']}/", {'title': 'Essen bei Oma'}, format='json').status_code == 200
    assert ben.delete(f"{EVENTS}{event['id']}/").status_code == 204


def test_only_the_creator_may_move_an_event_out_of_the_calendar(w):
    _invite_and_accept(w, 'EDITOR')
    event = _shared_event(w)  # von Anna
    ben = _client(w['ben'])
    r = ben.patch(f"{EVENTS}{event['id']}/", {'calendar': None}, format='json')
    assert r.status_code == 403
    assert PersonalEvent.objects.get(pk=event['id']).calendar_id == w['cal']
    # Anna (Erstellerin) darf ihn wieder privat machen — dann sieht Ben ihn nicht mehr
    assert _client(w['anna']).patch(f"{EVENTS}{event['id']}/", {'calendar': None}, format='json').status_code == 200
    assert 'Abendessen bei Oma' not in _titles(w['ben'])


def test_foreign_calendar_ids_are_indistinguishable_from_missing_ones(w):
    dora = _client(w['dora'])
    for calendar in (w['cal'], 999999):
        r = dora.post(EVENTS, {'title': 'x', 'starts_at': w['tomorrow'].isoformat(), 'calendar': calendar}, format='json')
        assert r.status_code == 404
        assert dora.patch(f'{CAL}{calendar}/', {'name': 'Hack'}, format='json').status_code == 404
        assert dora.delete(f'{CAL}{calendar}/').status_code == 404
    event = _shared_event(w)
    assert dora.get(f"{EVENTS}{event['id']}/").status_code == 404
    assert dora.delete(f"{EVENTS}{event['id']}/").status_code == 404
    assert SharedCalendar.objects.get(pk=w['cal']).name == 'Familie'


def test_only_the_owner_invites_manages_and_deletes(w):
    _invite_and_accept(w, 'EDITOR')
    ben = _client(w['ben'])
    _contacts(w['ben'], w['dora'])
    contact = Contact.objects.get(owner=w['ben'], other=w['dora']).pk
    r = ben.post(INV, {'contact_id': contact, 'scope_type': 'CALENDAR', 'scope_id': w['cal']}, format='json')
    assert r.status_code in (400, 403, 404)
    assert not Invitation.objects.filter(invitee=w['dora']).exists()
    assert ben.patch(f"{CAL}{w['cal']}/", {'name': 'Bens'}, format='json').status_code == 403
    assert ben.delete(f"{CAL}{w['cal']}/").status_code == 403
    assert ben.patch(f"{CAL}{w['cal']}/members/{w['anna'].pk}/", {'role': 'VIEWER'}, format='json').status_code == 403
    # Rolle ändern durch Besitzerin
    r = _client(w['anna']).patch(f"{CAL}{w['cal']}/members/{w['ben'].pk}/", {'role': 'VIEWER'}, format='json')
    assert r.status_code == 200
    assert CalendarMember.objects.get(calendar_id=w['cal'], user=w['ben']).role == 'VIEWER'


# --------------------------------------------------------------------------- Austreten, Entfernen, Löschen


def test_leaving_or_being_removed_hides_the_calendar_immediately(w):
    _invite_and_accept(w, 'EDITOR')
    _shared_event(w)
    assert _client(w['ben']).delete(f"{CAL}{w['cal']}/members/{w['ben'].pk}/").status_code == 204
    assert 'Abendessen bei Oma' not in _titles(w['ben'], ranged=True)
    assert _client(w['ben']).get(CAL).json() == []
    _invite_and_accept(w, 'EDITOR')
    assert _client(w['anna']).delete(f"{CAL}{w['cal']}/members/{w['ben'].pk}/").status_code == 204
    assert 'Abendessen bei Oma' not in _titles(w['ben'], ranged=True)
    # Besitzerin kann nicht austreten
    assert _client(w['anna']).delete(f"{CAL}{w['cal']}/members/{w['anna'].pk}/").status_code == 400


def test_deleting_the_calendar_returns_events_to_their_creators_privately_and_revokes_invitations(w):
    _invite_and_accept(w, 'EDITOR')
    _shared_event(w, by='anna', title='Von Anna')
    _shared_event(w, by='ben', title='Von Ben')
    contact = Contact.objects.get(owner=w['anna'], other=w['clara']).pk
    _client(w['anna']).post(INV, {'contact_id': contact, 'scope_type': 'CALENDAR', 'scope_id': w['cal']}, format='json')
    assert _client(w['anna']).delete(f"{CAL}{w['cal']}/").status_code == 204
    assert 'Von Ben' not in _titles(w['anna']) and 'Von Anna' in _titles(w['anna'])
    assert 'Von Anna' not in _titles(w['ben']) and 'Von Ben' in _titles(w['ben'])
    assert Invitation.objects.get(invitee=w['clara']).status == Invitation.Status.REVOKED
    assert PersonalEvent.objects.filter(title__in=['Von Anna', 'Von Ben'], calendar__isnull=True).count() == 2


def test_deleting_the_owner_account_keeps_members_events_private(w):
    _invite_and_accept(w, 'EDITOR')
    _shared_event(w, by='ben', title='Von Ben')
    w['anna'].delete()
    assert 'Von Ben' in _titles(w['ben'])
    assert not SharedCalendar.objects.exists()


# --------------------------------------------------------------------------- Nichts sickert durch


def test_today_and_summary_show_shared_events_but_never_someone_elses_private_ones(w):
    _invite_and_accept(w, 'VIEWER')
    PersonalEvent.objects.create(owner=w['anna'], title='Anna heute privat', starts_at=timezone.now() + timedelta(minutes=5))
    PersonalEvent.objects.create(owner=w['anna'], title='Anna heute gemeinsam', starts_at=timezone.now() + timedelta(minutes=5),
                                 calendar_id=w['cal'])
    today = _client(w['ben']).get('/api/v1/organisation/today/').json()
    titles = [i['title'] for i in today['items']]
    assert 'Anna heute gemeinsam' in titles and 'Anna heute privat' not in titles


def test_a_shared_event_of_someone_else_cannot_be_linked_or_used_in_connections(w):
    _invite_and_accept(w, 'EDITOR')
    event = _shared_event(w)  # gehört Anna
    note_target = PersonalEvent.objects.create(owner=w['ben'], title='Ben eigener', starts_at=w['tomorrow'])
    r = _client(w['ben']).post('/api/v1/connections/', {
        'source_type': 'CALENDAR_EVENT', 'source_id': event['id'], 'target_type': 'TASK', 'target_id': 1}, format='json')
    assert r.status_code == 404
    assert not Connection.objects.exists()
    assert note_target.pk  # eigener Termin bleibt normal verknüpfbar (Regel unverändert)


def test_contacts_show_shared_calendars_and_offer_only_own_calendars_to_invite(w):
    _invite_and_accept(w, 'VIEWER')
    rows = {c['name']: c for c in _client(w['anna']).get('/api/v1/contacts/').json()['contacts']}
    assert {'kind': 'CALENDAR', 'id': w['cal'], 'title': 'Familie'} in rows['Ben']['shared']
    assert any(a['kind'] == 'CALENDAR' for a in rows['Clara']['can_add_to'])
    ben_rows = {c['name']: c for c in _client(w['ben']).get('/api/v1/contacts/').json()['contacts']}
    assert not any(a['kind'] == 'CALENDAR' for a in ben_rows['Anna']['can_add_to'])


def test_creating_too_many_calendars_and_invalid_input_are_rejected(w):
    anna = _client(w['anna'])
    assert anna.post(CAL, {'name': '   '}, format='json').status_code == 400
    assert anna.post(CAL, {'name': 'x', 'color': '#ff0000'}, format='json').status_code == 400
    for i in range(19):
        assert anna.post(CAL, {'name': f'K{i}'}, format='json').status_code == 201
    assert anna.post(CAL, {'name': 'Zu viel'}, format='json').status_code == 400
