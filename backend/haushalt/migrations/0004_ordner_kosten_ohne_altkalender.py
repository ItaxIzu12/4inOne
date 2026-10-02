# ADR-001: Der Haushalt hängt nicht mehr an den eingefrorenen Haushalts-
# finanzen und schreibt keine Kopien mehr in den alten Haushaltskalender.
#
# Reihenfolge ist wichtig: erst das neue Kostenfeld anlegen und aus dem
# verknüpften festen Abzug befüllen, DANN die alte Verknüpfung entfernen.
# Die feste Abzüge selbst bleiben unverändert (eingefroren, lesbar).

from django.db import migrations, models


def copy_costs_from_deductions(apps, schema_editor):
    FolderEntry = apps.get_model('haushalt', 'FolderEntry')
    entries = FolderEntry.objects.filter(recurring_deduction__isnull=False, recurring_deduction__active=True)
    for entry in entries.select_related('recurring_deduction'):
        entry.monthly_cost = entry.recurring_deduction.amount
        entry.save(update_fields=['monthly_cost'])


def delete_generated_calendar_copies(apps, schema_editor):
    # Nur die automatisch erzeugten Kopien von Aufgaben und Ordnerfristen —
    # manuell angelegte Termine bleiben unangetastet. „Heute“ liest Aufgaben
    # und Fristen ab jetzt direkt aus dem Haushalt.
    CalendarEvent = apps.get_model('organisation', 'CalendarEvent')
    CalendarEvent.objects.filter(source__in=['aufgabe', 'ordner']).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('haushalt', '0003_task_description_time_monthly'),
        ('organisation', '0002_calendarevent_all_day_calendarevent_source_and_more'),
        ('finanzen', '0007_recurringdeduction'),
    ]

    operations = [
        migrations.AddField(
            model_name='folderentry',
            name='monthly_cost',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=8, null=True),
        ),
        migrations.RunPython(copy_costs_from_deductions, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name='folderentry',
            name='recurring_deduction',
        ),
        migrations.RemoveField(
            model_name='task',
            name='calendar_event',
        ),
        migrations.RunPython(delete_generated_calendar_copies, migrations.RunPython.noop),
    ]
