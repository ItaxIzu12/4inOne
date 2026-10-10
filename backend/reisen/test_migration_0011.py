"""0011: bestehende Ausgaben bekommen die Reisewährung als Originalwährung — ohne erfundene historische Kurse."""

from decimal import Decimal

import pytest
from django.db import connection
from django.db.migrations.executor import MigrationExecutor

BEFORE = [('reisen', '0010_trip_climate_winter'), ('core', '0008_contacts')]
AFTER = [('reisen', '0011_expense_currency_fx')]


@pytest.mark.django_db(transaction=True)
def test_existing_expenses_keep_their_amount_in_the_trip_currency_and_no_invented_rate():
    executor = MigrationExecutor(connection)
    executor.migrate(BEFORE)
    old = executor.loader.project_state(BEFORE).apps
    User = old.get_model('auth', 'User')
    Trip = old.get_model('reisen', 'Trip')
    TripExpense = old.get_model('reisen', 'TripExpense')
    owner = User.objects.create(username='alt')
    chf = Trip.objects.create(owner=owner, title='Davos', start_date='2026-11-12', end_date='2026-11-15', currency='CHF')
    eur = Trip.objects.create(owner=owner, title='Berlin', start_date='2026-11-12', end_date='2026-11-15')
    TripExpense.objects.create(trip=chf, title='Skipass', amount=Decimal('320.00'), date='2026-11-12')
    TripExpense.objects.create(trip=eur, title='Hotel', amount=Decimal('80.00'), date='2026-11-12')

    executor = MigrationExecutor(connection)
    executor.migrate(AFTER)
    TripExpense = executor.loader.project_state(AFTER).apps.get_model('reisen', 'TripExpense')
    skipass = TripExpense.objects.get(title='Skipass')
    hotel = TripExpense.objects.get(title='Hotel')
    assert (skipass.amount, skipass.currency, skipass.amount_trip, skipass.rate_to_trip) == (Decimal('320.00'), 'CHF', Decimal('320.00'), Decimal('1'))
    assert (hotel.amount, hotel.currency, hotel.amount_trip) == (Decimal('80.00'), 'EUR', Decimal('80.00'))
    # Kein Vergleichswert in der Heimatwährung erfunden.
    assert (skipass.home_currency, skipass.amount_home, skipass.rate_to_home, skipass.rate_date) == ('', None, None, None)
    assert TripExpense.objects.count() == 2

    MigrationExecutor(connection).migrate(executor.loader.graph.leaf_nodes())
