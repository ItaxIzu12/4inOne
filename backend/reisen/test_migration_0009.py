"""Reisen V1 (0009): alte Status IDEA/ACTIVE werden umgestellt, ohne dass eine Reise oder ihr Inhalt verloren geht."""

import pytest
from django.db import connection
from django.db.migrations.executor import MigrationExecutor

BEFORE = [('reisen', '0008_reiseplanung_status_details')]
AFTER = [('reisen', '0009_reisen_v1')]


@pytest.mark.django_db(transaction=True)
def test_idea_and_active_trips_survive_with_a_v1_status():
    executor = MigrationExecutor(connection)
    executor.migrate(BEFORE)
    old = executor.loader.project_state(BEFORE).apps
    User = old.get_model('auth', 'User')
    Trip = old.get_model('reisen', 'Trip')
    TripTask = old.get_model('reisen', 'TripTask')
    owner = User.objects.create(username='alt')
    ids = {}
    for status in ['IDEA', 'PLANNED', 'CONFIRMED', 'ACTIVE', 'DONE', 'CANCELLED']:
        trip = Trip.objects.create(owner=owner, title=status, start_date='2026-11-12', end_date='2026-11-15', status=status)
        TripTask.objects.create(trip=trip, title='Pass prüfen')
        ids[status] = trip.pk

    executor = MigrationExecutor(connection)
    executor.migrate(AFTER)
    new = executor.loader.project_state(AFTER).apps
    Trip = new.get_model('reisen', 'Trip')
    TripTask = new.get_model('reisen', 'TripTask')
    expected = {'IDEA': 'PLANNED', 'PLANNED': 'PLANNED', 'CONFIRMED': 'CONFIRMED', 'ACTIVE': 'CONFIRMED', 'DONE': 'DONE', 'CANCELLED': 'CANCELLED'}
    for old_status, pk in ids.items():
        trip = Trip.objects.get(pk=pk)
        assert trip.status == expected[old_status]
        assert trip.departure == ''
    assert Trip.objects.count() == 6
    assert TripTask.objects.count() == 6
    assert set(TripTask.objects.values_list('assignee', flat=True)) == {None}

    # Zurück auf den letzten Stand, damit andere Tests das aktuelle Schema vorfinden.
    MigrationExecutor(connection).migrate(executor.loader.graph.leaf_nodes())
