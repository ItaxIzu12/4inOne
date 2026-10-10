from django.db import migrations, models


# Gepäck wird kombinierbar: aus einem Einzelwert (baggage_type) wird eine Liste (baggage). Jede bisherige Angabe bleibt
# erhalten — „Nur Handgepäck“ → [Handgepäck], „Aufgabegepäck“ → [Aufgabegepäck], „Gepäck im Auto“ → [Gepäck im Auto];
# „Noch unklar“ und keine Angabe → leer (keine Angabe ist jetzt einfach nichts gewählt). Rückwärts: der erste Wert.
def to_list(apps, schema_editor):
    Trip = apps.get_model('reisen', 'Trip')
    for trip in Trip.objects.exclude(baggage_type__in=['', 'UNKNOWN']).only('id', 'baggage_type'):
        trip.baggage = [trip.baggage_type]
        trip.save(update_fields=['baggage'])


def to_single(apps, schema_editor):
    Trip = apps.get_model('reisen', 'Trip')
    for trip in Trip.objects.only('id', 'baggage'):
        trip.baggage_type = trip.baggage[0] if trip.baggage else ''
        trip.save(update_fields=['baggage_type'])


class Migration(migrations.Migration):

    dependencies = [
        ('reisen', '0011_expense_currency_fx'),
    ]

    operations = [
        migrations.AddField(
            model_name='trip',
            name='baggage',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.RunPython(to_list, to_single),
        migrations.RemoveField(
            model_name='trip',
            name='baggage_type',
        ),
    ]
