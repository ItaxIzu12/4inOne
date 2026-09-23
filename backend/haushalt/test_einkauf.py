"""Einkaufsliste, Einkaufsmodus und der Einkauf-zu-Ausgabe-Moment
(GESAMTKONZEPT.md §5.1)."""

from decimal import Decimal

import pytest

from finanzen import services as finanzen_services
from finanzen.models import Category, Transaction
from haushalt import services
from haushalt.models import ItemMemory, ShoppingItem, ShoppingTrip

pytestmark = pytest.mark.django_db

URL = '/api/v1/haushalt/einkauf/'
ITEMS = '/api/v1/haushalt/einkauf/eintraege/'
COMPLETE = '/api/v1/haushalt/einkauf/eintraege/abschliessen/'


def _add(client, name, **extra):
    response = client.post(ITEMS, {'name': name, **extra}, format='json')
    assert response.status_code == 201, response.data
    return response.data


def test_new_item_is_sorted_into_a_shop_section(anna, client_for):
    client = client_for(anna)
    assert _add(client, 'Bananen')['section'] == 'obst_gemuese'
    assert _add(client, 'Vollmilch')['section'] == 'kuehlregal'
    assert _add(client, 'Reis')['section'] == 'vorrat'  # nicht Kühlregal wegen "ei"
    assert _add(client, 'Geburtstagskerzen')['section'] == 'sonstiges'


def test_household_decision_about_a_section_wins_next_time(anna, client_for):
    client = client_for(anna)
    item = _add(client, 'Hafermilch')
    client.patch(f'{ITEMS}{item["id"]}/', {'section': 'vorrat'}, format='json')
    client.delete(f'{ITEMS}{item["id"]}/')

    assert _add(client, 'hafermilch')['section'] == 'vorrat'


def test_adding_an_open_duplicate_updates_instead_of_duplicating(anna, ben, client_for):
    _add(client_for(anna), 'Milch')
    _add(client_for(ben), 'milch', quantity='2 l')

    items = ShoppingItem.objects.all()
    assert items.count() == 1
    assert items.get().quantity == '2 l'


def test_overview_lists_open_items_first_in_shop_order(anna, client_for):
    client = client_for(anna)
    _add(client, 'Waschmittel')
    _add(client, 'Äpfel')
    brot = _add(client, 'Brot')
    client.patch(f'{ITEMS}{brot["id"]}/', {'is_checked': True}, format='json')

    data = client.get(URL).data
    assert [item['name'] for item in data['items']] == ['Äpfel', 'Waschmittel', 'Brot']
    assert data['items'][-1]['checked_by_name'] == 'Anna'
    assert data['can_book_expense'] is True


def test_suggestions_offer_known_items_that_are_not_on_the_list(anna, client_for):
    client = client_for(anna)
    milch = _add(client, 'Milch')
    _add(client, 'Brot')
    client.patch(f'{ITEMS}{milch["id"]}/', {'is_checked': True}, format='json')
    client.post(COMPLETE, {}, format='json')

    names = [s['name'] for s in client.get(URL).data['suggestions']]
    assert 'Milch' in names
    assert 'Brot' not in names  # steht noch offen auf der Liste


def test_completing_with_amount_books_an_expense_in_finance(anna, client_for):
    client = client_for(anna)
    for name in ('Milch', 'Brot', 'Käse'):
        item = _add(client, name)
        client.patch(f'{ITEMS}{item["id"]}/', {'is_checked': True}, format='json')
    _add(client, 'Butter')  # bleibt offen

    response = client.post(COMPLETE, {'amount': '18.40'}, format='json')

    assert response.status_code == 201
    assert response.data['item_count'] == 3
    transaction = Transaction.objects.get(pk=response.data['transaction_id'])
    assert transaction.amount == Decimal('18.40')
    assert transaction.category.name == 'Haushalt'
    assert transaction.created_by == anna
    assert transaction.description == 'Einkauf (3 Artikel)'
    # Die Ausgabe fließt sofort ins Budget ein.
    assert finanzen_services.transactions_total(anna.households.first()) == Decimal('18.40')
    assert list(ShoppingItem.objects.values_list('name', flat=True)) == ['Butter']


def test_completing_without_amount_creates_no_expense(anna, client_for):
    client = client_for(anna)
    item = _add(client, 'Milch')
    client.patch(f'{ITEMS}{item["id"]}/', {'is_checked': True}, format='json')

    response = client.post(COMPLETE, {'amount': None}, format='json')

    assert response.status_code == 201
    assert response.data['transaction_id'] is None
    assert Transaction.objects.count() == 0
    assert ShoppingTrip.objects.get().item_count == 1


def test_completing_with_nothing_checked_is_rejected(anna, client_for):
    client = client_for(anna)
    _add(client, 'Milch')
    assert client.post(COMPLETE, {'amount': '5.00'}, format='json').status_code == 400


