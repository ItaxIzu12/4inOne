"""Invitation System V1 — Personas Sophie (Haushalt + Reisen), Alex (Haushalt), Ben (Reise), Eve (fremd).

Prüft Fachablauf und Sicherheitsgrenzen: keine Rechte vor dem Annehmen, nur der eingeladene Bereich danach,
IDOR/BOLA, Mass Assignment, Rollen-Eskalation, Doppelklick/Rennen, gelöschte Bereiche und Konten, und dass
Haushalt/Reise keine anderen Bereiche öffnen (Finanzen, Organisation, Verbindungen, Vorschläge, Startseite)."""

import json
import threading
from datetime import timedelta
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError, connection, transaction
from django.utils import timezone
from rest_framework.test import APIClient

from connections.models import Connection
from core import invitations
from core.models import Contact, Household, HouseholdMembership, Invitation, Notification
from finanzen.models import Account, Category, MonthlyBudget, SavingsGoal, Transaction
from haushalt.models import FolderEntry, ShoppingList
from haushalt.models import Task as HouseholdTask
from organisation.models import PersonalNote
from reisen.models import Trip, TripParticipant

pytestmark = pytest.mark.django_db
URL = '/api/v1/invitations/'


def make_user(name):
    user = get_user_model().objects.create_user(
        username=f'{name.lower()}@example.com', email=f'{name.lower()}@example.com', password='irrelevant-1A', first_name=name
    )
    home = Household.objects.create(name=f'Zuhause von {name}')
    HouseholdMembership.objects.create(user=user, household=home, role=HouseholdMembership.Role.ADMIN)
    return user


