import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from core.models import Contact, Household, HouseholdMembership
from finanzen.models import Account, Category, Transaction
from reisen.models import PackingItem, Trip, TripBudgetCategory, TripEvent, TripExpense, TripParticipant, TripTask

pytestmark = pytest.mark.django_db
BASE = '/api/v1/reisen/'


@pytest.fixture
def users():
    return [get_user_model().objects.create_user(username=name, password='test-secret-234') for name in ['alice', 'bob']]


@pytest.fixture
def client(users):
    client = APIClient()
    client.force_authenticate(users[0])
    return client


def make_trip(owner, **kwargs):
    kwargs.setdefault('start_date', '2026-10-10')
    kwargs.setdefault('end_date', '2026-10-12')
    return Trip.objects.create(owner=owner, **kwargs)


def test_trip_crud_and_owner_spoofing(client, users):
    response = client.post(
        BASE + 'trips/',
        {'title': 'Berlin Wochenende', 'start_date': '2026-10-10', 'end_date': '2026-10-12', 'owner': users[1].pk},
        format='json',
    )
    assert response.status_code == 201
    pk = response.data['id']
    assert Trip.objects.get(pk=pk).owner == users[0]
    assert client.get(BASE + 'trips/').data[0]['id'] == pk
    assert client.patch(f'{BASE}trips/{pk}/', {'title': 'Geändert'}, format='json').status_code == 200

    client.force_authenticate(users[1])
    assert client.get(BASE + 'trips/').data == []
    for method in ['get', 'patch', 'put', 'delete']:
        response = getattr(client, method)(f'{BASE}trips/{pk}/', {'title': 'x'}, format='json')
        assert response.status_code == 404

    client.force_authenticate(users[0])
    assert client.delete(f'{BASE}trips/{pk}/').status_code == 204
    assert not Trip.objects.filter(pk=pk).exists()


def test_trip_validation(client):
    dates = {'start_date': '2026-09-24', 'end_date': '2026-09-26'}
    assert client.post(BASE + 'trips/', {'title': ' ', **dates}, format='json').status_code == 400
    assert client.post(BASE + 'trips/', {'title': 'x', 'status': 'INVALID', **dates}, format='json').status_code == 400
    assert client.post(BASE + 'trips/', {'title': 'x', 'budget_amount': '-1', **dates}, format='json').status_code == 400
    r = client.post(
        BASE + 'trips/', {'title': 'x', 'start_date': '2026-09-24', 'end_date': '2026-09-20'}, format='json'
    )
    assert r.status_code == 400


def test_trip_requires_start_and_end_date(client):
    # Eine Reise ohne konkreten Zeitraum wird in V1 nicht als Trip gespeichert (siehe Trip-Docstring)
    # — "Reiseideen" ohne Termin sind ein eigenes, hier noch nicht gebautes Konzept.
    assert client.post(BASE + 'trips/', {'title': 'x', 'end_date': '2026-09-26'}, format='json').status_code == 400
    assert client.post(BASE + 'trips/', {'title': 'x', 'start_date': '2026-09-24'}, format='json').status_code == 400
    r = client.post(BASE + 'trips/', {'title': 'x', 'start_date': '2026-09-24', 'end_date': '2026-09-26'}, format='json')
    assert r.status_code == 201
    # Auch beim Bearbeiten lässt sich das Datum nicht wieder entfernen.
    assert client.patch(f"{BASE}trips/{r.data['id']}/", {'start_date': None}, format='json').status_code == 400

    # Ein leerer String ist ebenfalls kein gültiges Datum — weder beim Anlegen noch beim Bearbeiten.
    assert client.post(BASE + 'trips/', {'title': 'x', 'start_date': '', 'end_date': '2026-09-26'}, format='json').status_code == 400
    assert client.post(BASE + 'trips/', {'title': 'x', 'start_date': '2026-09-24', 'end_date': ''}, format='json').status_code == 400
    assert client.patch(f"{BASE}trips/{r.data['id']}/", {'start_date': ''}, format='json').status_code == 400
    assert client.patch(f"{BASE}trips/{r.data['id']}/", {'end_date': ''}, format='json').status_code == 400


