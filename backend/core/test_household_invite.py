"""HouseholdInviteView (core/household_views.py) — Einladungs-Endpunkt aus
ARCHITEKTUR.md §3.9: zufälliges Token, Ablaufzeit, kein Verrat, ob die
eingeladene E-Mail bereits ein Konto hat, Rate-Limit pro Haushalt."""

from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import Household, HouseholdInvite, HouseholdMembership

pytestmark = pytest.mark.django_db


def _client_for(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def test_sending_an_invite_creates_a_household_invite_with_token_and_expiry(settings):
    User = get_user_model()
    user = User.objects.create_user(username='inviter@example.com', password='irrelevant-for-test')
    household = Household.objects.create(name='Testhaushalt')
    HouseholdMembership.objects.create(user=user, household=household, role=HouseholdMembership.Role.ADMIN)

    response = _client_for(user).post(
        '/api/v1/household/invite/', {'email': 'neu@example.com', 'role': 'MEMBER'}, format='json'
    )

    assert response.status_code == 201
    assert response.data['email'] == 'neu@example.com'
    assert 'gesendet' in response.data['detail']

    invite = HouseholdInvite.objects.get(household=household, email='neu@example.com')
    assert len(invite.token) > 20
    assert invite.role == 'MEMBER'
    assert invite.accepted_at is None
    expected_expiry = timezone.now() + timedelta(days=settings.HOUSEHOLD_INVITE_EXPIRY_DAYS)
    assert abs((invite.expires_at - expected_expiry).total_seconds()) < 5


def test_invite_defaults_to_member_role_when_not_specified():
    User = get_user_model()
    user = User.objects.create_user(username='default-role@example.com', password='irrelevant-for-test')
    household = Household.objects.create(name='Testhaushalt')
    HouseholdMembership.objects.create(user=user, household=household)

    response = _client_for(user).post('/api/v1/household/invite/', {'email': 'ohne-rolle@example.com'}, format='json')

    assert response.status_code == 201
    invite = HouseholdInvite.objects.get(email='ohne-rolle@example.com')
    assert invite.role == HouseholdMembership.Role.MEMBER


def test_inviting_an_existing_member_is_rejected_cleanly():
    User = get_user_model()
    admin = User.objects.create_user(username='admin-x@example.com', password='irrelevant-for-test')
    existing_member = User.objects.create_user(
        username='schon-dabei@example.com', email='schon-dabei@example.com', password='irrelevant-for-test'
    )
    household = Household.objects.create(name='Testhaushalt')
    HouseholdMembership.objects.create(user=admin, household=household, role=HouseholdMembership.Role.ADMIN)
    HouseholdMembership.objects.create(user=existing_member, household=household)

    response = _client_for(admin).post(
        '/api/v1/household/invite/', {'email': 'schon-dabei@example.com'}, format='json'
    )

    assert response.status_code == 400
    assert not HouseholdInvite.objects.filter(email='schon-dabei@example.com').exists()


def test_invite_without_a_household_fails_cleanly_not_with_a_500():
    User = get_user_model()
    user = User.objects.create_user(username='no-household-invite@example.com', password='irrelevant-for-test')

    response = _client_for(user).post('/api/v1/household/invite/', {'email': 'x@example.com'}, format='json')

    assert response.status_code == 400


def test_invite_response_never_reveals_whether_the_invited_email_has_an_account():
    """ARCHITEKTUR.md §3.9: die Einladung darf nicht verraten, ob die
    eingeladene E-Mail bereits registriert ist — beide Fälle müssen
    identisch aussehen (kein Feld, kein Statuscode-Unterschied)."""
    User = get_user_model()
    inviter = User.objects.create_user(username='inviter-2@example.com', password='irrelevant-for-test')
    User.objects.create_user(username='hat-schon-ein-konto@example.com', password='irrelevant-for-test')
    household = Household.objects.create(name='Testhaushalt')
    HouseholdMembership.objects.create(user=inviter, household=household, role=HouseholdMembership.Role.ADMIN)

    response_existing = _client_for(inviter).post(
        '/api/v1/household/invite/', {'email': 'hat-schon-ein-konto@example.com'}, format='json'
    )
    response_new = _client_for(inviter).post(
        '/api/v1/household/invite/', {'email': 'ganz-neu@example.com'}, format='json'
    )

    assert response_existing.status_code == response_new.status_code == 201
    assert set(response_existing.data.keys()) == set(response_new.data.keys())


def test_invite_rate_limit_is_shared_per_household_not_per_user(settings):
    """Zwei verschiedene ADMIN-Mitglieder DESSELBEN Haushalts teilen sich
    das Limit — sonst ließe es sich durch ein zweites Admin-Konto umgehen."""
    User = get_user_model()
    admin_1 = User.objects.create_user(username='admin-1@example.com', password='irrelevant-for-test')
    admin_2 = User.objects.create_user(username='admin-2@example.com', password='irrelevant-for-test')
    household = Household.objects.create(name='Testhaushalt')
    HouseholdMembership.objects.create(user=admin_1, household=household, role=HouseholdMembership.Role.ADMIN)
    HouseholdMembership.objects.create(user=admin_2, household=household, role=HouseholdMembership.Role.ADMIN)

    limit = int(settings.REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']['household_invite'].split('/')[0])

    last_status = None
    for i in range(limit + 1):
        user = admin_1 if i % 2 == 0 else admin_2
        last_status = _client_for(user).post(
            '/api/v1/household/invite/', {'email': f'person-{i}@example.com'}, format='json'
        ).status_code

    assert last_status == 429
