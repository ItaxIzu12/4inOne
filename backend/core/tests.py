import pytest
from django.contrib.auth import get_user_model

from core.models import Household, HouseholdMembership


@pytest.mark.django_db
def test_household_membership_links_user_and_household():
    user = get_user_model().objects.create_user(username='a@example.com', password='irrelevant-for-test-1')
    household = Household.objects.create(name='Testhaushalt')
    membership = HouseholdMembership.objects.create(
        user=user, household=household, role=HouseholdMembership.Role.ADMIN
    )

    assert membership.role == HouseholdMembership.Role.ADMIN
    assert user in household.members.all()