def test_trip_setup_fields_are_optional_but_usable(client):
    # Ohne Angabe: Reisen funktioniert nur mit Ziel/Start/Ende (siehe AGENTS.md "nicht alles erzwingen").
    minimal = client.post(BASE + 'trips/', {'title': 'x', 'start_date': '2026-09-24', 'end_date': '2026-09-26'}, format='json')
    assert minimal.status_code == 201
    assert minimal.data['travel_type'] == ''
    assert minimal.data['transport_type'] == ''
    assert minimal.data['baggage_type'] == ''

    full = client.post(
        BASE + 'trips/',
        {
            'title': 'Flug nach Rom', 'start_date': '2026-09-24', 'end_date': '2026-09-26',
            'travel_type': 'BUSINESS', 'transport_type': 'FLIGHT', 'baggage_type': 'HAND_LUGGAGE',
        },
        format='json',
    )
    assert full.status_code == 201
    assert full.data['travel_type'] == 'BUSINESS'
    assert full.data['transport_type'] == 'FLIGHT'
    assert full.data['baggage_type'] == 'HAND_LUGGAGE'

    assert client.post(BASE + 'trips/', {'title': 'x', 'start_date': '2026-09-24', 'end_date': '2026-09-26', 'travel_type': 'NOPE'}, format='json').status_code == 400


@pytest.mark.parametrize(
    'resource,payload',
    [
        ('packing-items', {'title': 'Zahnbürste'}),
        ('tasks', {'title': 'Koffer packen'}),
        ('events', {'title': 'Flug', 'starts_at': '2026-09-24T10:00:00+02:00'}),
        ('expenses', {'title': 'Hotel', 'amount': '120.00', 'date': '2026-09-24'}),
        ('budget-categories', {'category': 'TRANSPORT', 'planned_amount': '500.00'}),
    ],
)
def test_trip_scoped_crud_and_isolation(client, users, resource, payload):
    trip = make_trip(users[0], title='Berlin Wochenende')
    other_trip = make_trip(users[1], title='Fremde Reise')

    # Man kann keinen Eintrag an eine fremde Reise hängen, obwohl man die ID kennt.
    response = client.post(BASE + resource + '/', {**payload, 'trip': other_trip.pk}, format='json')
    assert response.status_code == 400

    response = client.post(BASE + resource + '/', {**payload, 'trip': trip.pk}, format='json')
    assert response.status_code == 201
    pk = response.data['id']

    assert client.get(BASE + resource + '/').data[0]['id'] == pk
    assert client.get(f'{BASE}{resource}/?trip={trip.pk}').data[0]['id'] == pk
    assert client.get(f'{BASE}{resource}/?trip={other_trip.pk}').data == []

    client.force_authenticate(users[1])
    assert client.get(BASE + resource + '/').data == []
    assert client.get(f'{BASE}{resource}/{pk}/').status_code == 404

    client.force_authenticate(users[0])
    assert client.delete(f'{BASE}{resource}/{pk}/').status_code == 204


def test_packing_item_category_and_note(client, users):
    trip = make_trip(users[0], title='Berlin Wochenende')
    # Ohne Angabe: Sonstiges statt eines leeren Werts — jeder Artikel gehört zu genau einer Kategorie.
    default = client.post(BASE + 'packing-items/', {'title': 'Regenschirm', 'trip': trip.pk}, format='json')
    assert default.status_code == 201
    assert default.data['category'] == 'SONSTIGES'
    assert default.data['note'] == ''

    full = client.post(
        BASE + 'packing-items/',
        {'title': 'Ladekabel', 'trip': trip.pk, 'category': 'TECHNIK', 'note': 'USB-C, nicht das alte', 'quantity': 2},
        format='json',
    )
    assert full.status_code == 201
    assert full.data['category'] == 'TECHNIK'
    assert full.data['note'] == 'USB-C, nicht das alte'

    assert client.post(BASE + 'packing-items/', {'title': 'x', 'trip': trip.pk, 'category': 'STRAND'}, format='json').status_code == 400


