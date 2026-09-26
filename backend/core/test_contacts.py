"""Familie & Freunde: Einladung per E-Mail, Annahme, Kontakte — und dass eine Verbindung nichts teilt."""

import pytest
from django.contrib.auth import get_user_model
from django.core import mail
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import Contact, ContactInvite

pytestmark = pytest.mark.django_db
URL = '/api/v1/contacts/'


def make_user(email, name):
    return get_user_model().objects.create_user(username=email, email=email, password='irrelevant-1A', first_name=name)


def client_for(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def mira():
    return make_user('mira@example.com', 'Mira')


@pytest.fixture
def tom():
    return make_user('tom@example.com', 'Tom')


def invite(sender, email, relation='FRIEND'):
    return client_for(sender).post(URL + 'invites/', {'email': email, 'relation': relation}, format='json')


def test_invite_sends_an_email_with_a_link_and_creates_a_pending_invite(mira, settings):
    response = invite(mira, 'tom@example.com', 'FAMILY')
    assert response.status_code == 201 and response.data['email_sent'] is True
    stored = ContactInvite.objects.get()
    assert stored.inviter == mira and stored.relation == 'FAMILY' and stored.accepted_at is None
    assert len(mail.outbox) == 1
    message = mail.outbox[0]
    assert message.to == ['tom@example.com']
    assert f'{settings.FRONTEND_URL}/einladung/{stored.token}' in message.body
    assert 'Mira' in message.subject
    assert 'teilt ihr noch nichts' in message.body


def test_response_is_identical_for_existing_and_unknown_addresses(mira, tom):
    known = invite(mira, 'tom@example.com')
    unknown = invite(mira, 'niemand@example.com')
    assert known.status_code == unknown.status_code == 201
    assert set(known.data) == set(unknown.data)


def test_inviting_again_reuses_the_open_invite_and_resends(mira):
    invite(mira, 'tom@example.com')
    invite(mira, 'TOM@example.com', 'FAMILY')
    assert ContactInvite.objects.count() == 1 and ContactInvite.objects.get().relation == 'FAMILY'
    assert len(mail.outbox) == 2


def test_cannot_invite_yourself_or_an_existing_contact(mira, tom):
    assert invite(mira, 'mira@example.com').status_code == 400
    Contact.objects.create(owner=mira, other=tom)
    assert invite(mira, 'tom@example.com').status_code == 400


def test_accepting_creates_a_mutual_connection_and_nothing_is_shared(mira, tom):
    invite(mira, 'tom@example.com', 'FAMILY')
    token = ContactInvite.objects.get().token
    response = client_for(tom).post(f'{URL}invites/{token}/accept/')
    assert response.status_code == 201
    assert Contact.objects.filter(owner=mira, other=tom, relation='FAMILY').exists()
    assert Contact.objects.filter(owner=tom, other=mira, relation='FAMILY').exists()
    assert ContactInvite.objects.get().accepted_at is not None
    # beide sehen sich mit Name und E-Mail — sonst nichts
    mine = client_for(mira).get(URL).data
    assert mine['contacts'][0]['name'] == 'Tom' and set(mine['contacts'][0]) == {'id', 'name', 'email', 'relation', 'since'}
    assert client_for(tom).get(URL).data['contacts'][0]['name'] == 'Mira'
    assert mine['sent'] == [] and client_for(tom).get(URL).data['received'] == []
    # ein zweites Mal annehmen geht nicht
    assert client_for(tom).post(f'{URL}invites/{token}/accept/').status_code == 404


def test_only_the_invited_email_can_see_or_answer_the_invite(mira, tom):
    other = make_user('fremd@example.com', 'Fremd')
    invite(mira, 'tom@example.com')
    token = ContactInvite.objects.get().token
    assert client_for(other).get(f'{URL}invites/{token}/').status_code == 404
    assert client_for(other).post(f'{URL}invites/{token}/accept/').status_code == 404
    assert client_for(mira).post(f'{URL}invites/{token}/accept/').status_code == 404      # auch die einladende Person nicht
    assert not Contact.objects.exists()
    detail = client_for(tom).get(f'{URL}invites/{token}/')
    assert detail.status_code == 200 and detail.data['from_name'] == 'Mira'
    assert APIClient().get(f'{URL}invites/{token}/').status_code == 401


def test_expired_and_declined_invites_cannot_be_accepted(mira, tom):
    invite(mira, 'tom@example.com')
    stored = ContactInvite.objects.get()
    stored.expires_at = timezone.now() - timezone.timedelta(minutes=1)
    stored.save()
    assert client_for(tom).post(f'{URL}invites/{stored.token}/accept/').status_code == 404
    assert client_for(mira).get(URL).data['sent'] == []

    stored.expires_at = timezone.now() + timezone.timedelta(days=1)
    stored.save()
    assert client_for(tom).post(f'{URL}invites/{stored.token}/decline/').status_code == 204
    assert client_for(tom).post(f'{URL}invites/{stored.token}/accept/').status_code == 404
    assert not Contact.objects.exists()


def test_received_and_sent_lists(mira, tom):
    invite(mira, 'tom@example.com')
    sent = client_for(mira).get(URL).data['sent']
    received = client_for(tom).get(URL).data['received']
    assert [s['email'] for s in sent] == ['tom@example.com']
    assert received[0]['from_name'] == 'Mira' and received[0]['token'] == ContactInvite.objects.get().token
    assert 'token' not in sent[0]        # die einladende Person bekommt das Token nie zurück
    assert client_for(mira).get(URL).data['received'] == []


def test_cancelling_a_sent_invite(mira, tom):
    invite(mira, 'tom@example.com')
    pk = ContactInvite.objects.get().pk
    assert client_for(tom).delete(f'{URL}invites/{pk}/').status_code == 404       # nicht seine
    assert client_for(mira).delete(f'{URL}invites/{pk}/').status_code == 204
    assert not ContactInvite.objects.exists()


def test_relation_is_per_side_and_removing_ends_it_for_both(mira, tom):
    invite(mira, 'tom@example.com', 'FRIEND')
    client_for(tom).post(f'{URL}invites/{ContactInvite.objects.get().token}/accept/')
    mine = Contact.objects.get(owner=mira)
    assert client_for(mira).patch(f'{URL}{mine.pk}/', {'relation': 'FAMILY'}, format='json').data['relation'] == 'FAMILY'
    assert Contact.objects.get(owner=tom).relation == 'FRIEND'                    # Toms Sicht bleibt
    assert client_for(mira).patch(f'{URL}{mine.pk}/', {'relation': 'X'}, format='json').status_code == 400
    assert client_for(tom).patch(f'{URL}{mine.pk}/', {'relation': 'FAMILY'}, format='json').status_code == 404
    assert client_for(mira).delete(f'{URL}{mine.pk}/').status_code == 204
    assert not Contact.objects.exists()


def test_everything_needs_a_login():
    anonymous = APIClient()
    assert anonymous.get(URL).status_code == 401
    assert anonymous.post(URL + 'invites/', {'email': 'a@example.com'}, format='json').status_code == 401


def test_a_failing_mail_server_does_not_lose_the_invite(mira, monkeypatch):
    def boom(*args, **kwargs):
        raise OSError('kein Mailserver')

    monkeypatch.setattr('core.contact_views.send_mail', boom)
    response = invite(mira, 'tom@example.com')
    assert response.status_code == 201 and response.data['email_sent'] is False
    assert ContactInvite.objects.count() == 1
