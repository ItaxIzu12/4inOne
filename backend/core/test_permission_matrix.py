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