def test_trip_task_note_and_status_transitions(client, users):
    trip = make_trip(users[0], title='Berlin Wochenende')
    created = client.post(BASE + 'tasks/', {'title': 'Koffer packen', 'trip': trip.pk, 'note': 'Nicht vergessen: Regenschirm'}, format='json')
    assert created.status_code == 201
    assert created.data['status'] == 'OPEN'
    assert created.data['note'] == 'Nicht vergessen: Regenschirm'

    url = f"{BASE}tasks/{created.data['id']}/"
    # Erledigen …
    done = client.patch(url, {'status': 'DONE'}, format='json')
    assert done.status_code == 200
    assert done.data['status'] == 'DONE'
    # … und wieder öffnen — nichts bleibt fälschlich als erledigt stehen.
    reopened = client.patch(url, {'status': 'OPEN'}, format='json')
    assert reopened.status_code == 200
    assert reopened.data['status'] == 'OPEN'

    assert client.post(BASE + 'tasks/', {'title': 'x', 'trip': trip.pk, 'status': 'INVALID'}, format='json').status_code == 400


def test_deleting_a_trip_removes_its_tasks_and_packing_items_too(client, users):
    trip = make_trip(users[0], title='Berlin Wochenende')
    task = TripTask.objects.create(trip=trip, title='Koffer packen')
    item = PackingItem.objects.create(trip=trip, title='Zahnbürste')

    assert client.delete(f'{BASE}trips/{trip.pk}/').status_code == 204
    assert not TripTask.objects.filter(pk=task.pk).exists()
    assert not PackingItem.objects.filter(pk=item.pk).exists()


def test_trip_without_a_budget_has_no_amount_and_defaults_to_euro(client):
    # "kein Budget": eine Reise funktioniert vollständig ohne jede Budgetangabe.
    r = client.post(BASE + 'trips/', {'title': 'x', 'start_date': '2026-09-24', 'end_date': '2026-09-26'}, format='json')
    assert r.status_code == 201
    assert r.data['budget_amount'] is None
    assert r.data['currency'] == 'EUR'


def test_trip_budget_amount_and_currency_can_be_set_and_edited(client):
    dates = {'start_date': '2026-09-24', 'end_date': '2026-09-26'}
    r = client.post(BASE + 'trips/', {'title': 'USA-Reise', 'budget_amount': '1500.50', 'currency': 'USD', **dates}, format='json')
    assert r.status_code == 201
    # Decimal, kein Float: der Betrag kommt als exakter String zurück, nicht als gerundete/ungenaue Fließkommazahl.
    assert r.data['budget_amount'] == '1500.50'
    assert r.data['currency'] == 'USD'

    edited = client.patch(f"{BASE}trips/{r.data['id']}/", {'budget_amount': '1800.00', 'currency': 'CHF'}, format='json')
    assert edited.status_code == 200
    assert edited.data['budget_amount'] == '1800.00'
    assert edited.data['currency'] == 'CHF'

    assert client.post(BASE + 'trips/', {'title': 'x', 'currency': 'YEN', **dates}, format='json').status_code == 400
    assert client.post(BASE + 'trips/', {'title': 'x', 'budget_amount': '-5', **dates}, format='json').status_code == 400


def test_trip_budget_categories_planned_amounts_are_decimal_and_unique_per_trip(client, users):
    trip = make_trip(users[0], title='Berlin Wochenende')
    transport = client.post(BASE + 'budget-categories/', {'trip': trip.pk, 'category': 'TRANSPORT', 'planned_amount': '500.00'}, format='json')
    assert transport.status_code == 201
    assert transport.data['planned_amount'] == '500.00'  # Decimal als exakter String, kein Float.

    unterkunft = client.post(BASE + 'budget-categories/', {'trip': trip.pk, 'category': 'UNTERKUNFT', 'planned_amount': '400.00'}, format='json')
    assert unterkunft.status_code == 201

    # Höchstens eine geplante Summe je Kategorie und Reise — eine zweite "Transport"-Zeile ergibt keinen Sinn.
    duplicate = client.post(BASE + 'budget-categories/', {'trip': trip.pk, 'category': 'TRANSPORT', 'planned_amount': '100.00'}, format='json')
    assert duplicate.status_code == 400

    assert client.post(BASE + 'budget-categories/', {'trip': trip.pk, 'category': 'TRANSPORT', 'planned_amount': '-1'}, format='json').status_code == 400
    assert client.post(BASE + 'budget-categories/', {'trip': trip.pk, 'category': 'FLUGHAFEN', 'planned_amount': '1'}, format='json').status_code == 400

    # Bearbeiten des geplanten Betrags einer bestehenden Kategorie.
    updated = client.patch(f"{BASE}budget-categories/{transport.data['id']}/", {'planned_amount': '600.00'}, format='json')
    assert updated.status_code == 200
    assert updated.data['planned_amount'] == '600.00'

    listed = client.get(f'{BASE}budget-categories/?trip={trip.pk}').data
    assert {row['category'] for row in listed} == {'TRANSPORT', 'UNTERKUNFT'}


