"""O1: Erinnerungen per E-Mail verschicken (connections/reminders.py). Gedacht für einen täglichen Cron-Lauf, z. B. 7 Uhr:

    python manage.py send_reminder_emails

Mehrfaches Ausführen am selben Tag schickt nichts doppelt. Mit --dry-run wird nur gezählt, nichts gesendet."""

from django.core.management.base import BaseCommand
from django.utils import timezone

from connections.reminders import send_due_reminders


class Command(BaseCommand):
    help = 'Schickt die täglichen bzw. wöchentlichen Erinnerungen per E-Mail (nur an Personen, die sie eingeschaltet haben).'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help='Nur zählen, nichts senden und nichts vermerken.')

    def handle(self, *args, **options):
        stats = send_due_reminders(timezone.localdate(), dry_run=options['dry_run'])
        self.stdout.write(
            f"Erinnerungen: {stats['sent']} gesendet, {stats['empty']} ohne Inhalt, "
            f"{stats['skipped']} nicht fällig, {stats['failed']} fehlgeschlagen"
            + (' (Probelauf)' if options['dry_run'] else '')
        )
