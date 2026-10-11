"""Regressionen: Postfachnachweis, Reset-Widerruf, Rollen und private Dateien."""
import pytest
from allauth.account.models import EmailAddress
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.files.storage import FileSystemStorage
from django.db import transaction
from django.test import Client
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import Contact, ContactInvite, Household, HouseholdMembership, Invitation, PasswordResetToken, UserSession
from organisation.models import PersonalFile

pytestmark = pytest.mark.django_db
PASSWORD = 'SecureAudit123!'


def user(email):
    return get_user_model().objects.create_user(username=email, email=email, password=PASSWORD)


def client_for(person):
    client = APIClient()
    client.force_authenticate(person)
    return client


def invitation(sender, recipient, token='secret-mailbox-link'):
    return ContactInvite.objects.create(
        inviter=sender, email=recipient.email, token=token,
        expires_at=timezone.now() + timezone.timedelta(days=1),
    )


def test_claiming_an_email_does_not_reveal_pending_invitation_tokens():
    sender, claimed = user('sender@example.com'), user('claimed@example.com')
    invitation(sender, claimed)
    response = client_for(claimed).get('/api/v1/contacts/')
    assert response.status_code == 200
    assert response.data['received'] == []
    assert client_for(sender).get('/api/v1/contacts/').data['sent'][0].keys() == {'id', 'email', 'relation', 'expires_at', 'created_at'}
    assert client_for(claimed).get('/api/v1/contacts/invites/guessed-link/').status_code == 404


def test_mail_link_acceptance_proves_address_and_does_not_share_other_data():
    sender, recipient, stranger = user('sender@example.com'), user('recipient@example.com'), user('stranger@example.com')
    first = invitation(sender, recipient)
    c = client_for(recipient)
    assert client_for(stranger).post(f'/api/v1/contacts/invites/{first.token}/accept/').status_code == 404
    assert c.post(f'/api/v1/contacts/invites/{first.token}/accept/').status_code == 201
    assert EmailAddress.objects.get(user=recipient, email=recipient.email).verified
    assert Contact.objects.count() == 2
    assert c.post(f'/api/v1/contacts/invites/{first.token}/accept/').status_code == 404
    next_invite = invitation(stranger, recipient, 'another-mail-link')
    assert c.get('/api/v1/contacts/').data['received'][0]['token'] == next_invite.token


def test_expired_mail_link_cannot_verify_an_address():
    sender, recipient = user('sender@example.com'), user('recipient@example.com')
    expired = invitation(sender, recipient)
    expired.expires_at = timezone.now() - timezone.timedelta(seconds=1)
    expired.save()
    assert client_for(recipient).post(f'/api/v1/contacts/invites/{expired.token}/accept/').status_code == 404
    assert not EmailAddress.objects.filter(user=recipient, verified=True).exists()


def test_migration_invalidates_pre_fix_links_but_keeps_contacts_and_consumed_invites():
    from importlib import import_module
    from types import SimpleNamespace
    from django.apps import apps
    sender, recipient = user('sender@example.com'), user('recipient@example.com')
    pending = invitation(sender, recipient)
    consumed = invitation(sender, recipient, 'already-used')
    consumed.accepted_at = timezone.now()
    consumed.save()
    old = pending.token
    migration = import_module('core.migrations.0010_rotate_unverified_invitation_tokens')
    migration.rotate_pending_tokens(apps, SimpleNamespace(connection=SimpleNamespace(alias='default')))
    pending.refresh_from_db()
    consumed.refresh_from_db()
    assert pending.token != old
    assert consumed.token == 'already-used'
    c = client_for(recipient)
    assert c.post(f'/api/v1/contacts/invites/{old}/accept/').status_code == 404
    assert c.post(f'/api/v1/contacts/invites/{pending.token}/accept/').status_code == 201


