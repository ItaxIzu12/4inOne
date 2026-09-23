from django.db import migrations, models

import finanzen.models


class Migration(migrations.Migration):
    """Schritt 3/3: datum wird Pflichtfeld (Standard: heute), occurred_at
    entfällt — datum ist ab jetzt die einzige Quelle für "wann war die
    Ausgabe"."""

    dependencies = [
        ('finanzen', '0010_backfill_transaction_datum'),
    ]

    operations = [
        migrations.AlterField(
            model_name='transaction',
            name='datum',
            field=models.DateField(default=finanzen.models.heute),
        ),
        migrations.RemoveField(
            model_name='transaction',
            name='occurred_at',
        ),
    ]
