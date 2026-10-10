"""0012: Gepäck wird eine Liste — jede bisherige Angabe bleibt erhalten, „Noch unklar“ wird zu keiner Angabe."""

import pytest
from django.db import connection
from django.db.migrations.executor import MigrationExecutor

BEFORE = [('reisen', '0011_expense_currency_fx')]
AFTER = [('reisen', '0012_trip_baggage_list')]


@pytest.mark.django_db(transaction=True)
def test_single_baggage_values_become_lists():
    executor = MigrationExecutor(connection)
    executor.migrate(BEFORE)
    old = executor.loader.project_state(BEFORE).apps
    User = old.get_model('auth', 'User')
    Trip = old.get_model('reisen', 'Trip')
    owner = User.objects.create(username='alt')
    for value in ['HAND_LUGGAGE', 'CHECKED_BAGGAGE', 'CAR_LUGGAGE', 'UNKNOWN', '']:
        Trip.objects.create(owner=owner, title=value or 'leer', start_date='2026-11-12', end_date='2026-11-15', baggage_type=value)

    executor = MigrationExecutor(connection)
    executor.migrate(AFTER)
    Trip = executor.loader.project_state(AFTER).apps.get_model('reisen', 'Trip')
    assert {t.title: t.baggage for t in Trip.objects.all()} == {
        'HAND_LUGGAGE': ['HAND_LUGGAGE'],
        'CHECKED_BAGGAGE': ['CHECKED_BAGGAGE'],
        'CAR_LUGGAGE': ['CAR_LUGGAGE'],
        'UNKNOWN': [],
        'leer': [],
    }

    MigrationExecutor(connection).migrate(executor.loader.graph.leaf_nodes())
