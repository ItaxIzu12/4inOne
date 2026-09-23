from django.db import migrations, models
from django.utils import timezone


class Migration(migrations.Migration):
    """Schritt 1/3 (occurred_at -> datum): neues Feld nullable anlegen.

    occurred_at bekommt einen Standardwert, damit sich diese Kette bei Bedarf
    rückwärts migrieren lässt (Schritt 3 entfernt das Feld; ohne Default
    ließe sich die Rücknahme auf einer befüllten Tabelle nicht ausführen)."""

    dependencies = [
        ('finanzen', '0008_alter_category_name'),
    ]

    operations = [
        migrations.AddField(
            model_name='transaction',
            name='datum',
            field=models.DateField(null=True),
        ),
        migrations.AlterField(
            model_name='transaction',
            name='occurred_at',
            field=models.DateTimeField(default=timezone.now),
        ),
    ]