def test_shared_trip_budget_never_leaks_into_or_out_of_private_finances(client, users):
    """"Gemeinsame Reise ohne Finanzleak": ein Reisebudget ist unabhängig vom privaten Finanzkonto — es gibt
    keine Verbindung zu core/finanzen-Modellen, und ein zweiter Nutzer sieht auch mit bekannter ID nichts davon
    (echte Teilnehmer/Sharing existieren noch nicht, siehe Trip-Docstring — die Isolation ist die volle
    Absicherung, die es in V1 dafür braucht)."""
    trip = make_trip(users[0], title='Berlin Wochenende', budget_amount='1500.00')
    category = TripBudgetCategory.objects.create(trip=trip, category='TRANSPORT', planned_amount='500.00')

    # reisen-Models referenzieren keine Finanzen-Models — kein FK, keine Kopplung.
    reisen_fields = {f.name: f for f in Trip._meta.get_fields()} | {f.name: f for f in TripBudgetCategory._meta.get_fields()}
    for field in reisen_fields.values():
        related_model = getattr(field, 'related_model', None)
        if related_model is not None:
            assert related_model.__module__.split('.')[0] != 'finanzen'

    client.force_authenticate(users[1])
    assert client.get(f'{BASE}trips/{trip.pk}/').status_code == 404
    assert client.get(f'{BASE}budget-categories/{category.pk}/').status_code == 404
    assert client.get(f'{BASE}budget-categories/?trip={trip.pk}').data == []


def test_sharing_a_trip_grants_no_access_to_the_owners_finanzen_or_haushalt_data(client, users):
    """Teilnahme an EINER Reise darf keine anderen privaten 4inOne-Daten freischalten (AGENTS.md
    Privacy-Prinzipien) — hier konkret geprüft gegen echte Finanzen-/Haushalt-Modelle, nicht nur per
    Feld-Introspektion wie test_shared_trip_budget_never_leaks_into_or_out_of_private_finances oben."""
    household = Household.objects.create(name='Alices Haushalt')
    HouseholdMembership.objects.create(user=users[0], household=household)
    account = Account.objects.create(household=household, name='Girokonto')
    category = Category.objects.get(household=household, name='Fixkosten')
    Transaction.objects.create(account=account, category=category, amount='42.00', datum='2026-10-05', created_by=users[0])

    trip = make_trip(users[0], title='Gemeinsame Reise')
    Contact.objects.create(owner=users[0], other=users[1])
    contact = Contact.objects.get(owner=users[0], other=users[1])
    added = client.post(BASE + 'participants/', {'trip': trip.pk, 'contact_id': contact.pk, 'role': 'EDITOR'}, format='json')
    assert added.status_code == 201

    client.force_authenticate(users[1])
    # Als Reiseteilnehmer trotzdem kein Haushaltsmitglied — die Reise hat daran nichts geändert.
    assert not HouseholdMembership.objects.filter(user=users[1]).exists()
    overview = client.get('/api/v1/finanzen/uebersicht/')
    assert overview.status_code == 200
    assert overview.data['member_count'] == 1
    assert overview.data['household_name'] == ''
    assert overview.data['has_transaction'] is False


def test_trip_scoped_validation(client, users):
    trip = make_trip(users[0], title='Berlin Wochenende')
    assert client.post(BASE + 'events/', {'title': 'x', 'trip': trip.pk}, format='json').status_code == 400
    assert client.post(
        BASE + 'events/',
        {'title': 'x', 'trip': trip.pk, 'starts_at': '2026-09-24T10:00:00Z', 'ends_at': '2026-09-24T09:00:00Z'},
        format='json',
    ).status_code == 400
    assert client.post(
        BASE + 'expenses/', {'title': 'x', 'trip': trip.pk, 'amount': '-5', 'date': '2026-09-24'}, format='json'
    ).status_code == 400


