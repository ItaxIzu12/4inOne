"""Invitation System V1: In-App-Einladungen ersetzen die unbenutzte E-Mail-Haushaltseinladung, und die (nie benutzte)
Benachrichtigungstabelle wird zum generischen Zustellkanal mit Verweis statt kopiertem Text."""

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('core', '0010_rotate_unverified_invitation_tokens'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.DeleteModel(name='HouseholdInvite'),
        migrations.DeleteModel(name='Notification'),
        migrations.CreateModel(
            name='Invitation',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('scope_type', models.CharField(choices=[('HOUSEHOLD', 'Haushalt'), ('TRIP', 'Reise')], max_length=12)),
                ('scope_id', models.PositiveBigIntegerField()),
                ('role', models.CharField(max_length=12)),
                (
                    'status',
                    models.CharField(
                        choices=[('PENDING', 'Offen'), ('ACCEPTED', 'Angenommen'), ('DECLINED', 'Abgelehnt'), ('REVOKED', 'Zurückgezogen')],
                        default='PENDING',
                        max_length=10,
                    ),
                ),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('responded_at', models.DateTimeField(blank=True, null=True)),
                ('expires_at', models.DateTimeField()),
                (
                    'invitee',
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='invitations', to=settings.AUTH_USER_MODEL),
                ),
                (
                    'inviter',
                    models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='sent_invitations', to=settings.AUTH_USER_MODEL),
                ),
            ],
            options={
                'ordering': ['-created_at', '-id'],
                'indexes': [
                    models.Index(fields=['invitee', 'status'], name='core_invita_invitee_status_idx'),
                    models.Index(fields=['inviter', 'status'], name='core_invita_inviter_status_idx'),
                ],
                'constraints': [
                    models.UniqueConstraint(
                        condition=models.Q(('status', 'PENDING')),
                        fields=('invitee', 'scope_type', 'scope_id'),
                        name='one_pending_invitation_per_scope',
                    ),
                    models.CheckConstraint(condition=models.Q(('inviter', models.F('invitee')), _negated=True), name='invitation_not_self'),
                ],
            },
        ),
        migrations.CreateModel(
            name='Notification',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('kind', models.CharField(choices=[('INVITATION_CREATED', 'Neue Einladung')], max_length=32)),
                ('read_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                (
                    'invitation',
                    models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, related_name='notifications', to='core.invitation'),
                ),
                (
                    'user',
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='notifications', to=settings.AUTH_USER_MODEL),
                ),
            ],
            options={
                'ordering': ['-created_at', '-id'],
                'indexes': [models.Index(fields=['user', 'read_at'], name='core_notif_user_read_idx')],
            },
        ),
    ]