def client_for(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def connect(a, b):
    Contact.objects.create(owner=a, other=b)
    return Contact.objects.create(owner=b, other=a)


def contact_of(owner, other):
    return Contact.objects.get(owner=owner, other=other).pk


@pytest.fixture
def world():
    sophie, alex, ben, eve = (make_user(n) for n in ('Sophie', 'Alex', 'Ben', 'Eve'))
    home = sophie.households.get()
    home.name = 'Unser Zuhause'
    home.save()
    connect(sophie, alex)
    connect(sophie, ben)
    connect(eve, alex)
    today = timezone.localdate()
    berlin = Trip.objects.create(owner=sophie, title='Berlin', destination='Berlin',
                                 start_date=today + timedelta(days=30), end_date=today + timedelta(days=34))
    secret_trip = Trip.objects.create(owner=sophie, title='Geheimreise', destination='Rom',
                                      start_date=today + timedelta(days=60), end_date=today + timedelta(days=62))
    # Sophies Haushaltsdaten (dürfen Mitglieder sehen) …
    device = FolderEntry.objects.create(household=home, kind='geraet', name='Waschmaschine', created_by=sophie)
    HouseholdTask.objects.create(household=home, title='Müll rausbringen', created_by=sophie)
    ShoppingList.objects.create(household=home, name='Wocheneinkauf')
    # … und Sophies private Daten (dürfen sie nie sehen)
    goal = SavingsGoal.objects.create(owner=sophie, title='GEHEIM-Sparziel', target_amount=Decimal('900'),
                                      current_amount=Decimal('10'))
    category = Category.objects.create(owner=sophie, name='Privat')
    Transaction.objects.create(owner=sophie, category=category, amount=Decimal('42'), description='GEHEIM-Ausgabe',
                               created_by=sophie, updated_by=sophie)
    MonthlyBudget.objects.create(owner=sophie, month=today.replace(day=1), amount=Decimal('1234'))
    PersonalNote.objects.create(owner=sophie, title='GEHEIM-Notiz', body='privat')
    Account.objects.create(household=home, name='GEHEIM-Haushaltskonto')
    Connection.objects.create(source_type='DEVICE', source_id=device.pk, target_type='SAVINGS_GOAL', target_id=goal.pk,
                              relation_type='FUNDED_BY', created_by=sophie)
    return dict(sophie=sophie, alex=alex, ben=ben, eve=eve, home=home, berlin=berlin, secret_trip=secret_trip,
                device=device, goal=goal)


def invite(inviter, invitee, scope_type, scope_id, **extra):
    return client_for(inviter).post(
        URL, {'contact_id': contact_of(inviter, invitee), 'scope_type': scope_type, 'scope_id': scope_id, **extra},
        format='json',
    )


def invite_to_home(w):
    response = invite(w['sophie'], w['alex'], 'HOUSEHOLD', w['home'].pk)
    assert response.status_code == 201, response.data
    return response.data['id']


def invite_to_berlin(w):
    response = invite(w['sophie'], w['ben'], 'TRIP', w['berlin'].pk, role='EDITOR')
    assert response.status_code == 201, response.data
    return response.data['id']


def dump(response) -> str:
    return json.dumps(response.data, default=str, ensure_ascii=False)


# --------------------------------------------------------------------------- Happy Paths


def test_household_happy_path_shares_only_the_household(world):
    w = world
    alex = client_for(w['alex'])
    invitation_id = invite_to_home(w)

    # offen: Alex ist noch kein Mitglied und sieht nichts aus Sophies Haushalt
    assert not HouseholdMembership.objects.filter(user=w['alex'], household=w['home']).exists()
    assert 'Waschmaschine' not in dump(alex.get('/api/v1/haushalt/ordner/'))

    # Benachrichtigung ohne technische Details oder E-Mail
    notes = alex.get('/api/v1/notifications/').data
    assert notes['unread'] == 1
    item = notes['items'][0]['invitation']
    assert item['scope'] == {'type': 'HOUSEHOLD', 'id': w['home'].pk, 'display_name': 'Unser Zuhause', 'detail': 'Haushalt'}
    assert item['inviter'] == {'display_name': 'Sophie'} and item['role_label'] == 'Mitglied'
    assert 'sophie@example.com' not in dump(alex.get('/api/v1/notifications/'))

    # gelesen ≠ angenommen
    assert alex.post('/api/v1/notifications/read/').status_code == 204
    assert Invitation.objects.get(pk=invitation_id).status == 'PENDING'

    accepted = alex.post(f'{URL}{invitation_id}/accept/')
    assert accepted.status_code == 200 and accepted.data['status'] == 'ACCEPTED'
    assert HouseholdMembership.objects.get(user=w['alex'], household=w['home']).role == 'MEMBER'
    assert alex.get('/api/v1/notifications/').data == {'unread': 0, 'items': []}

    # Haushalt ist jetzt Alex' aktiver Haushalt: Geräte, Aufgaben, Einkauf sichtbar
    assert 'Waschmaschine' in dump(alex.get('/api/v1/haushalt/ordner/'))
    assert 'Müll rausbringen' in dump(alex.get('/api/v1/haushalt/aufgaben/'))
    assert 'Wocheneinkauf' in dump(alex.get('/api/v1/haushalt/einkauf/listen/'))
    assert alex.get('/api/v1/household/members/').data['household']['name'] == 'Unser Zuhause'

    # … aber nichts Privates von Sophie, in keinem Bereich
    leaks = [
        '/api/v1/finanzen/private/transactions/', '/api/v1/finanzen/private/goals/', '/api/v1/finanzen/private/budgets/',
        '/api/v1/finanzen/private/summary/', '/api/v1/finanzen/transaktionen/', '/api/v1/finanzen/uebersicht/',
        '/api/v1/organisation/notes/', '/api/v1/reisen/trips/', '/api/v1/today/',
        '/api/v1/connections/link-suggestions/', '/api/v1/connections/suggestions/',
        f'/api/v1/connections/?object_type=DEVICE&object_id={w["device"].pk}',
    ]
    for url in leaks:
        body = dump(alex.get(url))
        for secret in ('GEHEIM', 'Geheimreise', '1234'):
            assert secret not in body, (url, secret)
    assert alex.get(f'/api/v1/finanzen/private/goals/{w["goal"].pk}/').status_code == 404
    assert alex.get(f'/api/v1/reisen/trips/{w["berlin"].pk}/').status_code == 404  # Haushalt öffnet keine Reisen
    # Sophies Gerät ist mit ihrem privaten Sparziel verbunden — für Alex existiert diese Verbindung nicht
    device_links = alex.get(f'/api/v1/connections/?object_type=DEVICE&object_id={w["device"].pk}')
    assert 'SAVINGS_GOAL' not in dump(device_links)


def test_trip_happy_path_shares_only_this_trip(world):
    w = world
    ben = client_for(w['ben'])
    invitation_id = invite_to_berlin(w)
    assert ben.get(f'/api/v1/reisen/trips/{w["berlin"].pk}/').status_code == 404  # offen: noch kein Zugriff

    payload = ben.get(URL).data['received'][0]
    assert payload['scope']['display_name'] == 'Berlin' and payload['role_label'] == 'Kann bearbeiten'
    assert ben.post(f'{URL}{invitation_id}/accept/').status_code == 200
    assert TripParticipant.objects.get(trip=w['berlin'], user=w['ben']).role == 'EDITOR'

    titles = [t['title'] for t in ben.get('/api/v1/reisen/trips/').data['results']] if isinstance(
        ben.get('/api/v1/reisen/trips/').data, dict) else [t['title'] for t in ben.get('/api/v1/reisen/trips/').data]
    assert titles == ['Berlin']
    assert ben.get(f'/api/v1/reisen/trips/{w["secret_trip"].pk}/').status_code == 404
    assert 'Waschmaschine' not in dump(ben.get('/api/v1/haushalt/ordner/'))
    for url in ('/api/v1/finanzen/private/goals/', '/api/v1/finanzen/private/transactions/', '/api/v1/organisation/notes/'):
        assert 'GEHEIM' not in dump(ben.get(url))
    # Ben bleibt in seinem eigenen Haushalt
    assert ben.get('/api/v1/household/members/').data['household']['name'] == 'Zuhause von Ben'


# --------------------------------------------------------------------------- Ablehnen, Zurückziehen, Duplikate


def test_decline_creates_no_membership(world):
    invitation_id = invite_to_home(world)
    assert client_for(world['alex']).post(f'{URL}{invitation_id}/decline/').status_code == 204
    assert Invitation.objects.get(pk=invitation_id).status == 'DECLINED'
    assert Invitation.objects.get(pk=invitation_id).responded_at is not None
    assert not HouseholdMembership.objects.filter(user=world['alex'], household=world['home']).exists()
    # abgelehnt bleibt abgelehnt
    assert client_for(world['alex']).post(f'{URL}{invitation_id}/accept/').status_code == 400


def test_revoked_invitation_cannot_be_accepted(world):
    invitation_id = invite_to_home(world)
    assert client_for(world['sophie']).post(f'{URL}{invitation_id}/revoke/').status_code == 204
    assert client_for(world['alex']).post(f'{URL}{invitation_id}/accept/').status_code == 400
    assert not HouseholdMembership.objects.filter(user=world['alex'], household=world['home']).exists()
    assert client_for(world['alex']).get('/api/v1/notifications/').data['items'] == []


def test_only_the_inviter_can_revoke(world):
    invitation_id = invite_to_home(world)
    assert client_for(world['alex']).post(f'{URL}{invitation_id}/revoke/').status_code == 404
    assert client_for(world['eve']).post(f'{URL}{invitation_id}/revoke/').status_code == 404


def test_duplicate_invitation_reuses_the_open_one(world):
    first = invite(world['sophie'], world['alex'], 'HOUSEHOLD', world['home'].pk)
    second = invite(world['sophie'], world['alex'], 'HOUSEHOLD', world['home'].pk)
    assert first.status_code == 201 and second.status_code == 200 and first.data['id'] == second.data['id']
    assert Invitation.objects.count() == 1 and Notification.objects.count() == 1


def test_already_member_cannot_be_invited_again(world):
    accept_id = invite_to_home(world)
    client_for(world['alex']).post(f'{URL}{accept_id}/accept/')
    again = invite(world['sophie'], world['alex'], 'HOUSEHOLD', world['home'].pk)
    assert again.status_code == 400 and 'bereits dabei' in str(again.data)
    assert Invitation.objects.count() == 1


def test_self_and_strangers_cannot_be_invited(world):
    w = world
    # Sophie hat keinen Kontakt zu sich selbst und keinen zu Eve; eine unbekannte Kontakt-ID hilft nicht
    response = client_for(w['sophie']).post(URL, {'contact_id': 10**9, 'scope_type': 'HOUSEHOLD',
                                                  'scope_id': w['home'].pk}, format='json')
    assert response.status_code == 400
    eve_contact = Contact.objects.get(owner=w['eve'], other=w['alex']).pk  # gehört Eve, nicht Sophie
    response = client_for(w['sophie']).post(URL, {'contact_id': eve_contact, 'scope_type': 'HOUSEHOLD',
                                                  'scope_id': w['home'].pk}, format='json')
    assert response.status_code == 400
    with pytest.raises(IntegrityError), transaction.atomic():
        Invitation.objects.create(inviter=w['sophie'], invitee=w['sophie'], scope_type='HOUSEHOLD',
                                  scope_id=w['home'].pk, role='MEMBER', expires_at=timezone.now())
    assert not Invitation.objects.exists()


# --------------------------------------------------------------------------- IDOR / BOLA / Enumeration


def test_eve_cannot_see_or_answer_alex_invitation(world):
    invitation_id = invite_to_home(world)
    eve = client_for(world['eve'])
    assert eve.get(URL).data == {'received': [], 'sent': [], 'declined': []}
    assert eve.get('/api/v1/notifications/').data == {'unread': 0, 'items': []}
    for action in ('accept', 'decline', 'revoke'):
        response = eve.post(f'{URL}{invitation_id}/{action}/')
        assert response.status_code == 404
        assert response.data == {'detail': invitations.NOT_FOUND}  # dieselbe Antwort wie für nicht existierende IDs
    assert eve.post(f'{URL}{invitation_id + 999}/accept/').data == {'detail': invitations.NOT_FOUND}
    assert eve.post(f'{URL}{2**63}/accept/').status_code == 404
    assert Invitation.objects.get(pk=invitation_id).status == 'PENDING'


def test_inviter_cannot_accept_on_behalf_of_invitee(world):
    invitation_id = invite_to_home(world)
    assert client_for(world['sophie']).post(f'{URL}{invitation_id}/accept/').status_code == 404
    assert Invitation.objects.get(pk=invitation_id).status == 'PENDING'


def test_notifications_ignore_user_parameter(world):
    invite_to_home(world)
    assert client_for(world['eve']).get('/api/v1/notifications/?user_id=%d' % world['alex'].pk).data['items'] == []


def test_unauthenticated_requests_are_rejected(world):
    invitation_id = invite_to_home(world)
    anonymous = APIClient()
    assert anonymous.get(URL).status_code == 401
    assert anonymous.get('/api/v1/notifications/').status_code == 401
    assert anonymous.post(f'{URL}{invitation_id}/accept/').status_code == 401


# --------------------------------------------------------------------------- Mass Assignment / fremde Bereiche / Rollen


def test_mass_assignment_fields_are_ignored(world):
    w = world
    response = client_for(w['sophie']).post(URL, {
        'contact_id': contact_of(w['sophie'], w['alex']), 'scope_type': 'HOUSEHOLD', 'scope_id': w['home'].pk,
        'inviter': w['eve'].pk, 'invitee': w['eve'].pk, 'status': 'ACCEPTED', 'created_by': w['eve'].pk,
    }, format='json')
    assert response.status_code == 201
    invitation = Invitation.objects.get()
    assert (invitation.inviter, invitation.invitee, invitation.status) == (w['sophie'], w['alex'], 'PENDING')
    assert not HouseholdMembership.objects.filter(user=w['alex'], household=w['home']).exists()


def test_foreign_scope_ids_are_rejected_like_missing_ones(world):
    w = world
    eve_home = w['eve'].households.get()
    eve_trip = Trip.objects.create(owner=w['eve'], title='Eves Reise', destination='X',
                                   start_date=timezone.localdate(), end_date=timezone.localdate())
    foreign_home = invite(w['sophie'], w['alex'], 'HOUSEHOLD', eve_home.pk)
    foreign_trip = invite(w['sophie'], w['alex'], 'TRIP', eve_trip.pk)
    missing = invite(w['sophie'], w['alex'], 'TRIP', 10**9)
    assert foreign_home.status_code == foreign_trip.status_code == missing.status_code == 404
    assert foreign_home.data == foreign_trip.data == missing.data
    assert invite(w['sophie'], w['alex'], 'FINANCE', 1).status_code == 400  # Bereich nicht in der Allowlist
    assert not Invitation.objects.exists()


@pytest.mark.parametrize('scope_type,role', [
    ('HOUSEHOLD', 'ADMIN'), ('HOUSEHOLD', 'OWNER'), ('HOUSEHOLD', 'CHILD_ACCOUNT'), ('TRIP', 'OWNER'), ('TRIP', 'ADMIN'),
    ('TRIP', 'superuser'),
])
def test_role_escalation_is_rejected(world, scope_type, role):
    scope_id = world['home'].pk if scope_type == 'HOUSEHOLD' else world['berlin'].pk
    response = invite(world['sophie'], world['alex'], scope_type, scope_id, role=role)
    assert response.status_code == 400 and 'role' in response.data
    assert not Invitation.objects.exists()


def test_members_without_invite_rights_cannot_invite(world):
    w = world
    # Ben ist nur Betrachter der Berlin-Reise und Mitglied (kein Admin) in Sophies Haushalt
    TripParticipant.objects.create(trip=w['berlin'], user=w['ben'], role='VIEWER')
    HouseholdMembership.objects.create(user=w['ben'], household=w['home'], role='MEMBER')
    connect(w['ben'], w['eve'])
    assert invite(w['ben'], w['eve'], 'TRIP', w['berlin'].pk).status_code == 404
    assert invite(w['ben'], w['eve'], 'HOUSEHOLD', w['home'].pk).status_code == 404


def test_direct_participant_creation_is_no_longer_possible(world):
    response = client_for(world['sophie']).post('/api/v1/reisen/participants/', {
        'trip': world['berlin'].pk, 'contact_id': contact_of(world['sophie'], world['ben']), 'role': 'VIEWER',
    }, format='json')
    assert response.status_code == 405
    assert not TripParticipant.objects.filter(user=world['ben']).exists()


# --------------------------------------------------------------------------- Veralteter Zustand


def test_accept_checks_current_permissions_of_the_inviter(world):
    w = world
    TripParticipant.objects.create(trip=w['berlin'], user=w['alex'], role='OWNER')
    connect(w['alex'], w['ben'])
    response = invite(w['alex'], w['ben'], 'TRIP', w['berlin'].pk)
    assert response.status_code == 201
    TripParticipant.objects.filter(trip=w['berlin'], user=w['alex']).update(role='VIEWER')  # Alex verliert das Recht
    assert client_for(w['ben']).post(f'{URL}{response.data["id"]}/accept/').status_code == 400
    assert not TripParticipant.objects.filter(trip=w['berlin'], user=w['ben']).exists()
    assert Invitation.objects.get(pk=response.data['id']).status == 'REVOKED'


def test_deleted_scope_cannot_be_accepted_and_does_not_crash(world):
    invitation_id = invite_to_berlin(world)
    world['berlin'].delete()
    ben = client_for(world['ben'])
    assert ben.get(URL).data['received'] == []
    assert ben.get('/api/v1/notifications/').data['items'] == []
    assert ben.post(f'{URL}{invitation_id}/accept/').status_code == 400
    assert Invitation.objects.get(pk=invitation_id).status == 'REVOKED'


def test_expired_invitation_cannot_be_accepted(world):
    invitation_id = invite_to_home(world)
    Invitation.objects.filter(pk=invitation_id).update(expires_at=timezone.now() - timedelta(seconds=1))
    assert client_for(world['alex']).post(f'{URL}{invitation_id}/accept/').status_code == 400
    assert not HouseholdMembership.objects.filter(user=world['alex'], household=world['home']).exists()


def test_deleted_invitee_removes_the_invitation(world):
    invite_to_home(world)
    world['alex'].delete()
    assert not Invitation.objects.exists() and not Notification.objects.exists()


def test_deleted_inviter_leaves_an_unusable_invitation(world):
    invitation_id = invite_to_berlin(world)
    world['sophie'].delete()  # Reise des Erstellers verschwindet mit
    ben = client_for(world['ben'])
    assert ben.get(URL).data['received'] == []
    assert ben.post(f'{URL}{invitation_id}/accept/').status_code == 400
    assert not TripParticipant.objects.filter(user=world['ben']).exists()


def test_removed_member_needs_a_new_invitation(world):
    w = world
    invitation_id = invite_to_home(w)
    client_for(w['alex']).post(f'{URL}{invitation_id}/accept/')
    membership = HouseholdMembership.objects.get(user=w['alex'], household=w['home'])
    assert client_for(w['sophie']).delete(f'/api/v1/household/members/{membership.pk}/').status_code == 204
    assert client_for(w['alex']).post(f'{URL}{invitation_id}/accept/').status_code == 200  # bleibt „angenommen“ …
    assert not HouseholdMembership.objects.filter(user=w['alex'], household=w['home']).exists()  # … ohne Wirkung
    assert client_for(w['alex']).get('/api/v1/household/members/').data['household']['name'] == 'Zuhause von Alex'
    assert invite(w['sophie'], w['alex'], 'HOUSEHOLD', w['home'].pk).status_code == 201


def test_member_can_leave_a_joined_household_but_not_the_own_one(world):
    w = world
    client_for(w['alex']).post(f'{URL}{invite_to_home(w)}/accept/')
    alex = client_for(w['alex'])
    joined = HouseholdMembership.objects.get(user=w['alex'], household=w['home'])
    assert alex.get('/api/v1/household/members/').data['can_leave'] is True
    # ein normales Mitglied darf andere nicht entfernen
    sophie_membership = HouseholdMembership.objects.get(user=w['sophie'], household=w['home'])
    assert alex.delete(f'/api/v1/household/members/{sophie_membership.pk}/').status_code == 403
    assert alex.delete(f'/api/v1/household/members/{joined.pk}/').status_code == 204
    own = HouseholdMembership.objects.get(user=w['alex'])
    assert alex.get('/api/v1/household/members/').data['can_leave'] is False
    assert alex.delete(f'/api/v1/household/members/{own.pk}/').status_code == 400
    # fremde Mitgliedschaften sind nicht einmal sichtbar
    assert client_for(w['eve']).delete(f'/api/v1/household/members/{sophie_membership.pk}/').status_code == 404


def test_legacy_household_finance_stays_with_the_own_household(world):
    w = world
    client_for(w['alex']).post(f'{URL}{invite_to_home(w)}/accept/')
    alex = client_for(w['alex'])
    for url in ('/api/v1/finanzen/transaktionen/', '/api/v1/finanzen/kategorien/', '/api/v1/finanzen/abzuege/',
                '/api/v1/finanzen/uebersicht/', '/api/v1/finanzen/analysen/'):
        assert 'GEHEIM' not in dump(alex.get(url)), url


# --------------------------------------------------------------------------- Rennen


def test_double_accept_creates_one_membership(world):
    invitation_id = invite_to_home(world)
    alex = client_for(world['alex'])
    first = alex.post(f'{URL}{invitation_id}/accept/')
    second = alex.post(f'{URL}{invitation_id}/accept/')
    assert first.status_code == second.status_code == 200
    assert HouseholdMembership.objects.filter(user=world['alex'], household=world['home']).count() == 1


def test_accept_after_decline_keeps_the_first_final_state(world):
    invitation_id = invite_to_home(world)
    alex = client_for(world['alex'])
    assert alex.post(f'{URL}{invitation_id}/decline/').status_code == 204
    assert alex.post(f'{URL}{invitation_id}/accept/').status_code == 400
    assert alex.post(f'{URL}{invitation_id}/decline/').status_code == 400
    assert Invitation.objects.get(pk=invitation_id).status == 'DECLINED'


@pytest.mark.django_db(transaction=True)
def test_concurrent_accept_and_decline_end_in_one_state():
    sophie, alex = make_user('Sophie'), make_user('Alex')
    connect(sophie, alex)
    home = sophie.households.get()
    invitation, _ = invitations.create(sophie, contact_id=contact_of(sophie, alex), scope_type='HOUSEHOLD', scope_id=home.pk)
    results = []

    def run(fn):
        try:
            fn(alex, invitation.pk)
            results.append(fn.__name__)
        except invitations.InvitationError:
            results.append('rejected')
        except Exception:  # SQLite: „database is locked“ — die Anfrage scheitert, ohne Zustand zu verändern
            results.append('busy')
        finally:
            connection.close()

    threads = [threading.Thread(target=run, args=(f,)) for f in (invitations.accept, invitations.decline, invitations.accept)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    final = Invitation.objects.get(pk=invitation.pk).status
    members = HouseholdMembership.objects.filter(user=alex, household=home).count()
    assert final in ('ACCEPTED', 'DECLINED')
    assert members == (1 if final == 'ACCEPTED' else 0)


# --------------------------------------------------------------------------- Personen & Gruppen


def test_contacts_overview_lists_invite_targets_and_open_invitations(world):
    w = world
    row = next(c for c in client_for(w['sophie']).get('/api/v1/contacts/').data['contacts'] if c['name'] == 'Alex')
    kinds = {(a['kind'], a['title']) for a in row['can_add_to']}
    assert ('HOUSEHOLD', 'Unser Zuhause') in kinds and ('TRIP', 'Berlin') in kinds
    invitation_id = invite_to_home(w)
    row = next(c for c in client_for(w['sophie']).get('/api/v1/contacts/').data['contacts'] if c['name'] == 'Alex')
    assert row['invited_to'] == [{'kind': 'HOUSEHOLD', 'id': w['home'].pk, 'title': 'Unser Zuhause', 'invitation_id': invitation_id}]
    assert ('HOUSEHOLD', 'Unser Zuhause') not in {(a['kind'], a['title']) for a in row['can_add_to']}
    sent = client_for(w['sophie']).get(URL).data['sent'][0]
    assert sent['invitee'] == {'display_name': 'Alex'} and 'inviter' not in sent


# --------------------------------------------------------------------------- Rückmeldung an die einladende Person


def test_inviter_hears_about_acceptance_but_not_about_declines(world):
    w = world
    sophie = client_for(w['sophie'])
    client_for(w['alex']).post(f'{URL}{invite_to_home(w)}/accept/')
    items = sophie.get('/api/v1/notifications/').data['items']
    assert len(items) == 1 and items[0]['kind'] == 'INVITATION_ACCEPTED' and items[0]['read'] is False
    assert items[0]['accepted'] == {'name': 'Alex', 'scope': {'type': 'HOUSEHOLD', 'id': w['home'].pk, 'display_name': 'Unser Zuhause'}}
    assert client_for(w['eve']).get('/api/v1/notifications/').data['items'] == []

    # Ablehnung: keine Meldung, nur still „nicht angenommen“ in der Liste
    client_for(w['ben']).post(f'{URL}{invite_to_berlin(w)}/decline/')
    kinds = [i['kind'] for i in sophie.get('/api/v1/notifications/').data['items']]
    assert kinds == ['INVITATION_ACCEPTED']
    declined = sophie.get(URL).data['declined']
    assert [(d['scope']['display_name'], d['invitee']['display_name'], d['status']) for d in declined] == [('Berlin', 'Ben', 'DECLINED')]
    assert client_for(w['eve']).get(URL).data['declined'] == []


def test_double_accept_sends_one_success_message(world):
    invitation_id = invite_to_home(world)
    alex = client_for(world['alex'])
    alex.post(f'{URL}{invitation_id}/accept/')
    alex.post(f'{URL}{invitation_id}/accept/')
    assert Notification.objects.filter(user=world['sophie'], kind='INVITATION_ACCEPTED').count() == 1