def test_trip_summary_fields(client, users):
    trip = make_trip(users[0], title='Berlin Wochenende', budget_amount='200.00')
    PackingItem.objects.create(trip=trip, title='Zahnbürste', is_packed=True)
    PackingItem.objects.create(trip=trip, title='Kamm')
    TripTask.objects.create(trip=trip, title='Koffer packen')
    TripTask.objects.create(trip=trip, title='Ticket kaufen', status=TripTask.Status.DONE)
    TripEvent.objects.create(trip=trip, title='Flug', starts_at='2026-09-24T10:00:00Z')
    TripExpense.objects.create(trip=trip, title='Hotel', amount='80.00', date='2026-09-24')

    data = client.get(f'{BASE}trips/{trip.pk}/').data
    assert data['packing_total'] == 2
    assert data['packing_packed'] == 1
    assert data['tasks_total'] == 2
    assert data['tasks_open'] == 1
    assert data['events_count'] == 1
    assert data['budget_spent'] == '80.00'


@pytest.mark.parametrize('resource', ['trips', 'packing-items', 'tasks', 'events', 'expenses'])
def test_requires_login(resource):
    assert APIClient().get(BASE + resource + '/').status_code == 401


def test_overlap_detection_only_within_same_owner(client, users):
    mine = Trip.objects.create(owner=users[0], title='Berlin Wochenende', start_date='2026-10-10', end_date='2026-10-30')
    Trip.objects.create(owner=users[1], title='Fremde Reise', start_date='2026-10-15', end_date='2026-10-20')

    # Überschneidung: existing.start <= new.end UND existing.end >= new.start
    overlapping = client.get(f'{BASE}trips/overlaps/?start_date=2026-10-23&end_date=2026-11-14').data
    assert [o['id'] for o in overlapping] == [mine.id]

    # Keine Überschneidung mit einer fremden Reise, obwohl der Zeitraum passt.
    client.force_authenticate(users[1])
    none_found = client.get(f'{BASE}trips/overlaps/?start_date=2026-10-23&end_date=2026-11-14').data
    assert none_found == []


def test_overlap_detection_excludes_self(client, users):
    trip = Trip.objects.create(owner=users[0], title='Berlin Wochenende', start_date='2026-10-10', end_date='2026-10-30')

    # Beim Bearbeiten vergleicht sich die Reise nicht mit sich selbst.
    assert client.get(f'{BASE}trips/overlaps/?start_date=2026-10-10&end_date=2026-10-30&exclude={trip.id}').data == []
    assert client.get(f'{BASE}trips/overlaps/?start_date=2026-10-10&end_date=2026-10-30').data[0]['id'] == trip.id


@pytest.mark.parametrize('params', ['', 'start_date=2026-10-10', 'start_date=nope&end_date=2026-10-10'])
def test_overlap_detection_needs_both_valid_dates(client, params):
    assert client.get(f'{BASE}trips/overlaps/?{params}').data == []


# ==================================================================================================
# Teilnehmer & Sharing
# ==================================================================================================


def test_solo_trip_gets_its_creator_as_sole_participant_automatically(client, users):
    # Keine Pflicht, vorher eine Gruppe oder einen Haushalt anzulegen — eine Solo-Reise ist sofort vollständig.
    r = client.post(BASE + 'trips/', {'title': 'Solo-Trip', 'start_date': '2026-10-10', 'end_date': '2026-10-12'}, format='json')
    assert r.status_code == 201
    assert r.data['my_role'] == 'OWNER'
    assert len(r.data['participants']) == 1
    assert r.data['participants'][0]['role'] == 'OWNER'
    assert TripParticipant.objects.filter(trip_id=r.data['id'], user=users[0], role='OWNER').count() == 1


