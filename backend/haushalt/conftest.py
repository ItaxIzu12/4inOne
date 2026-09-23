import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from core.models import Household, HouseholdMembership


def _member(household, email, first_name='', role=HouseholdMembership.Role.MEMBER):
    user = get_user_model().objects.create_user(
        username=email, email=email, password='irrelevant-for-test', first_name=first_name
    )
    HouseholdMembership.objects.create(user=user, household=household, role=role)
    return user


@pytest.fixture
def household(db):
    return Household.objects.create(name='Familie Test')


@pytest.fixture
def anna(household):
    return _member(household, 'anna@example.com', 'Anna')


@pytest.fixture
def ben(household):
    return _member(household, 'ben@example.com', 'Ben')


@pytest.fixture
def kind(household):
    return _member(household, 'kind@example.com', 'Kim', HouseholdMembership.Role.CHILD_ACCOUNT)


@pytest.fixture
def fremd(db):
    """Eine Person aus einem ANDEREN Haushalt — für die IDOR-Tests."""
    other = Household.objects.create(name='Fremder Haushalt')
    return _member(other, 'fremd@example.com', 'Fremd')


@pytest.fixture
def client_for():
    def make(user):
        client = APIClient()
        client.force_authenticate(user=user)
        return client

    return make
