from datetime import datetime, time

from django.db import migrations
from django.utils import timezone


def occurred_at_to_datum(apps, schema_editor):
    """Übernimmt das Datum aus occurred_at (in der Django-Zeitzone, also das
    Datum, das der Nutzer bei der Erfassung gesehen hat). Läuft über ALLE
    Zeilen, auch weich gelöschte — der historische Standard-Manager filtert
    nicht nach deleted_at."""
    Transaction = apps.get_model('finanzen', 'Transaction')
    batch = []
    for transaction in Transaction.objects.filter(datum__isnull=True).iterator():
        transaction.datum = timezone.localtime(transaction.occurred_at).date()
        batch.append(transaction)
        if len(batch) >= 500:
            Transaction.objects.bulk_update(batch, ['datum'])
            batch = []
    if batch:
        Transaction.objects.bulk_update(batch, ['datum'])


def datum_to_occurred_at(apps, schema_editor):
    """Rückweg: Mittag (12:00) des gespeicherten Datums als occurred_at — die
    Uhrzeit war nie Teil von datum und lässt sich nicht rekonstruieren."""
    Transaction = apps.get_model('finanzen', 'Transaction')
    for transaction in Transaction.objects.exclude(datum__isnull=True).iterator():
        transaction.occurred_at = timezone.make_aware(datetime.combine(transaction.datum, time(12, 0)))
        transaction.save(update_fields=['occurred_at'])


class Migration(migrations.Migration):
    """Schritt 2/3: Daten übernehmen. Eigene Migration, weil Datenänderung und
    Schemaänderung auf PostgreSQL nicht in derselben Transaktion gemischt
    werden sollten."""

    dependencies = [
        ('finanzen', '0009_transaction_datum'),
    ]

    operations = [
        migrations.RunPython(occurred_at_to_datum, datum_to_occurred_at),
    ]
