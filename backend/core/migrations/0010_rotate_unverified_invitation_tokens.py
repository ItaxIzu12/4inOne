"""Entwerte Links, die vor der Postfachprüfung in Listen sichtbar gewesen sein könnten."""
import secrets

from django.db import migrations
from django.utils import timezone


def rotate_pending_tokens(apps, schema_editor):
    invites = apps.get_model('core', 'ContactInvite').objects.using(schema_editor.connection.alias)
    for invite in invites.filter(
        accepted_at__isnull=True, declined_at__isnull=True, expires_at__gt=timezone.now(),
    ).iterator():
        invite.token = secrets.token_urlsafe(32)
        invite.save(using=schema_editor.connection.alias, update_fields=['token'])


class Migration(migrations.Migration):
    dependencies = [('core', '0009_fx_home_currency')]
    operations = [migrations.RunPython(rotate_pending_tokens, migrations.RunPython.noop)]
