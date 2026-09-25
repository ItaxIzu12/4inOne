"""Vertrag zwischen der Connection-Registry und den Domain-APIs.

Die Registry entscheidet über Sichtbarkeit (`Kind.visible`). Läuft sie von der
Domain-API auseinander — etwa weil ADR-001 das Eigentumsmodell ändert und nur
eine Seite angepasst wird —, könnte eine Verbindung ein Objekt zeigen, das die
Domain selbst verweigert (oder umgekehrt). Dieser Test verbindet beide: ein
Objekt ist in der Registry genau dann sichtbar, wenn die Domain-API es
ausliefert."""

from datetime import timedelta
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from connections.models import ObjectType
from connections.registry import ALLOWED_PAIRS, KINDS
from core.models import Household, HouseholdMembership
from finanzen.models import SavingsGoal
from haushalt.models import Task as HouseholdTask
from organisation.models import PersonalEvent, PersonalTask

pytestmark = pytest.mark.django_db

# Die Detail-Endpunkte, über die die jeweilige Domain ein Objekt ausliefert.
DOMAIN_DETAIL_URL = {
    ObjectType.TASK: '/api/v1/organisation/tasks/{pk}/',
    ObjectType.CALENDAR_EVENT: '/api/v1/organisation/events/{pk}/',
    ObjectType.SAVINGS_GOAL: '/api/v1/finanzen/private/goals/{pk}/',
    ObjectType.HOUSEHOLD_TASK: '/api/v1/haushalt/aufgaben/{pk}/',
}


def _user(name):
    return get_user_model().objects.create_user(username=name, email=f'{name}@example.com', password='x')


@pytest.fixture
def people():
    owner, housemate, child, stranger = (_user(n) for n in ('owner', 'housemate', 'child', 'stranger'))
    home = Household.objects.create(name='Zusammen')
    HouseholdMembership.objects.create(user=owner, household=home)
    HouseholdMembership.objects.create(user=housemate, household=home)
    HouseholdMembership.objects.create(user=child, household=home, role=HouseholdMembership.Role.CHILD_ACCOUNT)
    return {'owner': owner, 'housemate': housemate, 'child': child, 'stranger': stranger, 'home': home}


def _make(kind, people):
    owner = people['owner']
    return {
        ObjectType.TASK: lambda: PersonalTask.objects.create(owner=owner, title='T'),
        ObjectType.CALENDAR_EVENT: lambda: PersonalEvent.objects.create(
            owner=owner, title='E', starts_at=timezone.now() + timedelta(days=1)
        ),
        ObjectType.SAVINGS_GOAL: lambda: SavingsGoal.objects.create(
            owner=owner, title='G', target_amount=Decimal('10.00')
        ),
        ObjectType.HOUSEHOLD_TASK: lambda: HouseholdTask.objects.create(household=people['home'], title='H'),
    }[kind]()


def test_every_connectable_type_is_covered_by_the_contract():
    """Kommt ein neuer Typ in ein erlaubtes Paar, muss er hier abgesichert sein."""
    used = {t for pair in ALLOWED_PAIRS for t in pair}
    assert used <= set(KINDS), 'Typ im erlaubten Paar ohne Eintrag in der Registry'
    assert used <= set(DOMAIN_DETAIL_URL), 'Typ ohne Vertrags-Test gegen die Domain-API'


@pytest.mark.parametrize('kind', sorted(DOMAIN_DETAIL_URL))
@pytest.mark.parametrize('who', ['owner', 'housemate', 'child', 'stranger'])
def test_registry_visibility_matches_the_domain_api(kind, who, people):
    obj = _make(kind, people)
    user = people[who]
    client = APIClient()
    client.force_authenticate(user)

    domain_allows = client.get(DOMAIN_DETAIL_URL[kind].format(pk=obj.pk)).status_code == 200
    registry_allows = KINDS[kind].visible(user).filter(pk=obj.pk).exists()

    assert registry_allows == domain_allows, (
        f'{kind} für {who}: Domain-API sagt {domain_allows}, Registry sagt {registry_allows}'
    )