def test_sharing_a_trip_only_works_via_an_existing_contact(client, users):
    trip = make_trip(users[0], title='Paarreise')
    # Ohne bestehenden Kontakt lässt sich niemand hinzufügen — kein Endpunkt, der beliebige Nutzer:innen anhand
    # roher IDs/E-Mails findet (User-Enumeration).
    blind = client.post(BASE + 'participants/', {'trip': trip.pk, 'user': users[1].pk, 'role': 'EDITOR'}, format='json')
    assert blind.status_code in (400, 404)
    assert not TripParticipant.objects.filter(trip=trip, user=users[1]).exists()

    Contact.objects.create(owner=users[0], other=users[1], relation=Contact.Relation.FRIEND)
    contact = Contact.objects.get(owner=users[0], other=users[1])
    shared = client.post(BASE + 'participants/', {'trip': trip.pk, 'contact_id': contact.pk, 'role': 'EDITOR'}, format='json')
    assert shared.status_code == 201
    assert shared.data['role'] == 'EDITOR'
    assert 'display_name' in shared.data and 'email' not in shared.data  # kein voller Profil-/Kontaktdatenleak


def test_adding_the_same_contact_twice_is_a_clean_400_not_a_server_error(client, users):
    trip = make_trip(users[0], title='Doppelt')
    Contact.objects.create(owner=users[0], other=users[1])
    contact = Contact.objects.get(owner=users[0], other=users[1])
    first = client.post(BASE + 'participants/', {'trip': trip.pk, 'contact_id': contact.pk, 'role': 'VIEWER'}, format='json')
    assert first.status_code == 201
    second = client.post(BASE + 'participants/', {'trip': trip.pk, 'contact_id': contact.pk, 'role': 'EDITOR'}, format='json')
    assert second.status_code == 400


def test_user_without_any_relation_to_a_trip_gets_404_everywhere(client, users):
    trip = make_trip(users[0], title='Privat')
    PackingItem.objects.create(trip=trip, title='Zahnbürste')

    client.force_authenticate(users[1])
    assert client.get(f'{BASE}trips/{trip.pk}/').status_code == 404
    assert client.get(f'{BASE}trips/').data == []
    assert client.get(f'{BASE}packing-items/?trip={trip.pk}').data == []
    assert client.patch(f'{BASE}trips/{trip.pk}/', {'title': 'x'}, format='json').status_code == 404
    assert client.delete(f'{BASE}trips/{trip.pk}/').status_code == 404


def test_viewer_participant_can_read_a_shared_trip_but_not_write_to_it(client, users):
    trip = make_trip(users[0], title='Familienreise')
    Contact.objects.create(owner=users[0], other=users[1])
    contact = Contact.objects.get(owner=users[0], other=users[1])
    client.post(BASE + 'participants/', {'trip': trip.pk, 'contact_id': contact.pk, 'role': 'VIEWER'}, format='json')

    client.force_authenticate(users[1])
    assert client.get(f'{BASE}trips/{trip.pk}/').status_code == 200
    assert client.get(f'{BASE}trips/{trip.pk}/').data['my_role'] == 'VIEWER'
    assert client.get(f'{BASE}packing-items/?trip={trip.pk}').status_code == 200

    # Lesen ja, verändern nein.
    assert client.patch(f'{BASE}trips/{trip.pk}/', {'title': 'x'}, format='json').status_code == 403
    assert client.post(BASE + 'packing-items/', {'trip': trip.pk, 'title': 'x'}, format='json').status_code == 400
    assert client.post(BASE + 'tasks/', {'trip': trip.pk, 'title': 'x'}, format='json').status_code == 400
    assert client.post(
        BASE + 'budget-categories/', {'trip': trip.pk, 'category': 'TRANSPORT', 'planned_amount': '10'}, format='json'
    ).status_code == 400


def test_editor_participant_can_edit_content_but_not_manage_the_trip_or_its_participants(client, users):
    trip = make_trip(users[0], title='Freundesreise')
    Contact.objects.create(owner=users[0], other=users[1])
    contact = Contact.objects.get(owner=users[0], other=users[1])
    client.post(BASE + 'participants/', {'trip': trip.pk, 'contact_id': contact.pk, 'role': 'EDITOR'}, format='json')

    client.force_authenticate(users[1])
    item = client.post(BASE + 'packing-items/', {'trip': trip.pk, 'title': 'Zahnbürste'}, format='json')
    assert item.status_code == 201
    assert client.patch(f"{BASE}packing-items/{item.data['id']}/", {'is_packed': True}, format='json').status_code == 200

    # Die Reise selbst bearbeiten oder Teilnehmer verwalten darf ein EDITOR nicht.
    assert client.patch(f'{BASE}trips/{trip.pk}/', {'title': 'x'}, format='json').status_code == 403
    Contact.objects.create(owner=users[1], other=users[0])  # beliebiger weiterer Kontakt, nur um die ID zu haben
    assert client.post(
        BASE + 'participants/', {'trip': trip.pk, 'contact_id': Contact.objects.get(owner=users[1]).pk, 'role': 'VIEWER'}, format='json'
    ).status_code in (400, 403)


