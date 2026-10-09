# Haushalt V1 (docs/HAUSHALT_V1.md): Verträge und Geräte erweitert, ohne Datenverlust.
import calendar
from datetime import date

import django.utils.timezone
from django.db import migrations, models


def _minus_months(value: date, months: int) -> date:
    month_index = value.month - 1 - months
    year = value.year + month_index // 12
    month = month_index % 12 + 1
    return date(year, month, min(value.day, calendar.monthrange(year, month)[1]))


def months_to_days(apps, schema_editor):
    """Kündigungsfrist von Monaten in Tage — exakt über das Vertragsende, damit
    der letzte Kündigungstag gleich bleibt; ohne Vertragsende 30 Tage je Monat."""
    FolderEntry = apps.get_model('haushalt', 'FolderEntry')
    for entry in FolderEntry.objects.exclude(notice_period_months__isnull=True):
        months = entry.notice_period_months
        if entry.end_date is not None:
            days = (entry.end_date - _minus_months(entry.end_date, months)).days
        else:
            days = months * 30
        entry.notice_period_days = days
        entry.save(update_fields=['notice_period_days'])


def days_to_months(apps, schema_editor):
    FolderEntry = apps.get_model('haushalt', 'FolderEntry')
    for entry in FolderEntry.objects.exclude(notice_period_days__isnull=True):
        entry.notice_period_months = min(36, round(entry.notice_period_days / 30))
        entry.save(update_fields=['notice_period_months'])


class Migration(migrations.Migration):
    dependencies = [
        ('haushalt', '0007_routinen_geraete_listen'),
    ]

    operations = [
        migrations.RenameField('folderentry', 'monthly_cost', 'cost'),
        migrations.RenameField('folderentry', 'contract_end', 'end_date'),
        migrations.RenameField('folderentry', 'warranty_until', 'warranty_end_date'),
        migrations.RenameField('folderentry', 'next_maintenance', 'maintenance_due_date'),
        migrations.AddField(
            model_name='folderentry',
            name='notice_period_days',
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.RunPython(months_to_days, days_to_months),
        migrations.RemoveField('folderentry', 'notice_period_months'),
        migrations.AddField(
            model_name='folderentry',
            name='billing_cycle',
            field=models.CharField(
                choices=[
                    ('MONTHLY', 'Monatlich'),
                    ('QUARTERLY', 'Vierteljährlich'),
                    ('YEARLY', 'Jährlich'),
                    ('ONE_TIME', 'Einmalig'),
                ],
                default='MONTHLY',
                max_length=10,
            ),
        ),
        migrations.AddField('folderentry', 'start_date', models.DateField(blank=True, null=True)),
        migrations.AddField('folderentry', 'auto_renewal', models.BooleanField(default=False)),
        migrations.AddField('folderentry', 'contract_number', models.CharField(blank=True, default='', max_length=60)),
        migrations.AddField('folderentry', 'category', models.CharField(blank=True, default='', max_length=60)),
        migrations.AddField(
            model_name='folderentry',
            name='status',
            field=models.CharField(
                choices=[
                    ('ACTIVE', 'Aktiv'),
                    ('EXPIRING', 'Läuft aus'),
                    ('CANCELLED', 'Gekündigt'),
                    ('ENDED', 'Beendet'),
                    ('REPAIR', 'In Reparatur'),
                    ('RETIRED', 'Außer Betrieb'),
                ],
                default='ACTIVE',
                max_length=10,
            ),
        ),
        migrations.AddField(
            model_name='folderentry',
            name='updated_at',
            field=models.DateTimeField(auto_now=True),
        ),
        migrations.AddField(
            model_name='task',
            name='updated_at',
            field=models.DateTimeField(auto_now=True),
        ),
        migrations.AlterField(
            model_name='task',
            name='priority',
            field=models.CharField(
                choices=[('niedrig', 'Niedrig'), ('mittel', 'Normal'), ('hoch', 'Hoch')], default='mittel', max_length=10
            ),
        ),
        migrations.AddField('shoppinglist', 'archived', models.BooleanField(default=False)),
        migrations.AddField('shoppingitem', 'notes', models.CharField(blank=True, default='', max_length=200)),
        migrations.AddField(
            model_name='shoppingitem',
            name='updated_at',
            field=models.DateTimeField(auto_now=True),
        ),
    ]