def _booked_trip(household, user, item_count, amount):
    transaction = finanzen_services.create_transaction_from_shopping_list(
        household, user, Decimal(amount), item_count
    )
    return ShoppingTrip.objects.create(
        household=household, item_count=item_count, amount=Decimal(amount), transaction=transaction
    )


def test_price_estimate_learns_from_previous_trips(anna, household):
    assert services.price_per_item(household) == (services.DEFAULT_PRICE_PER_ITEM, False)
    _booked_trip(household, anna, 4, '10.00')
    _booked_trip(household, anna, 6, '20.00')
    assert services.price_per_item(household) == (Decimal('3.00'), True)


def test_price_estimate_follows_corrections_made_in_finance(anna, household, client_for):
    trip = _booked_trip(household, anna, 4, '64.00')
    response = client_for(anna).patch(
        f'/api/v1/finanzen/transaktionen/{trip.transaction_id}/', {'amount': '46.00'}, format='json'
    )
    assert response.status_code == 200, response.data
    assert services.price_per_item(household) == (Decimal('11.50'), True)


def test_price_estimate_ignores_expenses_deleted_in_finance(anna, household, client_for):
    _booked_trip(household, anna, 4, '10.00')
    wrong = _booked_trip(household, anna, 2, '200.00')
    assert client_for(anna).delete(f'/api/v1/finanzen/transaktionen/{wrong.transaction_id}/').status_code == 204
    assert services.price_per_item(household) == (Decimal('2.50'), True)


def test_trip_without_expense_does_not_affect_the_estimate(anna, household):
    ShoppingTrip.objects.create(household=household, item_count=5, amount=None)
    assert services.price_per_item(household) == (services.DEFAULT_PRICE_PER_ITEM, False)


def test_child_account_can_shop_but_not_book_an_expense(kind, client_for):
    client = client_for(kind)
    item = _add(client, 'Milch')
    client.patch(f'{ITEMS}{item["id"]}/', {'is_checked': True}, format='json')

    assert client.get(URL).data['can_book_expense'] is False
    assert client.post(COMPLETE, {'amount': '5.00'}, format='json').status_code == 403
    assert client.post(COMPLETE, {}, format='json').status_code == 201
    assert Transaction.objects.count() == 0


def test_foreign_category_cannot_be_used_as_booking_target(anna, fremd, client_for):
    client = client_for(anna)
    item = _add(client, 'Milch')
    client.patch(f'{ITEMS}{item["id"]}/', {'is_checked': True}, format='json')
    foreign_category = Category.objects.get(household=fremd.households.first(), name='Haushalt')

    response = client.post(COMPLETE, {'amount': '5.00', 'category_id': foreign_category.id}, format='json')

    assert response.status_code == 400
    assert Transaction.objects.count() == 0


def test_items_of_another_household_are_invisible_and_untouchable(anna, fremd, client_for):
    item = _add(client_for(fremd), 'Geheimzutat')
    client = client_for(anna)

    assert client.get(URL).data['items'] == []
    assert client.patch(f'{ITEMS}{item["id"]}/', {'is_checked': True}, format='json').status_code == 404
    assert client.delete(f'{ITEMS}{item["id"]}/').status_code == 404
    assert ShoppingItem.objects.get(pk=item['id']).is_checked is False


def test_item_memory_counts_uses_case_insensitively(anna, household, client_for):
    client = client_for(anna)
    first = _add(client, 'Milch')
    client.delete(f'{ITEMS}{first["id"]}/')
    _add(client, 'MILCH')

    memory = ItemMemory.objects.get(household=household)
    assert memory.use_count == 2


def test_concurrent_new_item_memory_does_not_crash(anna, household, monkeypatch):
    """Zwei Personen tragen gleichzeitig denselben neuen Artikel ein: die
    zweite sieht beim Nachschlagen noch nichts, verliert dann das Rennen um
    die Eindeutigkeits-Regel — und darf trotzdem keinen 500 auslösen."""
    ItemMemory.objects.create(household=household, name='Milch', section='kuehlregal', use_count=1)
    real_filter = ItemMemory.objects.filter
    calls = {'n': 0}

    def stale_first_lookup(*args, **kwargs):
        calls['n'] += 1
        if calls['n'] == 1:
            return ItemMemory.objects.none()
        return real_filter(*args, **kwargs)

    monkeypatch.setattr(ItemMemory.objects, 'filter', stale_first_lookup)
    services.remember_item(household, 'milch', 'kuehlregal')
    monkeypatch.undo()

    assert ItemMemory.objects.get(household=household).use_count == 2


def test_item_memory_is_pruned_above_the_limit(household, monkeypatch):
    monkeypatch.setattr(services, 'MAX_ITEM_MEMORIES', 3)
    for name in ('A', 'B', 'C'):
        services.remember_item(household, name, 'sonstiges')
    services.remember_item(household, 'A', 'sonstiges')  # A häufiger genutzt
    services.remember_item(household, 'D', 'sonstiges')

    names = set(ItemMemory.objects.filter(household=household).values_list('name', flat=True))
    assert len(names) == 3
    assert 'A' in names and 'D' in names
