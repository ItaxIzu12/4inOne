"""Sicherheitsnetz gegen den häufigsten Entwicklungsfehler: ein Modell wird
geändert, die Migration dazu fehlt. Dann läuft alles in der frischen Testdatenbank
(die aus den Modellen gebaut wird), aber nicht auf echten Datenbanken."""

from io import StringIO

import pytest
from django.core.management import call_command


@pytest.mark.django_db
def test_no_model_changes_without_a_migration():
    output = StringIO()
    try:
        call_command('makemigrations', '--check', '--dry-run', stdout=output, stderr=output)
    except SystemExit:  # --check beendet mit Code 1, wenn Migrationen fehlen
        pytest.fail(f'Modelländerung ohne Migration — `python manage.py makemigrations` ausführen:\n{output.getvalue()}')
