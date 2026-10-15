"""Authorization-Audit (Beta Security Gate): Rechte-Matrix mit den Personas

    Sophie — besitzt alles (Finanzen, Haushalt „Unser Zuhause“, Organisation, Reisen „Berlin“ und „Geheimreise“)
    Alex   — Mitglied in Sophies Haushalt (angenommene Einladung, nicht Admin)
    Ben    — Betrachter (VIEWER) der Reise „Berlin“
    Eve    — ohne jede Beziehung

Jedes Objekt trägt im Namen, wer es sehen darf: GEHEIM-… nur Sophie, HAUSHALT-… Sophie und Alex, BERLIN-… Sophie und
Ben. Ein Durchlauf über ALLE Listen-Endpunkte der API (aus dem URL-Router gelesen, nichts von Hand gepflegt) prüft,
dass kein fremder Marker auftaucht — weder als Objekt noch als Titel, Zählwert-Text oder Verbindungsziel. Dazu
Direktzugriffe (GET/PATCH/DELETE) auf jedes Objekt, Anlegen in fremdem Bereich, gefälschte Besitzer-/Bereichs-IDs,
Rollen-Eskalation und sofortiger Rechteentzug.
"""

import json
from datetime import timedelta
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.urls import get_resolver
from django.utils import timezone
from rest_framework.test import APIClient

from connections.models import Connection
from core.models import Contact, Household, HouseholdMembership
from django.core.files.base import ContentFile
from django.core.files.storage import FileSystemStorage
from finanzen.models import Account, Category, MonthlyBudget, RecurringDeduction, SavingsContribution, SavingsGoal, Transaction
from finanzen.models import Category as LegacyCategory
from haushalt.models import FolderEntry, ShoppingItem, ShoppingList, Task
from organisation.models import PersonalEvent, PersonalFile, PersonalNote, PersonalTask
from reisen.models import PackingItem, Trip, TripBudgetCategory, TripEvent, TripExpense, TripParticipant, TripTask

pytestmark = pytest.mark.django_db

PRIVATE, HOUSEHOLD, TRIP = 'GEHEIM', 'HAUSHALT', 'BERLIN'
ALLOWED = {'sophie': {PRIVATE, HOUSEHOLD, TRIP}, 'alex': {HOUSEHOLD}, 'ben': {TRIP}, 'eve': set()}


def person(name):
    user = get_user_model().objects.create_user(
        username=f'{name}@example.com', email=f'{name}@example.com', password='x', first_name=name.title()
    )
    home = Household.objects.create(name=f'Eigenes Zuhause {name}')
    HouseholdMembership.objects.create(user=user, household=home, role=HouseholdMembership.Role.ADMIN)
    return user