def test_owner_role_participant_can_manage_the_trip_and_its_participants_like_the_creator(client, users):
    users_extra = get_user_model().objects.create_user(username='carla', password='test-secret-234')
    trip = make_trip(users[0], title='Gruppenreise')
    Contact.objects.create(owner=users[0], other=users[1])
    contact_bob = Contact.objects.get(owner=users[0], other=users[1])
    client.post(BASE + 'participants/', {'trip': trip.pk, 'contact_id': contact_bob.pk, 'role': 'OWNER'}, format='json')

    client.force_authenticate(users[1])
    assert client.patch(f'{BASE}trips/{trip.pk}/', {'title': 'Umbenannt'}, format='json').status_code == 200

    Contact.objects.create(owner=users[1], other=users_extra)
    contact_carla = Contact.objects.get(owner=users[1], other=users_extra)
    added = client.post(BASE + 'participants/', {'trip': trip.pk, 'contact_id': contact_carla.pk, 'role': 'VIEWER'}, format='json')
    assert added.status_code == 201


def test_owner_role_participant_can_demote_themselves_and_then_loses_manage_rights(client, users):
    trip = make_trip(users[0], title='Gemeinsam verwaltet')
    Contact.objects.create(owner=users[0], other=users[1])
    contact_bob = Contact.objects.get(owner=users[0], other=users[1])
    bob_participant = client.post(BASE + 'participants/', {'trip': trip.pk, 'contact_id': contact_bob.pk, 'role': 'OWNER'}, format='json')

    # Ein OWNER-Teilnehmer (nicht der Ersteller) darf sich selbst herabstufen …
    client.force_authenticate(users[1])
    demoted = client.patch(f"{BASE}participants/{bob_participant.data['id']}/", {'role': 'EDITOR'}, format='json')
    assert demoted.status_code == 200
    assert demoted.data['role'] == 'EDITOR'

    # … verliert dadurch aber sofort die Verwaltungsrechte: die Reise selbst bearbeiten …
    assert client.patch(f'{BASE}trips/{trip.pk}/', {'title': 'x'}, format='json').status_code == 403
    # … und weitere Teilnehmer verwalten (hier: die eigene Rolle noch einmal ändern) geht nicht mehr.
    assert client.patch(f"{BASE}participants/{bob_participant.data['id']}/", {'role': 'OWNER'}, format='json').status_code == 403

    # Der Ersteller bleibt davon unberührt voll handlungsfähig — Trip.owner hängt nicht an TripParticipant.role.
    client.force_authenticate(users[0])
    assert client.patch(f'{BASE}trips/{trip.pk}/', {'title': 'Umbenannt'}, format='json').status_code == 200
    assert client.patch(f"{BASE}participants/{bob_participant.data['id']}/", {'role': 'VIEWER'}, format='json').status_code == 200


def test_creator_demoting_their_own_participant_row_keeps_full_owner_rights(client, users):
    # Über die API erzeugt (nicht make_trip(), das am ORM vorbei anlegt) — nur so entsteht die automatische
    # Teilnehmer-Zeile des Erstellers (siehe TripViewSet.perform_create).
    created = client.post(BASE + 'trips/', {'title': 'Immer noch meine Reise', 'start_date': '2026-10-10', 'end_date': '2026-10-12'}, format='json')
    trip_id = created.data['id']
    own_row = TripParticipant.objects.get(trip_id=trip_id, user=users[0])

    # Der Ersteller kann die eigene Teilnehmer-Zeile wie jede andere herabstufen …
    demoted = client.patch(f'{BASE}participants/{own_row.pk}/', {'role': 'VIEWER'}, format='json')
    assert demoted.status_code == 200
    assert demoted.data['role'] == 'VIEWER'

    # … bleibt aber über Trip.owner weiterhin vollständig handlungsfähig: my_role bleibt 'OWNER', nicht die
    # (jetzt herabgestufte) TripParticipant.role, und Bearbeiten/Verwalten funktioniert unverändert.
    trip_response = client.get(f'{BASE}trips/{trip_id}/')
    assert trip_response.data['my_role'] == 'OWNER'
    assert client.patch(f'{BASE}trips/{trip_id}/', {'title': 'Immer noch meine Reise (bearbeitet)'}, format='json').status_code == 200
    assert client.patch(f'{BASE}participants/{own_row.pk}/', {'role': 'OWNER'}, format='json').status_code == 200