def test_reset_revokes_access_refresh_all_devices_and_all_other_reset_links():
    person = user('reset@example.com')
    devices = [Client(), Client()]
    accesses = []
    for device in devices:
        r = device.post('/api/v1/auth/login/', {'email': person.email, 'password': PASSWORD}, content_type='application/json')
        assert r.status_code == 200
        accesses.append(r.json()['access'])
    assert UserSession.objects.filter(user=person).count() == 2
    for token in ['reset-one', 'reset-two']:
        PasswordResetToken.objects.create(user=person, token=token, expires_at=timezone.now() + timezone.timedelta(minutes=5))
    data = {'token': 'reset-one', 'password': 'ChangedSecure456!'}
    assert Client().post('/api/v1/auth/password-reset/confirm/', data, content_type='application/json').status_code == 200
    for device, access in zip(devices, accesses):
        assert device.get('/api/v1/auth/me/', HTTP_AUTHORIZATION=f'Bearer {access}').status_code == 401
        assert device.post('/api/v1/auth/refresh/').status_code == 401
    assert not UserSession.objects.filter(user=person).exists()
    data['token'] = 'reset-two'
    assert Client().post('/api/v1/auth/password-reset/confirm/', data, content_type='application/json').status_code == 400
    assert Client().post('/api/v1/auth/login/', {'email': person.email, 'password': 'ChangedSecure456!'}, content_type='application/json').status_code == 200


def test_password_claim_rejects_even_a_token_not_yet_blacklisted():
    from rest_framework_simplejwt.tokens import RefreshToken
    from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken
    person = user('changed@example.com')
    refresh = RefreshToken.for_user(person)
    access = str(refresh.access_token)
    person.set_password('ChangedSecure456!')
    person.save(update_fields=['password'])
    assert not BlacklistedToken.objects.exists()
    c = Client()
    c.cookies['refresh_token'] = str(refresh)
    assert c.post('/api/v1/auth/refresh/').status_code == 401
    assert c.get('/api/v1/auth/me/', HTTP_AUTHORIZATION=f'Bearer {access}').status_code == 401


@pytest.mark.parametrize('role', [HouseholdMembership.Role.MEMBER, HouseholdMembership.Role.CHILD_ACCOUNT])
@pytest.mark.parametrize('invited_role', HouseholdMembership.Role.values)
def test_non_admin_cannot_issue_any_household_invitation(role, invited_role):
    person = user('member@example.com')
    friend = user('friend@example.com')
    contact = Contact.objects.create(owner=person, other=friend)
    household = Household.objects.create(name='Home')
    HouseholdMembership.objects.create(user=person, household=household, role=role)
    response = client_for(person).post(
        '/api/v1/invitations/',
        {'contact_id': contact.pk, 'scope_type': 'HOUSEHOLD', 'scope_id': household.pk, 'role': invited_role},
        format='json',
    )
    assert response.status_code in (400, 404)
    assert not Invitation.objects.exists()


def stored_file(person, tmp_path, monkeypatch):
    monkeypatch.setattr(PersonalFile._meta.get_field('file'), 'storage', FileSystemStorage(location=tmp_path))
    entry = PersonalFile(owner=person, name='private.txt', content_type='text/plain', size=6)
    entry.file.save('private.txt', ContentFile(b'secret'))
    return entry


def test_account_deletion_removes_only_its_files_after_commit(tmp_path, monkeypatch, django_capture_on_commit_callbacks):
    from pathlib import Path
    owner, other = user('owner@example.com'), user('other@example.com')
    own = stored_file(owner, tmp_path, monkeypatch)
    theirs = stored_file(other, tmp_path, monkeypatch)
    own_path, other_path = Path(own.file.path), Path(theirs.file.path)
    with django_capture_on_commit_callbacks(execute=True):
        assert client_for(owner).delete('/api/v1/auth/me/').status_code == 204
    assert not own_path.exists()
    assert other_path.exists()
    assert PersonalFile.objects.filter(pk=theirs.pk).exists()


def test_rolled_back_deletion_preserves_private_file(tmp_path, monkeypatch, django_capture_on_commit_callbacks):
    from pathlib import Path
    person = user('owner@example.com')
    entry = stored_file(person, tmp_path, monkeypatch)
    path, pk = Path(entry.file.path), entry.pk
    with django_capture_on_commit_callbacks(execute=True):
        with pytest.raises(RuntimeError):
            with transaction.atomic():
                entry.delete()
                raise RuntimeError('rollback')
    assert path.exists()
    assert PersonalFile.objects.filter(pk=pk).exists()