def api(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


@pytest.fixture
def world(tmp_path, monkeypatch):
    sophie, alex, ben, eve = (person(n) for n in ('sophie', 'alex', 'ben', 'eve'))
    home = Household.objects.create(name=f'{HOUSEHOLD}-Unser Zuhause')
    HouseholdMembership.objects.create(user=sophie, household=home, role=HouseholdMembership.Role.ADMIN)
    HouseholdMembership.objects.create(user=alex, household=home, role=HouseholdMembership.Role.MEMBER)
    for other in (alex, ben):
        Contact.objects.create(owner=sophie, other=other)
        Contact.objects.create(owner=other, other=sophie)
    today = timezone.localdate()
    now = timezone.now()

    objs = {}
    # Finanzen (privat)
    cat = objs['category'] = Category.objects.create(owner=sophie, name=f'{PRIVATE}-Kategorie')
    objs['transaction'] = Transaction.objects.create(owner=sophie, category=cat, amount=Decimal('42.00'),
                                                     description=f'{PRIVATE}-Ausgabe', datum=today)
    objs['budget'] = MonthlyBudget.objects.create(owner=sophie, month=today.replace(day=1), amount=Decimal('1234.00'))
    goal = objs['goal'] = SavingsGoal.objects.create(owner=sophie, title=f'{PRIVATE}-Sparziel',
                                                     target_amount=Decimal('900'), current_amount=Decimal('10'))
    SavingsContribution.objects.create(owner=sophie, goal=goal, amount=Decimal('10'), date=today)
    Account.objects.create(household=home, name=f'{PRIVATE}-Altkonto')
    # Eingefrorene alte Haushaltsfinanzen gehören zum EIGENEN Haushalt (core/households.py › own_household)
    own_home = sophie.households.order_by('householdmembership__id').first()
    legacy_category = objs['legacy_category'] = LegacyCategory.objects.create(household=own_home, name=f'{PRIVATE}-Altkategorie')
    account = Account.objects.create(household=own_home, name=f'{PRIVATE}-Girokonto')
    objs['legacy_transaction'] = Transaction.objects.create(account=account, category=legacy_category, amount=Decimal('7.00'),
                                                            description=f'{PRIVATE}-Altbuchung', datum=today)
    objs['legacy_deduction'] = RecurringDeduction.objects.create(household=own_home, name=f'{PRIVATE}-Miete',
                                                                 amount=Decimal('900'), category=legacy_category)
    # Haushalt (geteilt mit Alex)
    objs['household_task'] = Task.objects.create(household=home, title=f'{HOUSEHOLD}-Müll', created_by=sophie)
    shopping = objs['shopping_list'] = ShoppingList.objects.create(household=home, name=f'{HOUSEHOLD}-Liste')
    objs['shopping_item'] = ShoppingItem.objects.create(shopping_list=shopping, name=f'{HOUSEHOLD}-Milch')
    device = objs['device'] = FolderEntry.objects.create(household=home, kind='geraet', name=f'{HOUSEHOLD}-Waschmaschine',
                                                         created_by=sophie)
    objs['contract'] = FolderEntry.objects.create(household=home, kind='vertrag', name=f'{HOUSEHOLD}-Strom', created_by=sophie)
    # Organisation (privat)
    objs['event'] = PersonalEvent.objects.create(owner=sophie, title=f'{PRIVATE}-Arzt', starts_at=now + timedelta(days=1))
    objs['org_task'] = PersonalTask.objects.create(owner=sophie, title=f'{PRIVATE}-Steuer', due_date=today)
    objs['note'] = PersonalNote.objects.create(owner=sophie, title=f'{PRIVATE}-Notiz', body='privat')
    monkeypatch.setattr(PersonalFile._meta.get_field('file'), 'storage', FileSystemStorage(location=tmp_path))
    upload = PersonalFile(owner=sophie, name=f'{PRIVATE}-Befund.txt', content_type='text/plain', size=14)
    upload.file.save('befund.txt', ContentFile(f'{PRIVATE}-Inhalt'.encode()))
    objs['file'] = upload
    # Reisen: Berlin geteilt mit Ben (Betrachter), Geheimreise privat
    berlin = objs['trip'] = Trip.objects.create(owner=sophie, title=f'{TRIP}-Wochenende', destination=f'{TRIP}-Stadt',
                                                start_date=today + timedelta(days=10), end_date=today + timedelta(days=12))
    objs['participant'] = TripParticipant.objects.create(trip=berlin, user=ben, role=TripParticipant.Role.VIEWER)
    secret = objs['secret_trip'] = Trip.objects.create(owner=sophie, title=f'{PRIVATE}-Reise', destination=f'{PRIVATE}-Ort',
                                                       start_date=today + timedelta(days=40), end_date=today + timedelta(days=42))
    for trip, marker, suffix in ((berlin, TRIP, ''), (secret, PRIVATE, '_secret')):
        objs['packing' + suffix] = PackingItem.objects.create(trip=trip, title=f'{marker}-Pass')
        objs['trip_task' + suffix] = TripTask.objects.create(trip=trip, title=f'{marker}-Tickets')
        objs['trip_event' + suffix] = TripEvent.objects.create(trip=trip, title=f'{marker}-Museum', starts_at=now + timedelta(days=11))
        objs['expense' + suffix] = TripExpense.objects.create(trip=trip, title=f'{marker}-Hotel', amount=Decimal('280'), date=today)
        objs['budget_category' + suffix] = TripBudgetCategory.objects.create(trip=trip, category='UNTERKUNFT', planned_amount=Decimal('500'))
    # Verbindungen: geteiltes Gerät ↔ privates Sparziel, geteilte Reise ↔ privates Sparziel
    objs['connection'] = Connection.objects.create(source_type='DEVICE', source_id=device.pk, target_type='SAVINGS_GOAL',
                                                   target_id=goal.pk, relation_type='FUNDED_BY', created_by=sophie)
    Connection.objects.create(source_type='TRIP', source_id=berlin.pk, target_type='SAVINGS_GOAL', target_id=goal.pk,
                              relation_type='FUNDED_BY', created_by=sophie)
    return dict(sophie=sophie, alex=alex, ben=ben, eve=eve, home=home, objs=objs)


# Detail-URL je Objekt und wer es sehen darf
DETAIL = {
    'transaction': ('/api/v1/finanzen/private/transactions/{}/', PRIVATE),
    'category': ('/api/v1/finanzen/private/categories/{}/', PRIVATE),
    'budget': ('/api/v1/finanzen/private/budgets/{}/', PRIVATE),
    'goal': ('/api/v1/finanzen/private/goals/{}/', PRIVATE),
    'household_task': ('/api/v1/haushalt/aufgaben/{}/', HOUSEHOLD),
    'shopping_item': ('/api/v1/haushalt/einkauf/eintraege/{}/', HOUSEHOLD),
    'device': ('/api/v1/haushalt/ordner/{}/', HOUSEHOLD),
    'contract': ('/api/v1/haushalt/ordner/{}/', HOUSEHOLD),
    'event': ('/api/v1/organisation/events/{}/', PRIVATE),
    'org_task': ('/api/v1/organisation/tasks/{}/', PRIVATE),
    'note': ('/api/v1/organisation/notes/{}/', PRIVATE),
    'trip': ('/api/v1/reisen/trips/{}/', TRIP),
    'secret_trip': ('/api/v1/reisen/trips/{}/', PRIVATE),
    'packing': ('/api/v1/reisen/packing-items/{}/', TRIP),
    'packing_secret': ('/api/v1/reisen/packing-items/{}/', PRIVATE),
    'trip_task': ('/api/v1/reisen/tasks/{}/', TRIP),
    'trip_task_secret': ('/api/v1/reisen/tasks/{}/', PRIVATE),
    'trip_event': ('/api/v1/reisen/events/{}/', TRIP),
    'trip_event_secret': ('/api/v1/reisen/events/{}/', PRIVATE),
    'expense': ('/api/v1/reisen/expenses/{}/', TRIP),
    'expense_secret': ('/api/v1/reisen/expenses/{}/', PRIVATE),
    'budget_category': ('/api/v1/reisen/budget-categories/{}/', TRIP),
    'budget_category_secret': ('/api/v1/reisen/budget-categories/{}/', PRIVATE),
    'connection': ('/api/v1/connections/{}/', PRIVATE),  # Ziel ist privat → für niemand außer Sophie sichtbar
    'legacy_transaction': ('/api/v1/finanzen/transaktionen/{}/', PRIVATE),
    'legacy_category': ('/api/v1/finanzen/kategorien/{}/', PRIVATE),
    'legacy_deduction': ('/api/v1/finanzen/abzuege/{}/', PRIVATE),
    'shopping_list': ('/api/v1/haushalt/einkauf/listen/{}/', HOUSEHOLD),
    'file': ('/api/v1/organisation/files/{}/', PRIVATE),
    'file_content': ('/api/v1/organisation/files/{}/inhalt/', PRIVATE),
    'participant': ('/api/v1/reisen/participants/{}/', TRIP),
}
DETAIL_OBJECT = {'file_content': 'file'}  # Inhalt-Endpunkt nutzt dasselbe Objekt wie „file“


def dump(response) -> str:
    try:
        return json.dumps(response.data, default=str, ensure_ascii=False)
    except Exception:  # z. B. Datei-/CSV-Antworten
        return response.content.decode(errors='ignore')


def _list_endpoints():
    """Alle GET-fähigen API-Routen ohne Pfad-Parameter — aus dem Router gelesen, damit neue Endpunkte automatisch
    mitgeprüft werden."""

    def walk(patterns, prefix=''):
        for p in patterns:
            if hasattr(p, 'url_patterns'):
                yield from walk(p.url_patterns, prefix + str(p.pattern))
            else:
                yield prefix + str(p.pattern)

    skip = ('auth/logout', 'auth/refresh', 'auth/login', 'auth/register', 'password-reset', 'email/', 'csrf',
            'fx/rates', 'berichte/pdf')
    urls = set()
    for route in walk(get_resolver().url_patterns):
        if not route.startswith('api/v1/') or '<' in route or '(?P' in route or route.endswith('$'):
            continue
        if any(s in route for s in skip):
            continue
        urls.add('/' + route.replace('^', ''))
    return sorted(urls)


LIST_ENDPOINTS = _list_endpoints()
EXTRA_QUERIES = ['?month={month}', '?q=GEHEIM', '?q=HAUSHALT', '?q=BERLIN', '?object_type=DEVICE&object_id={device}',
                 '?object_type=TRIP&object_id={trip}', '?object_type=SAVINGS_GOAL&object_id={goal}', '?trip={trip}',
                 '?trip={secret_trip}', '?start={start}&end={end}']


# --------------------------------------------------------------------------- Sweep über alle Listen-Endpunkte


@pytest.mark.parametrize('who', ['alex', 'ben', 'eve'])
def test_no_list_endpoint_leaks_markers_of_data_the_person_may_not_see(world, who):
    client = api(world[who])
    o = world['objs']
    today = timezone.localdate()
    fill = dict(month=today.strftime('%Y-%m'), device=o['device'].pk, trip=o['trip'].pk, goal=o['goal'].pk,
                secret_trip=o['secret_trip'].pk, start=(today - timedelta(days=60)).isoformat(),
                end=(today + timedelta(days=90)).isoformat())
    forbidden = {PRIVATE, HOUSEHOLD, TRIP} - ALLOWED[who]
    checked = 0
    for url in LIST_ENDPOINTS:
        for query in [''] + EXTRA_QUERIES:
            response = client.get(url + query.format(**fill))
            if response.status_code == 405:
                break
            assert response.status_code < 500, (url, query, response.status_code)
            body = dump(response)
            for marker in forbidden:
                assert marker not in body, f'{who} sieht {marker} über {url}{query}'
            checked += 1
    assert checked > 100  # der Sweep hat wirklich die API abgedeckt


def test_owner_sees_everything_she_owns(world):
    client = api(world['sophie'])
    for name, (url, _) in DETAIL.items():
        assert client.get(url.format(world['objs'][DETAIL_OBJECT.get(name, name)].pk)).status_code == 200, name


# --------------------------------------------------------------------------- Direktzugriff (IDOR/BOLA)


@pytest.mark.parametrize('who', ['alex', 'ben', 'eve'])
def test_direct_access_to_foreign_objects_reveals_nothing(world, who):
    client = api(world[who])
    for name, (url, marker) in DETAIL.items():
        target = url.format(world['objs'][DETAIL_OBJECT.get(name, name)].pk)
        if marker in ALLOWED[who]:
            assert client.get(target).status_code == 200, (who, name)
            continue
        for method in ('get', 'patch', 'put', 'delete'):
            response = getattr(client, method)(target, {'title': 'x', 'name': 'x', 'amount': '1'}, format='json')
            assert response.status_code in (403, 404, 405), (who, name, method, response.status_code)
            for leak in (PRIVATE, HOUSEHOLD, TRIP):
                assert leak not in dump(response), (who, name, method)
    # unverändert und vorhanden
    assert Transaction.objects.filter(pk=world['objs']['transaction'].pk).exists()
    assert Trip.objects.get(pk=world['objs']['secret_trip'].pk).title == f'{PRIVATE}-Reise'


def test_trip_viewer_can_read_but_never_change_the_shared_trip(world):
    ben = api(world['ben'])
    o = world['objs']
    for name in ('trip', 'packing', 'trip_task', 'trip_event', 'expense', 'budget_category'):
        url = DETAIL[name][0].format(o[name].pk)
        assert ben.get(url).status_code == 200
        assert ben.patch(url, {'title': 'gekapert', 'planned_amount': '1'}, format='json').status_code == 403, name
        assert ben.delete(url).status_code == 403, name
    assert Trip.objects.get(pk=o['trip'].pk).title == f'{TRIP}-Wochenende'


# --------------------------------------------------------------------------- Anlegen im fremden Bereich, gefälschte IDs


@pytest.mark.parametrize('resource,extra', [
    ('packing-items', {'title': 'x'}), ('tasks', {'title': 'x'}),
    ('events', {'title': 'x', 'starts_at': '2030-01-01T10:00:00+01:00'}),
    ('expenses', {'title': 'x', 'amount': '1.00', 'date': '2030-01-01'}),
    ('budget-categories', {'category': 'VERPFLEGUNG', 'planned_amount': '1.00'}),
])
def test_nobody_can_create_inside_a_trip_they_may_not_write(world, resource, extra):
    o = world['objs']
    for who, trip in (('ben', o['trip']), ('ben', o['secret_trip']), ('alex', o['trip']), ('eve', o['trip'])):
        response = api(world[who]).post(f'/api/v1/reisen/{resource}/', {'trip': trip.pk, **extra}, format='json')
        assert response.status_code in (400, 403, 404), (who, resource, response.status_code)
    assert not TripTask.objects.filter(title='x').exists() and not PackingItem.objects.filter(title='x').exists()


def test_forged_owner_household_and_role_fields_are_ignored(world):
    eve = api(world['eve'])
    o, home = world['objs'], world['home']
    note = eve.post('/api/v1/organisation/notes/', {'title': 'Eve', 'body': 'x', 'owner': world['sophie'].pk}, format='json').data
    assert PersonalNote.objects.get(pk=note['id']).owner == world['eve']
    goal = eve.post('/api/v1/finanzen/private/goals/', {'title': 'E', 'target_amount': '5', 'owner': world['sophie'].pk}, format='json').data
    assert SavingsGoal.objects.get(pk=goal['id']).owner == world['eve']
    task = eve.post('/api/v1/haushalt/aufgaben/', {'title': 'E', 'household': home.pk}, format='json').data
    assert Task.objects.get(pk=task['id']).household != home
    item = eve.post('/api/v1/haushalt/einkauf/eintraege/', {'name': 'E', 'shopping_list': ShoppingList.objects.get(household=home).pk},
                    format='json')
    assert item.status_code in (201, 400)
    assert not ShoppingItem.objects.filter(name='E', shopping_list__household=home).exists()
    trip = eve.post('/api/v1/reisen/trips/', {'title': 'E', 'destination': 'X', 'owner': world['sophie'].pk,
                                              'start_date': (timezone.localdate() + timedelta(days=5)).isoformat(),
                                              'end_date': (timezone.localdate() + timedelta(days=6)).isoformat()}, format='json').data
    assert Trip.objects.get(pk=trip['id']).owner == world['eve']
    # Transaktion in fremder Kategorie
    assert eve.post('/api/v1/finanzen/private/transactions/', {
        'amount': '1.00', 'type': 'EXPENSE', 'date': timezone.localdate().isoformat(), 'category': o['category'].pk,
    }, format='json').status_code == 400


def test_role_escalation_is_rejected(world):
    ben = api(world['ben'])
    own_row = TripParticipant.objects.get(user=world['ben'])
    assert ben.patch(f'/api/v1/reisen/participants/{own_row.pk}/', {'role': 'OWNER'}, format='json').status_code == 403
    assert TripParticipant.objects.get(pk=own_row.pk).role == 'VIEWER'
    alex = api(world['alex'])
    sophie_row = HouseholdMembership.objects.get(user=world['sophie'], household=world['home'])
    assert alex.delete(f'/api/v1/household/members/{sophie_row.pk}/').status_code == 403
    assert alex.get('/api/v1/household/members/').data['can_invite'] is False


# --------------------------------------------------------------------------- Querzugriffe über Verbindungen


def test_connections_never_reveal_a_private_target(world):
    o = world['objs']
    for who in ('alex', 'ben'):
        client = api(world[who])
        source = ('DEVICE', o['device'].pk) if who == 'alex' else ('TRIP', o['trip'].pk)
        body = dump(client.get(f'/api/v1/connections/?object_type={source[0]}&object_id={source[1]}'))
        assert 'SAVINGS_GOAL' not in body and PRIVATE not in body and str(o['goal'].pk) not in body.replace(str(o['trip'].pk), '')
        assert client.get(f'/api/v1/connections/{o["connection"].pk}/').status_code == 404
        assert client.delete(f'/api/v1/connections/{o["connection"].pk}/').status_code == 404
        # auch das Verknüpfen mit dem fremden Ziel verrät nichts
        response = client.post('/api/v1/connections/', {'source_type': source[0], 'source_id': source[1],
                                                         'target_type': 'SAVINGS_GOAL', 'target_id': o['goal'].pk}, format='json')
        assert response.status_code == 404 and PRIVATE not in dump(response)
    assert dump(api(world['ben']).get(f'/api/v1/connections/reisen/{o["trip"].pk}/sparziel/')) == '[]'


# --------------------------------------------------------------------------- Entzug wirkt sofort


def test_removed_member_and_participant_lose_access_immediately(world):
    o = world['objs']
    alex, ben = api(world['alex']), api(world['ben'])
    task_url = DETAIL['household_task'][0].format(o['household_task'].pk)
    trip_url = DETAIL['trip'][0].format(o['trip'].pk)
    assert alex.get(task_url).status_code == 200 and ben.get(trip_url).status_code == 200

    sophie = api(world['sophie'])
    membership = HouseholdMembership.objects.get(user=world['alex'], household=world['home'])
    assert sophie.delete(f'/api/v1/household/members/{membership.pk}/').status_code == 204
    participant = TripParticipant.objects.get(user=world['ben'])
    assert sophie.delete(f'/api/v1/reisen/participants/{participant.pk}/').status_code == 204

    assert alex.get(task_url).status_code == 404
    assert alex.patch(task_url, {'title': 'x'}, format='json').status_code == 404
    assert HOUSEHOLD not in dump(alex.get('/api/v1/haushalt/aufgaben/'))
    assert ben.get(trip_url).status_code == 404
    assert TRIP not in dump(ben.get('/api/v1/reisen/trips/'))
    assert TRIP not in dump(ben.get('/api/v1/today/'))


@pytest.mark.parametrize('who', ['sophie', 'alex', 'ben'])
def test_sweep_control_markers_that_are_allowed_do_show_up(world, who):
    """Gegenprobe: ohne sie könnte der Sweep oben „grün“ sein, nur weil er nichts erreicht."""
    client = api(world[who])
    seen = set()
    for url in LIST_ENDPOINTS:
        body = dump(client.get(url))
        seen |= {m for m in (PRIVATE, HOUSEHOLD, TRIP) if m in body}
    assert seen == ALLOWED[who]


def test_trip_expenses_never_reveal_another_persons_home_currency(world):
    """Die Heimatwährung ist eine persönliche Einstellung: Mitreisende sehen ihre eigene, nie die der Erfasserin."""
    from core.models import UserPreference

    o = world['objs']
    UserPreference.objects.update_or_create(user=world['sophie'], defaults={'home_currency': 'CHF'})
    expense = o['expense']
    expense.home_currency, expense.amount_home = 'CHF', Decimal('260.00')
    expense.save()
    sophie_view = api(world['sophie']).get(f'/api/v1/reisen/expenses/{expense.pk}/').data
    ben_view = api(world['ben']).get(f'/api/v1/reisen/expenses/{expense.pk}/').data
    assert sophie_view['home_currency'] == 'CHF' and sophie_view['amount_home'] == '260.00'
    assert ben_view['home_currency'] == 'EUR' and 'CHF' not in dump(api(world['ben']).get(f'/api/v1/reisen/expenses/?trip={o["trip"].pk}'))


def test_household_members_never_see_each_others_email_addresses(world):
    """Mitglieder sind nicht automatisch miteinander verbunden — Anzeige nur mit Vorname bzw. Namensteil."""
    o = world['objs']
    mia = get_user_model().objects.create_user(username='mia.privat@example.com', email='mia.privat@example.com', password='x')
    HouseholdMembership.objects.create(user=mia, household=world['home'], role=HouseholdMembership.Role.MEMBER)
    task = o['household_task']
    task.assigned_to = mia
    task.save()
    alex = api(world['alex'])
    for url in ('/api/v1/haushalt/aufgaben/', '/api/v1/haushalt/einkauf/', '/api/v1/haushalt/aufgaben/verteilung/',
                '/api/v1/household/members/', '/api/v1/haushalt/uebersicht/'):
        assert 'mia.privat@example.com' not in dump(alex.get(url)), url


PUBLIC_ROUTES = {
    'api/v1/auth/csrf/', 'api/v1/auth/login/', 'api/v1/auth/register/', 'api/v1/auth/refresh/', 'api/v1/auth/logout/',
    'api/v1/auth/password-reset/request/', 'api/v1/auth/password-reset/confirm/', 'api/v1/auth/email/verify/',
}


def test_fail_closed_every_api_route_requires_login_except_the_auth_allowlist():
    """Neue Endpunkte sind automatisch geschützt — ein öffentlicher Endpunkt muss hier bewusst eingetragen werden."""
    from rest_framework.permissions import AllowAny

    def walk(patterns, prefix=''):
        for p in patterns:
            if hasattr(p, 'url_patterns'):
                yield from walk(p.url_patterns, prefix + str(p.pattern))
            else:
                yield prefix + str(p.pattern), p.callback

    open_routes = set()
    for route, callback in walk(get_resolver().url_patterns):
        view = getattr(callback, 'cls', None)
        if not route.startswith('api/') or view is None:
            continue
        if any(issubclass(p, AllowAny) for p in getattr(view, 'permission_classes', [])):
            open_routes.add(route)
    assert open_routes == PUBLIC_ROUTES


# --------------------------------------------------------------------------- Vertragskosten privat


def test_contract_amounts_are_visible_only_to_the_person_who_entered_them(world):
    o, home = world['objs'], world['home']
    contract = o['contract']
    contract.cost, contract.billing_cycle = Decimal('89.00'), 'MONTHLY'
    contract.save()
    sophie, alex = api(world['sophie']), api(world['alex'])
    url = f'/api/v1/haushalt/ordner/{contract.pk}/'

    mine = sophie.get(url).data
    assert (mine['cost'], mine['monthly_equivalent'], mine['cost_visible']) == ('89.00', '89.00', True)
    shared = alex.get(url).data
    assert shared['cost'] is None and shared['monthly_equivalent'] is None and shared['cost_visible'] is False
    assert shared['name'] == contract.name  # alles andere bleibt sichtbar
    for listing in ('/api/v1/haushalt/ordner/', '/api/v1/haushalt/uebersicht/'):
        assert '89.00' not in dump(alex.get(listing)), listing
    assert alex.get('/api/v1/haushalt/uebersicht/').data['contracts_monthly'] in ('0', '0.00')

    # Alex kann den Betrag weder sehen noch überschreiben
    assert alex.patch(url, {'cost': '1.00', 'provider': 'Stadtwerke'}, format='json').status_code == 200
    contract.refresh_from_db()
    assert contract.cost == Decimal('89.00') and contract.provider == 'Stadtwerke'

    # Alex' eigener Vertrag: er sieht seinen Betrag, Sophie nicht
    own = alex.post('/api/v1/haushalt/ordner/', {'kind': 'vertrag', 'name': 'Handy', 'cost': '20.00'}, format='json').data
    assert own['cost'] == '20.00' and own['cost_visible'] is True
    assert sophie.get(f'/api/v1/haushalt/ordner/{own["id"]}/').data['cost'] is None

    # Ältere Einträge ohne erfassende Person: nur die verwaltende Person (Admin)
    contract.created_by = None
    contract.save()
    assert sophie.get(url).data['cost'] == '89.00'
    assert alex.get(url).data['cost'] is None


# --------------------------------------------------------------------------- Abdeckung erzwingen


# Jeder View mit Detail-Adresse (…/<id>/) ist hier einer Prüfung zugeordnet. Kommt ein neuer hinzu — etwa wenn
# Organisation später Teilen bekommt —, wird dieser Test rot, bis er bewusst in die Matrix aufgenommen ist.
DETAIL_VIEW_COVERAGE = {
    'PrivateTransactionViewSet': 'DETAIL transaction', 'PrivateCategoryViewSet': 'DETAIL category',
    'MonthlyBudgetViewSet': 'DETAIL budget', 'SavingsGoalViewSet': 'DETAIL goal',
    'TransactionViewSet': 'DETAIL legacy_transaction', 'CategoryViewSet': 'DETAIL legacy_category',
    'RecurringDeductionViewSet': 'DETAIL legacy_deduction',
    'TaskViewSet': 'DETAIL household_task + org_task', 'ShoppingListViewSet': 'DETAIL shopping_list',
    'ShoppingItemViewSet': 'DETAIL shopping_item', 'FolderEntryViewSet': 'DETAIL device + contract',
    'EventViewSet': 'DETAIL event', 'NoteViewSet': 'DETAIL note', 'FileViewSet': 'DETAIL file + file_content',
    'TripViewSet': 'DETAIL trip + secret_trip', 'PackingItemViewSet': 'DETAIL packing', 'TripTaskViewSet': 'DETAIL trip_task',
    'TripEventViewSet': 'DETAIL trip_event', 'TripExpenseViewSet': 'DETAIL expense',
    'TripBudgetCategoryViewSet': 'DETAIL budget_category', 'TripParticipantViewSet': 'DETAIL participant + role test',
    'ConnectionDetailView': 'DETAIL connection + test_connections_never_reveal_a_private_target',
    'ContactDetailView': 'test_contact_rows_belong_to_their_owner',
    'InviteCancelView': 'test_contact_rows_belong_to_their_owner',
    'HouseholdMemberDetailView': 'test_role_escalation_is_rejected + test_removed_member…',
    'InvitationAcceptView': 'core/test_invitations.py (IDOR)', 'InvitationDeclineView': 'core/test_invitations.py (IDOR)',
    'InvitationRevokeView': 'core/test_invitations.py (IDOR)', 'SessionDetailView': 'core/test_sessions.py',
    'TripRemindersView': 'test_no_list_endpoint… + test_trip_overview', 'TripSavingsView': 'test_connections_never_reveal…',
}


def test_every_detail_endpoint_is_covered_by_the_matrix():
    def walk(patterns, prefix=''):
        for p in patterns:
            if hasattr(p, 'url_patterns'):
                yield from walk(p.url_patterns, prefix + str(p.pattern))
            else:
                yield prefix + str(p.pattern), p.callback

    detail_views = set()
    for route, callback in walk(get_resolver().url_patterns):
        view = getattr(callback, 'cls', None)
        if view is None or not route.startswith('api/'):
            continue
        if 'pk>' in route or '<str:sid>' in route or '<int:trip_id>' in route:
            detail_views.add(view.__name__)
    missing = detail_views - DETAIL_VIEW_COVERAGE.keys()
    assert not missing, f'Neue Detail-Endpunkte ohne Rechte-Prüfung: {sorted(missing)}'


def test_contact_rows_belong_to_their_owner(world):
    from core.models import ContactInvite

    row = Contact.objects.get(owner=world['sophie'], other=world['alex'])
    invite = ContactInvite.objects.create(inviter=world['sophie'], email='neu@example.com', token='t' * 20,
                                          expires_at=timezone.now() + timedelta(days=7))
    for who in ('alex', 'eve'):
        client = api(world[who])
        assert client.patch(f'/api/v1/contacts/{row.pk}/', {'relation': 'FAMILY'}, format='json').status_code == 404
        assert client.delete(f'/api/v1/contacts/{row.pk}/').status_code == 404
        assert client.delete(f'/api/v1/contacts/invites/{invite.pk}/').status_code == 404
    assert Contact.objects.filter(pk=row.pk, relation='FRIEND').exists() and ContactInvite.objects.filter(pk=invite.pk).exists()



# --------------------------------------------------------------------------- Nachprüfung (15.10.2026)


def test_existing_trip_rows_never_move_to_another_trip(world):
    """Ein PATCH mit fremder/anderer `trip`-ID verschiebt nichts — weder Inhalte (sonst wäre Sophies Zuständigkeit
    in Bens eigener Reise sichtbar) noch Teilnehmer (sonst säße jemand ohne Einladung in einer anderen Reise)."""
    o, today = world['objs'], timezone.localdate()
    TripParticipant.objects.filter(user=world['ben']).update(role=TripParticipant.Role.EDITOR)
    bens_trip = Trip.objects.create(owner=world['ben'], title='Bens Reise', destination='X',
                                    start_date=today + timedelta(days=3), end_date=today + timedelta(days=4))
    task = o['trip_task']
    task.assignee = world['sophie']
    task.save()
    ben = api(world['ben'])
    for name in ('packing', 'trip_task', 'trip_event', 'expense', 'budget_category'):
        url = DETAIL[name][0].format(o[name].pk)
        assert ben.patch(url, {'trip': bens_trip.pk}, format='json').status_code in (200, 400), name
        assert type(o[name]).objects.get(pk=o[name].pk).trip_id == o['trip'].pk, name
    sophies_other = o['secret_trip']
    api(world['sophie']).patch(f"/api/v1/reisen/participants/{o['participant'].pk}/", {'trip': sophies_other.pk}, format='json')
    assert TripParticipant.objects.get(pk=o['participant'].pk).trip_id == o['trip'].pk
    assert not TripParticipant.objects.filter(trip=sophies_other).exists()


def test_only_trip_owners_and_household_admins_can_invite_and_roles_are_allowlisted(world):
    from core.models import Contact

    o = world['objs']
    TripParticipant.objects.filter(user=world['ben']).update(role=TripParticipant.Role.EDITOR)
    for who, scope_type, scope_id in (('ben', 'TRIP', o['trip'].pk), ('alex', 'HOUSEHOLD', world['home'].pk)):
        contact = Contact.objects.create(owner=world[who], other=world['eve'])
        response = api(world[who]).post('/api/v1/invitations/', {'contact_id': contact.pk, 'scope_type': scope_type,
                                                                 'scope_id': scope_id}, format='json')
        assert response.status_code == 404, who
    contact = Contact.objects.get(owner=world['sophie'], other=world['alex'])
    for role in ('OWNER', 'ADMIN', 'SUPERUSER'):
        response = api(world['sophie']).post('/api/v1/invitations/', {'contact_id': contact.pk, 'scope_type': 'TRIP',
                                                                     'scope_id': o['secret_trip'].pk, 'role': role}, format='json')
        assert response.status_code == 400, role


def test_trip_scoped_suggestions_and_overviews_reveal_nothing_about_an_invisible_trip(world):
    secret = world['objs']['secret_trip'].pk
    ben = api(world['ben'])
    for method, url, body in (
        ('get', f'/api/v1/connections/suggestions/?trip={secret}', None),
        ('post', '/api/v1/connections/suggestions/accept/', {'key': f'TRIP_SAVINGS_GOAL:{secret}', 'action': 'create'}),
        ('post', '/api/v1/connections/suggestions/dismiss/', {'key': f'TRIP_SAVINGS_GOAL:{secret}'}),
        ('get', f'/api/v1/connections/link-suggestions/?object_type=TRIP&object_id={secret}', None),
        ('get', f'/api/v1/connections/reisen/{secret}/erinnerungen/', None),
        ('get', f'/api/v1/connections/reisen/{secret}/sparziel/', None),
        ('get', f'/api/v1/reisen/trips/{secret}/summary/', None),
    ):
        response = getattr(ben, method)(url, body, format='json') if body else getattr(ben, method)(url)
        assert response.status_code in (400, 404), (url, response.status_code)
        assert PRIVATE not in dump(response), url


def test_finance_reports_contain_only_the_requesting_persons_data(world):
    month = timezone.localdate().strftime('%Y-%m')
    for who in ('alex', 'ben', 'eve'):
        client = api(world[who])
        for url in (f'/api/v1/finanzen/berichte/pdf/?monat={month}', f'/api/v1/finanzen/berichte/csv/?monat={month}'):
            response = client.get(url)
            assert response.status_code < 500 and PRIVATE not in dump(response), (who, url)


# --------------------------------------------------------------------------- Restrisiken (15.10.2026)


def test_idempotent_replay_never_returns_data_after_access_was_removed(world):
    """Wiederholt jemand eine alte Anlage-Anfrage (gleicher Idempotency-Key), nachdem er aus der Reise entfernt
    wurde, gibt es keine gespeicherte Antwort mit Reisedaten mehr — sondern 404 wie bei GET."""
    o = world['objs']
    TripParticipant.objects.filter(user=world['ben']).update(role=TripParticipant.Role.EDITOR)
    ben = api(world['ben'])
    body = {'trip': o['trip'].pk, 'title': 'Taxi', 'amount': '20.00', 'date': timezone.localdate().isoformat()}
    headers = {'HTTP_IDEMPOTENCY_KEY': 'ben-taxi-0001'}
    first = ben.post('/api/v1/reisen/expenses/', body, format='json', **headers)
    assert first.status_code == 201
    again = ben.post('/api/v1/reisen/expenses/', body, format='json', **headers)
    assert again.status_code == 201 and again['Idempotent-Replay'] == 'true'  # Kontrolle: Wiederholung greift

    TripParticipant.objects.filter(user=world['ben']).delete()
    stale = ben.post('/api/v1/reisen/expenses/', body, format='json', **headers)
    assert stale.status_code == 404 and 'Taxi' not in dump(stale) and TRIP not in dump(stale)
    assert TripExpense.objects.filter(title='Taxi').count() == 1


def _invite(world, inviter, contact_owner_other, scope_type, scope):
    from core import invitations
    from core.models import Contact

    contact = Contact.objects.get_or_create(owner=world[inviter], other=world[contact_owner_other])[0]
    invitation, _ = invitations.create(world[inviter], contact_id=contact.pk, scope_type=scope_type, scope_id=scope.pk)
    return invitation


def test_invitations_and_notifications_hide_the_scope_once_rights_are_gone(world):
    """Alte Einladungen/Benachrichtigungen verraten keinen Reise- oder Haushaltsnamen mehr, sobald die Berechtigung
    dahinter weg ist: weder der eingeladenen Person (Einladende darf nicht mehr einladen) noch der einladenden
    Person (selbst entfernt) noch einer entfernten Person (frühere Annahme)."""
    from core import invitations

    o = world['objs']
    TripParticipant.objects.filter(user=world['ben']).update(role=TripParticipant.Role.OWNER)
    pending = _invite(world, 'ben', 'eve', 'TRIP', o['trip'])  # Ben (Mit-Besitzer) lädt Eve ein
    accepted = _invite(world, 'sophie', 'alex', 'TRIP', o['trip'])
    invitations.accept(world['alex'], accepted.pk)

    eve, ben, alex = api(world['eve']), api(world['ben']), api(world['alex'])
    assert TRIP in dump(eve.get('/api/v1/notifications/')) and TRIP in dump(ben.get('/api/v1/invitations/'))
    assert TRIP in dump(alex.get('/api/v1/reisen/trips/'))

    TripParticipant.objects.filter(user=world['ben']).delete()  # Ben verliert die Reise
    TripParticipant.objects.filter(user=world['alex']).delete()  # Alex auch
    for client, who in ((eve, 'eve'), (ben, 'ben'), (alex, 'alex')):
        for url in ('/api/v1/notifications/', '/api/v1/invitations/'):
            assert TRIP not in dump(client.get(url)), (who, url)
    assert eve.post(f'/api/v1/invitations/{pending.pk}/accept/').status_code in (400, 404)
    assert not TripParticipant.objects.filter(user=world['eve']).exists()
    # Kontrolle: Sophie (weiterhin Besitzerin) sieht ihre Annahme-Meldung weiterhin
    assert TRIP in dump(api(world['sophie']).get('/api/v1/notifications/'))


def test_finance_pdf_report_is_built_only_from_the_callers_own_data(world, monkeypatch):
    """Das PDF ist komprimiert — geprüft werden darum die Daten, aus denen es gebaut wird."""
    from core.households import own_household
    from finanzen import reports

    built = []
    original = reports.build_pdf

    def spy(household, period):
        built.append(json.dumps(reports._report_data(household, period), default=str, ensure_ascii=False))
        return original(household, period)

    monkeypatch.setattr(reports, 'build_pdf', spy)
    month = timezone.localdate().strftime('%Y-%m')
    for who in ('sophie', 'alex', 'ben', 'eve'):
        response = api(world[who]).get(f'/api/v1/finanzen/berichte/pdf/?monat={month}')
        assert response.status_code == 200 and response.content.startswith(b'%PDF'), who
        assert (PRIVATE in built[-1]) == (who == 'sophie'), who  # Kontrolle: Sophies eigener Bericht enthält sie
    assert own_household(world['alex']) != world['home']


# --------------------------------------------------------------------------- Sharing: Beziehung ≠ Berechtigung


def test_relationship_and_pending_invitation_grant_no_access(world):
    """Familie/Freund:in ist nur eine soziale Beziehung, eine offene Einladung nur ein Angebot: Eve — Familie von
    Sophie und zu Haushalt und Geheimreise eingeladen — sieht keine Daten daraus, bis sie annimmt; danach genau
    diesen einen Bereich (Haushalt ohne Finanzen/Organisation, Reise ohne andere Reisen)."""
    from core import invitations
    from core.models import Contact

    o = world['objs']
    Contact.objects.create(owner=world['sophie'], other=world['eve'], relation='FAMILY')
    Contact.objects.create(owner=world['eve'], other=world['sophie'], relation='FAMILY')
    trip_inv = _invite(world, 'sophie', 'eve', 'TRIP', o['secret_trip'])
    home_inv = _invite(world, 'sophie', 'eve', 'HOUSEHOLD', world['home'])
    eve = api(world['eve'])

    def seen():
        return {m for m in (PRIVATE, HOUSEHOLD, TRIP) for url in LIST_ENDPOINTS
                if url not in ('/api/v1/invitations/', '/api/v1/notifications/') and m in dump(eve.get(url))}

    assert seen() == set()
    assert eve.get(DETAIL['secret_trip'][0].format(o['secret_trip'].pk)).status_code == 404

    invitations.accept(world['eve'], trip_inv.pk)
    assert eve.get(DETAIL['secret_trip'][0].format(o['secret_trip'].pk)).status_code == 200
    assert eve.get(DETAIL['trip'][0].format(o['trip'].pk)).status_code == 404  # andere Reise bleibt zu
    for name in ('transaction', 'goal', 'note', 'event', 'household_task'):
        assert eve.get(DETAIL[name][0].format(o[name].pk)).status_code == 404, name

    invitations.accept(world['eve'], home_inv.pk)
    assert eve.get(DETAIL['household_task'][0].format(o['household_task'].pk)).status_code == 200
    for name in ('transaction', 'goal', 'budget', 'note', 'event', 'file', 'legacy_transaction', 'connection'):
        assert eve.get(DETAIL[name][0].format(o[name].pk)).status_code == 404, name
    assert TripParticipant.objects.filter(user=world['eve']).count() == 1
    assert HouseholdMembership.objects.filter(user=world['eve'], household=world['home']).count() == 1


# --------------------------------------------------------------------------- Connection Engine (Beta-Gate)


def test_shared_trip_never_reveals_a_participants_private_organisation_task(world):
    """Ben (Bearbeiter von „Berlin“) verknüpft die Reise mit SEINER privaten Aufgabe. Sophie besitzt die Reise, sieht
    die Aufgabe aber nirgends — weder als Verbindung noch in Erinnerungen, Startseite, Suche oder Vorschlägen; und
    umgekehrt sieht Ben Sophies private Aufgabe an derselben Reise nicht."""
    o = world['objs']
    TripParticipant.objects.filter(user=world['ben']).update(role=TripParticipant.Role.EDITOR)
    bens = PersonalTask.objects.create(owner=world['ben'], title='BENPRIVAT-Visum', due_date=o['trip'].start_date)
    ben, sophie = api(world['ben']), api(world['sophie'])
    created = ben.post('/api/v1/connections/', {'source_type': 'TASK', 'source_id': bens.pk, 'target_type': 'TRIP',
                                                'target_id': o['trip'].pk}, format='json')
    assert created.status_code == 201
    mine = sophie.post('/api/v1/connections/', {'source_type': 'TRIP', 'source_id': o['trip'].pk, 'target_type': 'TASK',
                                                'target_id': o['org_task'].pk}, format='json')
    assert mine.status_code == 201

    trip_q = f'?object_type=TRIP&object_id={o["trip"].pk}'
    assert 'BENPRIVAT' in dump(ben.get('/api/v1/connections/' + trip_q))  # Kontrolle
    for url in ['/api/v1/connections/' + trip_q, f'/api/v1/connections/reisen/{o["trip"].pk}/erinnerungen/',
                '/api/v1/today/', f'/api/v1/connections/suggestions/?trip={o["trip"].pk}',
                '/api/v1/connections/link-suggestions/' + trip_q] + [u + '?q=BENPRIVAT' for u in LIST_ENDPOINTS]:
        assert 'BENPRIVAT' not in dump(sophie.get(url)), url
    listed = sophie.get('/api/v1/connections/' + trip_q).data
    ids = [c['id'] for c in listed]
    assert mine.data['id'] in ids and created.data['id'] not in ids  # auch keine ID/Typ-Spur der fremden Verbindung
    assert all(side.get('type') != 'TASK' or side.get('id') != bens.pk for c in listed for side in c.values() if isinstance(side, dict))
    assert sophie.get(f'/api/v1/connections/{created.data["id"]}/').status_code == 404
    assert sophie.delete(f'/api/v1/connections/{created.data["id"]}/').status_code == 404
    assert PRIVATE not in dump(ben.get('/api/v1/connections/' + trip_q))
    assert ben.get(f'/api/v1/connections/{mine.data["id"]}/').status_code == 404


def test_revoked_trip_access_hides_the_connection_immediately(world):
    o = world['objs']
    TripParticipant.objects.filter(user=world['ben']).update(role=TripParticipant.Role.EDITOR)
    bens = PersonalTask.objects.create(owner=world['ben'], title='Bens Aufgabe')
    ben = api(world['ben'])
    connection = ben.post('/api/v1/connections/', {'source_type': 'TASK', 'source_id': bens.pk, 'target_type': 'TRIP',
                                                   'target_id': o['trip'].pk}, format='json').data
    task_q = f'/api/v1/connections/?object_type=TASK&object_id={bens.pk}'
    assert TRIP in dump(ben.get(task_q))

    TripParticipant.objects.filter(user=world['ben']).delete()
    assert dump(ben.get(task_q)) == '[]'  # weder Reise-Titel noch „1 verborgene Verbindung“
    assert ben.get(f'/api/v1/connections/{connection["id"]}/').status_code == 404
    assert ben.delete(f'/api/v1/connections/{connection["id"]}/').status_code == 404
    # Die Aufgabe selbst bleibt unverändert; die Reise auch.
    assert PersonalTask.objects.filter(pk=bens.pk).exists() and Trip.objects.filter(pk=o['trip'].pk).exists()


def test_reverse_concurrent_create_ends_in_one_connection_without_500(world, monkeypatch):
    """A→B und gleichzeitig B→A: beide werden auf dieselbe gespeicherte Richtung abgebildet; die zweite scheitert
    sauber (409) am Unique-Constraint statt als 500."""
    o = world['objs']
    sophie = api(world['sophie'])
    real_create = Connection.objects.create

    def racing_create(**kwargs):
        real_create(**kwargs)  # die gleichzeitige Gegenrichtungs-Anfrage war schneller
        return real_create(**kwargs)

    monkeypatch.setattr(Connection.objects, 'create', racing_create)
    response = sophie.post('/api/v1/connections/', {'source_type': 'TASK', 'source_id': o['org_task'].pk,
                                                    'target_type': 'TRIP', 'target_id': o['secret_trip'].pk}, format='json')
    assert response.status_code == 409
    monkeypatch.undo()
    first = sophie.post('/api/v1/connections/', {'source_type': 'TRIP', 'source_id': o['secret_trip'].pk,
                                                 'target_type': 'TASK', 'target_id': o['org_task'].pk}, format='json')
    second = sophie.post('/api/v1/connections/', {'source_type': 'TASK', 'source_id': o['org_task'].pk,
                                                  'target_type': 'TRIP', 'target_id': o['secret_trip'].pk}, format='json')
    assert (first.status_code, second.status_code) == (201, 409)
    assert Connection.objects.filter(created_by=world['sophie'], source_type='TRIP', source_id=o['secret_trip'].pk).count() == 1


def test_connections_are_only_ever_created_through_the_engine():
    """Kein zweiter, ungeprüfter Weg: außerhalb von connections/services.py legt kein Produktcode eine Connection an
    (Vorschläge rufen services.create_connection auf und erben damit alle Prüfungen)."""
    import pathlib
    import re

    root = pathlib.Path(__file__).resolve().parents[1]
    pattern = re.compile(r'Connection\.objects\.(create|bulk_create|get_or_create|update_or_create)\(|(?<!class )\bConnection\(')
    offenders = []
    for path in root.rglob('*.py'):
        rel = path.relative_to(root).as_posix()
        if rel.startswith(('.venv/', 'venv/')) or '/migrations/' in rel or '/tests/' in rel or path.name.startswith('test_'):
            continue
        if rel == 'connections/services.py':
            continue
        if pattern.search(path.read_text(encoding='utf-8')):
            offenders.append(rel)
    assert offenders == []


def test_connection_listing_needs_one_query_per_object_type_regardless_of_count(world):
    """1 Abfrage für die Verbindungen + 1 je beteiligtem Typ (Sichtbarkeit, Ausgangsobjekt und Löschrecht in
    derselben Abfrage). Mehr Verbindungen ändern daran nichts — und Rechte gelten weiter beidseitig."""
    from django.db import connection as db
    from django.test.utils import CaptureQueriesContext

    o, sophie = world['objs'], world['sophie']
    trip = o['trip']
    url = f'/api/v1/connections/?object_type=TRIP&object_id={trip.pk}'
    client = api(sophie)

    def add(n):
        for i in range(n):
            task = PersonalTask.objects.create(owner=sophie, title=f'Aufgabe {i}')
            event = PersonalEvent.objects.create(owner=sophie, title=f'Termin {i}', starts_at=timezone.now())
            Connection.objects.create(source_type='TRIP', source_id=trip.pk, target_type='TASK', target_id=task.pk,
                                      created_by=world['ben'])
            Connection.objects.create(source_type='TRIP', source_id=trip.pk, target_type='CALENDAR_EVENT',
                                      target_id=event.pk, created_by=world['ben'])

    counts = []
    for n in (1, 10):
        add(n)
        with CaptureQueriesContext(db) as ctx:
            response = client.get(url)
        assert response.status_code == 200
        counts.append(len(ctx.captured_queries))
    assert counts[0] == counts[1] == 5  # Verbindungen, Reise, Aufgabe, Termin, Sparziel
    items = client.get(url).data
    assert len(items) == 23 and all(item['can_delete'] for item in items)  # Sophie besitzt beide Seiten
    # Ben (Betrachter) sieht keine davon (private Gegenseiten) und darf sie nicht löschen
    TripParticipant.objects.filter(user=world['ben']).update(role=TripParticipant.Role.VIEWER)
    assert api(world['ben']).get(url).data == []