def test_removing_participants_self_leave_vs_owner_removes_someone_else(client, users):
    trip = make_trip(users[0], title='Reise zu dritt')
    Contact.objects.create(owner=users[0], other=users[1])
    contact = Contact.objects.get(owner=users[0], other=users[1])
    created = client.post(BASE + 'participants/', {'trip': trip.pk, 'contact_id': contact.pk, 'role': 'EDITOR'}, format='json')
    participant_id = created.data['id']

    # Ein EDITOR darf sich selbst entfernen ("die Reise verlassen") …
    client.force_authenticate(users[1])
    assert client.delete(f'{BASE}participants/{participant_id}/').status_code == 204
    assert not TripParticipant.objects.filter(pk=participant_id).exists()

    # … aber nicht jemand anderen (hier: sich selbst nochmal hinzufügen lassen, dann testen, dass ein zweiter
    # EDITOR niemand anderen entfernen darf).
    client.force_authenticate(users[0])
    recreated = client.post(BASE + 'participants/', {'trip': trip.pk, 'contact_id': contact.pk, 'role': 'EDITOR'}, format='json')
    other_user = get_user_model().objects.create_user(username='dana', password='test-secret-234')
    Contact.objects.create(owner=users[0], other=other_user)
    other_contact = Contact.objects.get(owner=users[0], other=other_user)
    other_participant = client.post(BASE + 'participants/', {'trip': trip.pk, 'contact_id': other_contact.pk, 'role': 'VIEWER'}, format='json')

    client.force_authenticate(users[1])
    assert client.delete(f"{BASE}participants/{other_participant.data['id']}/").status_code == 403

    # Der Ersteller darf jederzeit jeden entfernen.
    client.force_authenticate(users[0])
    assert client.delete(f"{BASE}participants/{recreated.data['id']}/").status_code == 204


def test_overlap_detection_considers_actual_participants_not_only_owner_or_household(client, users):
    shared_trip = make_trip(users[0], title='Konferenz', start_date='2026-11-01', end_date='2026-11-10')
    Contact.objects.create(owner=users[0], other=users[1])
    contact = Contact.objects.get(owner=users[0], other=users[1])
    client.post(BASE + 'participants/', {'trip': shared_trip.pk, 'contact_id': contact.pk, 'role': 'VIEWER'}, format='json')

    # users[1] ist nicht Besitzer dieser Reise, aber Teilnehmer — eine Überschneidungsprüfung für eine NEUE,
    # eigene Reise von users[1] muss die geteilte Reise trotzdem berücksichtigen.
    client.force_authenticate(users[1])
    overlaps = client.get(f'{BASE}trips/overlaps/?start_date=2026-11-05&end_date=2026-11-07').data
    assert [o['id'] for o in overlaps] == [shared_trip.pk]


def test_sharing_one_trip_does_not_leak_access_to_the_owners_other_trips(client, users):
    shared_trip = make_trip(users[0], title='Geteilte Reise')
    private_trip = make_trip(users[0], title='Private Reise')
    Contact.objects.create(owner=users[0], other=users[1])
    contact = Contact.objects.get(owner=users[0], other=users[1])
    client.post(BASE + 'participants/', {'trip': shared_trip.pk, 'contact_id': contact.pk, 'role': 'EDITOR'}, format='json')

    client.force_authenticate(users[1])
    assert [t['id'] for t in client.get(BASE + 'trips/').data] == [shared_trip.pk]
    assert client.get(f'{BASE}trips/{private_trip.pk}/').status_code == 404
