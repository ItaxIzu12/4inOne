from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from core.mfa_views import user_has_mfa_enabled


class Command(BaseCommand):
    help = 'Admin-Panel-Zugang vergeben oder entziehen: manage.py monitoring_admin <email> [--remove]'

    def add_arguments(self, parser):
        parser.add_argument('email')
        parser.add_argument('--remove', action='store_true', help='Zugang entziehen')

    def handle(self, email, remove, **options):
        user = get_user_model().objects.filter(email__iexact=email).first()
        if user is None:
            raise CommandError('Kein Konto mit dieser E-Mail-Adresse.')
        user.is_staff = not remove
        user.save(update_fields=['is_staff'])
        if remove:
            self.stdout.write(self.style.SUCCESS('Admin-Zugang entzogen.'))
            return
        self.stdout.write(self.style.SUCCESS('Admin-Zugang vergeben. Seite: /admin'))
        if not user_has_mfa_enabled(user):
            self.stdout.write(self.style.WARNING('Das Panel öffnet sich erst mit Zwei-Faktor-Anmeldung: Einstellungen → Zwei-Faktor.'))
