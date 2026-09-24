import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient
from core.models import Household, HouseholdMembership, OnboardingProfile
from haushalt.models import Task, ShoppingItem, ShoppingList
from finanzen.models import Account, Transaction, Category
from organisation.models import CalendarEvent

pytestmark = pytest.mark.django_db
URL = '/api/v1/onboarding/profile/'

@pytest.fixture
def context():
    user = get_user_model().objects.create_user(username='new', password='irrelevant')
    home = Household.objects.create(name='Zuhause')
    HouseholdMembership.objects.create(user=user, household=home)
    client = APIClient()
    client.force_authenticate(user)
    return user, home, client


def test_authentication_required():
    client = APIClient()
    assert client.get(URL).status_code == 401
    assert client.put(URL, {}, format='json').status_code == 401


def test_default_categories_do_not_block_new_user(context):
    user, home, client = context
    assert Category.objects.filter(household=home).exists()
    assert client.get(URL).data['needs_onboarding'] is True


@pytest.mark.parametrize('kind', ['transaction', 'task', 'shopping', 'calendar', 'income', 'category'])
def test_any_existing_domain_data_skips_onboarding(context, kind):
    user, home, client = context
    if kind == 'transaction':
        account = Account.objects.create(household=home, name='Konto')
        Transaction.objects.create(account=account, created_by=user, amount='10', datum=timezone.localdate())
    elif kind == 'task':
        Task.objects.create(household=home, title='Putzen', created_by=user)
    elif kind == 'shopping':
        shopping = ShoppingList.objects.create(household=home)
        ShoppingItem.objects.create(shopping_list=shopping, added_by=user, name='Milch')
    elif kind == 'calendar':
        CalendarEvent.objects.create(household=home, created_by=user, title='Termin', starts_at=timezone.now())
    elif kind == 'income':
        HouseholdMembership.objects.filter(user=user).update(monthly_income='2000')
    else:
        Category.objects.create(household=home, name='Eigene Kategorie')
    assert client.get(URL).data['needs_onboarding'] is False


def test_completion_is_persistent_and_does_not_share(context):
    user, home, client = context
    response = client.put(URL, {'usage':'shared', 'domains':['finanzen','haushalt']}, format='json')
    assert response.status_code == 200
    assert OnboardingProfile.objects.get(user=user).completed_at
    assert home.members.count() == 1
    assert not home.invites.exists()
    assert client.get(URL).data['needs_onboarding'] is False
    # Repeated finish requests do not create duplicates.
    assert client.put(URL, {'usage':'shared', 'domains':['finanzen']}, format='json').status_code == 200
    assert OnboardingProfile.objects.filter(user=user).count() == 1


def test_other_users_data_and_profile_remain_private(context):
    user, home, client = context
    other = get_user_model().objects.create_user(username='other')
    HouseholdMembership.objects.create(user=other, household=home)
    Task.objects.create(household=home, created_by=other, title='Private Vorbereitung')
    OnboardingProfile.objects.create(user=other, usage='personal', domains=['reisen'], completed_at=timezone.now())
    assert client.get(URL).data['needs_onboarding'] is True
    client.put(URL, {'user':other.pk,'usage':'shared','domains':['haushalt']}, format='json')
    assert OnboardingProfile.objects.get(user=other).usage == 'personal'


@pytest.mark.parametrize('data', [{}, {'usage':'invalid','domains':['finanzen']}, {'usage':'personal','domains':[]}, {'usage':'personal','domains':['unknown']}, {'usage':'personal','domains':['finanzen','finanzen']}])
def test_server_validates_preferences(context, data):
    user, home, client = context
    assert client.put(URL, data, format='json').status_code == 400
    assert not OnboardingProfile.objects.filter(user=user).exists()
