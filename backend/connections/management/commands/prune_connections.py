from django.core.management.base import BaseCommand

from connections import services


class Command(BaseCommand):
    help = (
        'Entfernt Verbindungen, deren Objekt nicht mehr existiert. Im Normalbetrieb räumen die '
        'Signale (connections/signals.py) sofort auf; dieser Befehl fängt Reste ab, die an den '
        'Signalen vorbei entstanden sind (Raw-SQL, direkte Eingriffe, Importe).'
    )

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help='Nur zählen, nichts löschen.')

    def handle(self, *args, **options):
        if options['dry_run']:
            count = len(services.find_orphans())
            self.stdout.write(f'{count} verwaiste Verbindung(en) gefunden (nichts gelöscht).')
            return
        count = services.prune_orphans()
        self.stdout.write(self.style.SUCCESS(f'{count} verwaiste Verbindung(en) entfernt.'))
