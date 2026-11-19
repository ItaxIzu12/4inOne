"""DSGVO-Datenexport: alle Daten einer Person als ZIP (JSON je Bereich + hochgeladene Dateien + LIESMICH.txt).

Was hineinkommt — dieselbe Grenze wie in der App:
- alles, was der Person gehört (private Finanzen, eigene Termine/Aufgaben/Notizen/Dateien, eigene Reisen, Konto),
- der Inhalt gemeinsamer Bereiche, in denen sie Mitglied ist (Haushalt, Reisen als Teilnehmer:in) — das sieht sie in der
  App ohnehin.

Was nie hineinkommt: Passwort-Hash, MFA-Schlüssel und Ersatzcodes, Token und Sitzungskennungen (Geheimnisse, keine
Auskunft), das Einkommen anderer Haushaltsmitglieder, Inhalte privater Kalender anderer (die stehen in deren Export).
Andere Personen erscheinen nur mit ihrem Anzeigenamen, wie in der App.

Neue Modelle: `test_every_model_is_exported_or_excluded_on_purpose` schlägt fehl, bis ein neues Modell hier exportiert
oder in EXCLUDED_MODELS mit Begründung eingetragen ist — so wird nichts still vergessen.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import tempfile
import uuid
import zipfile
from datetime import date, datetime
from decimal import Decimal

from axes.models import AccessFailureLog, AccessLog
from django.contrib.auth import get_user_model
from django.db.models import FileField, Q
from django.utils import timezone
from django_otp import devices_for_user

from connections.models import AutoLink, AutoLinkEvent, Connection, SuggestionDismissal
from core.households import own_household
from core.models import (
    BetaFeedback, Contact, ContactInvite, SocialAccount, Household, HouseholdMembership, Invitation, Notification, OnboardingProfile,
    UserPreference, UserSession,
)
from finanzen.models import (
    Account, Budget, Category, MonthlyBudget, RecurringDeduction, SavingsContribution, SavingsGoal, Transaction,
)
from monitoring.models import AuthEvent
from haushalt.models import (
    FolderAttachment, FolderEntry, ItemMemory, ShoppingItem, ShoppingList, ShoppingTrip, Task, TaskCompletion,
)
from organisation.models import (
    CalendarEvent, CalendarMember, CalendarShare, EventShare, PersonalEvent, PersonalFile, PersonalNote, PersonalTask,
    SharedCalendar,
)
from reisen.models import (
    PackingItem, Trip, TripBudgetCategory, TripEvent, TripExpense, TripParticipant, TripSettlement, TripTask,
)

User = get_user_model()

# Felder, die nie exportiert werden: Geheimnisse und technische Kennungen ohne Auskunftswert.
SECRET_FIELDS = frozenset({
    'password', 'current_jti', 'sid', 'token', 'code_hash', 'session_hash', 'post_data', 'get_data', 'http_accept',
    'path_info',
})

# Modelle, die bewusst NICHT im Export stehen — mit Grund. Alles andere muss exportiert werden (siehe Modul-Docstring).
EXCLUDED_MODELS = {
    'core.PasswordResetToken': 'Geheimnis (Link zum Zurücksetzen), kurzlebig',
    'core.MfaBackupCode': 'Geheimnis (Hash der Ersatzcodes); der Export nennt nur „Zwei-Faktor aktiv: ja/nein“',
    'core.IdempotencyRecord': 'technischer Schutz vor Doppel-Speichern, enthält nur Schlüssel und Statuscodes',
    'core.ExchangeRate': 'öffentliche EZB-Kurse, keine personenbezogenen Daten',
    'website.PageView': 'anonyme Tageszähler ohne Bezug zu einer Person',
}


def _plain(value):
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, uuid.UUID):
        return str(value)
    if value is None or isinstance(value, (bool, int, float, str, list, dict)):
        return value
    return str(value)


def _safe_filename(name: str) -> str:
    base = os.path.basename(name or 'datei')
    return re.sub(r'[^\w.\- ]+', '_', base).strip(' .') or 'datei'


class _Export:
    def __init__(self, user):
        self.user = user
        self.names: dict[int, str] = {}
        self.files: list[tuple[str, object]] = []  # (Pfad im ZIP, FieldFile)
        self.counts: dict[str, int] = {}
        self.exported_models: set[str] = set()

    # -- Bausteine -----------------------------------------------------------------------------------------------
    def name(self, user_id):
        if user_id is None:
            return None
        if user_id == self.user.pk:
            return 'Du'
        if user_id not in self.names:
            other = User.objects.filter(pk=user_id).only('first_name', 'email').first()
            # dieselbe Regel wie in der App (_display_name): Vorname oder Teil vor dem @, nie die ganze Adresse
            self.names[user_id] = (other.first_name or other.email.split('@')[0]) if other else 'Gelöschtes Konto'
        return self.names[user_id]

    def rows(self, queryset, *, exclude=(), files_dir=None):
        model = queryset.model
        self.exported_models.add(model._meta.label)
        out = []
        for obj in queryset.order_by('pk'):
            row = {}
            for field in model._meta.concrete_fields:
                if field.name in SECRET_FIELDS or field.name in exclude:
                    continue
                value = getattr(obj, field.attname)
                if field.is_relation:
                    if field.related_model is User:
                        row[field.name] = self.name(value)
                    else:
                        row[field.attname] = value
                elif isinstance(field, FileField):
                    if value:
                        label = getattr(obj, 'name', '') or str(value)
                        path = f'{files_dir}/{obj.pk}-{_safe_filename(label)}'
                        self.files.append((path, getattr(obj, field.name)))
                        row[field.name] = path
                    else:
                        row[field.name] = None
                else:
                    row[field.name] = _plain(value)
            for m2m in model._meta.many_to_many:
                ids = list(getattr(obj, m2m.name).values_list('pk', flat=True))
                row[m2m.name] = [self.name(i) for i in ids] if m2m.related_model is User else ids
            out.append(row)
        return out

    def section(self, title: str, parts: dict) -> dict:
        data = {'bereich': title}
        for key, value in parts.items():
            data[key] = value
            if isinstance(value, list):
                self.counts[f'{title} › {key}'] = len(value)
        return data

    # -- Bereiche ------------------------------------------------------------------------------------------------
    def build(self) -> dict[str, dict]:
        user = self.user
        households = list(HouseholdMembership.objects.filter(user=user).values_list('household_id', flat=True))
        trips = Trip._base_manager.filter(Q(owner=user) | Q(participants__user=user)).distinct().values_list('id', flat=True)
        trips = list(trips)
        preference = UserPreference.objects.filter(user=user).first()
        # Die alten, eingefrorenen Haushaltsfinanzen zeigt die App nur für den EIGENEN Haushalt (finanzen/views.py) —
        # nicht für jeden Haushalt, in dem man Mitglied ist. Der Export hält dieselbe Grenze.
        own = own_household(user)
        legacy = [own.pk] if own else []

        konto = self.section('Konto', {
            'profil': {
                'email': user.email,
                'name': user.first_name,
                'registriert_am': _plain(user.date_joined),
                'letzte_anmeldung': _plain(user.last_login),
                'zwei_faktor_aktiv': any(d.confirmed for d in devices_for_user(user, confirmed=None)),
                'heimatwaehrung': preference.home_currency if preference else None,
            },
            'einstellungen': self.rows(UserPreference._base_manager.filter(user=user)),
            'onboarding': self.rows(OnboardingProfile._base_manager.filter(user=user)),
            'haushalt_mitgliedschaften': self.rows(HouseholdMembership._base_manager.filter(user=user)),
            'kontakte': self.rows(Contact._base_manager.filter(owner=user)),
            'kontakt_einladungen': self.rows(ContactInvite._base_manager.filter(inviter=user)),
            'einladungen': self.rows(Invitation._base_manager.filter(Q(inviter=user) | Q(invitee=user))),
            'benachrichtigungen': self.rows(Notification._base_manager.filter(user=user)),
            'sitzungen': self.rows(UserSession._base_manager.filter(user=user)),
            'anmeldungen': self.rows(AccessLog._base_manager.filter(username=user.username)),
            'fehlgeschlagene_anmeldungen': self.rows(AccessFailureLog._base_manager.filter(username=user.username)),
            'beta_feedback': self.rows(BetaFeedback._base_manager.filter(user=user)),
            # mit Google/Apple verknüpfte Anmeldungen (Anbieter, Kennung beim Anbieter, E-Mail beim Verknüpfen)
            'verknuepfte_anmeldungen': self.rows(SocialAccount._base_manager.filter(user=user)),
            # Sicherheitsprotokoll: eigene Anmeldungen, Fehlversuche, Sperren (IP nur gekürzt)
            'anmelde_ereignisse': self.rows(AuthEvent._base_manager.filter(user=user)),
        })

        finanzen = self.section('Finanzen', {
            'kategorien': self.rows(Category._base_manager.filter(owner=user)),
            # auch weich gelöschte Transaktionen (deleted_at gesetzt) — sie sind noch gespeichert, also Auskunftspflicht
            'transaktionen': self.rows(Transaction._base_manager.filter(owner=user)),
            'monatsbudgets': self.rows(MonthlyBudget._base_manager.filter(owner=user)),
            'sparziele': self.rows(SavingsGoal._base_manager.filter(owner=user)),
            'sparbeitraege': self.rows(SavingsContribution._base_manager.filter(owner=user)),
            # frühere gemeinsame Haushaltsfinanzen (eingefroren, nur lesbar)
            'haushalt_alt_konten': self.rows(Account._base_manager.filter(household__in=legacy)),
            'haushalt_alt_kategorien': self.rows(Category._base_manager.filter(household__in=legacy, owner__isnull=True)),
            'haushalt_alt_transaktionen': self.rows(Transaction._base_manager.filter(account__household__in=legacy)),
            'haushalt_alt_budgets': self.rows(Budget._base_manager.filter(household__in=legacy)),
            'haushalt_alt_feste_abzuege': self.rows(RecurringDeduction._base_manager.filter(household__in=legacy)),
        })

        haushalt = self.section('Haushalt', {
            'haushalte': self.rows(Household._base_manager.filter(id__in=households)),
            # Einkommen anderer bleibt privat — das eigene steht in konto.json › haushalt_mitgliedschaften
            'mitglieder': self.rows(HouseholdMembership._base_manager.filter(household__in=households), exclude=('monthly_income',)),
            'einkaufslisten': self.rows(ShoppingList._base_manager.filter(household__in=households)),
            'einkaufsartikel': self.rows(ShoppingItem._base_manager.filter(shopping_list__household__in=households)),
            'artikel_vorschlaege': self.rows(ItemMemory._base_manager.filter(household__in=households)),
            'einkaeufe': self.rows(ShoppingTrip._base_manager.filter(household__in=households)),
            'aufgaben': self.rows(Task._base_manager.filter(household__in=households)),
            'erledigungen': self.rows(TaskCompletion._base_manager.filter(household__in=households)),
            'ordner': self.rows(FolderEntry._base_manager.filter(household__in=households)),
            'ordner_anhaenge': self.rows(FolderAttachment._base_manager.filter(entry__household__in=households), files_dir='dateien/haushalt'),
        })

        organisation = self.section('Organisation', {
            'termine': self.rows(PersonalEvent._base_manager.filter(owner=user)),
            'termin_freigaben': self.rows(EventShare._base_manager.filter(event__owner=user)),
            'kalender': self.rows(SharedCalendar._base_manager.filter(owner=user)),
            'kalender_mitglieder': self.rows(CalendarMember._base_manager.filter(calendar__owner=user)),
            'kalender_freigaben': self.rows(CalendarShare._base_manager.filter(Q(owner=user) | Q(grantee=user))),
            # nur der Verweis: welche Kalender/Termine anderer mit dir geteilt sind — deren Inhalt gehört den anderen
            'mit_dir_geteilte_kalender': self.rows(CalendarMember._base_manager.filter(user=user).exclude(calendar__owner=user)),
            'mit_dir_geteilte_termine': self.rows(EventShare._base_manager.filter(user=user)),
            'aufgaben': self.rows(PersonalTask._base_manager.filter(owner=user)),
            'notizen': self.rows(PersonalNote._base_manager.filter(owner=user)),
            'dateien': self.rows(PersonalFile._base_manager.filter(owner=user), files_dir='dateien/organisation'),
            'haushaltskalender': self.rows(CalendarEvent._base_manager.filter(household__in=households)),
        })

        reisen = self.section('Reisen', {
            'reisen': self.rows(Trip._base_manager.filter(id__in=trips)),
            'teilnehmende': self.rows(TripParticipant._base_manager.filter(trip__in=trips)),
            'ablauf': self.rows(TripEvent._base_manager.filter(trip__in=trips)),
            'planung': self.rows(TripTask._base_manager.filter(trip__in=trips)),
            'packliste': self.rows(PackingItem._base_manager.filter(trip__in=trips)),
            'budget': self.rows(TripBudgetCategory._base_manager.filter(trip__in=trips)),
            'ausgaben': self.rows(TripExpense._base_manager.filter(trip__in=trips)),
            'beglichen': self.rows(TripSettlement._base_manager.filter(trip__in=trips)),
        })

        verknuepfungen = self.section('Verknüpfungen', {
            'verknuepfungen': self.rows(Connection._base_manager.filter(created_by=user)),
            'automatische_verbindungen': self.rows(AutoLink._base_manager.filter(owner=user)),
            'automatische_verbindungen_verlauf': self.rows(AutoLinkEvent._base_manager.filter(owner=user)),
            'ausgeblendete_vorschlaege': self.rows(SuggestionDismissal._base_manager.filter(user=user)),
        })

        return {
            'konto.json': konto, 'finanzen.json': finanzen, 'haushalt.json': haushalt,
            'organisation.json': organisation, 'reisen.json': reisen, 'verknuepfungen.json': verknuepfungen,
        }


README = """4inOne – Export deiner Daten
============================

Erstellt am: {created}
Konto: {email}

Diese Datei enthält alle Daten, die 4inOne zu deinem Konto gespeichert hat (Auskunft nach Art. 15 DSGVO und
Datenübertragbarkeit nach Art. 20 DSGVO). Die JSON-Dateien lassen sich mit jedem Texteditor öffnen und von anderen
Programmen einlesen.

Inhalt
------
konto.json          Profil, Einstellungen, Kontakte, Einladungen, Benachrichtigungen, Geräte/Sitzungen, Anmeldungen
                    (inkl. Sicherheitsprotokoll mit gekürzter IP-Adresse)
finanzen.json       private Finanzen: Kategorien, Transaktionen (auch gelöschte, Feld deleted_at), Budgets, Sparziele
haushalt.json       Haushalte, in denen du Mitglied bist: Aufgaben, Einkauf, Ordner (Verträge, Geräte)
organisation.json   Termine, Kalender, Aufgaben, Notizen, Dateien
reisen.json         Reisen, die du angelegt hast oder an denen du teilnimmst
verknuepfungen.json Verbindungen zwischen Einträgen und ausgeblendete Vorschläge
dateien/            alle hochgeladenen Dateien (Fotos ohne Standort- und Kameradaten, so wie gespeichert)

Gut zu wissen
-------------
- Gemeinsame Bereiche (Haushalt, Reisen) enthalten auch Einträge anderer Mitglieder – so, wie du sie in der App siehst.
  Andere Personen stehen nur mit ihrem Anzeigenamen darin, du selbst als „Du“.
- Nicht enthalten: dein Passwort, Schlüssel und Ersatzcodes der Zwei-Faktor-Anmeldung, Anmelde-Token (das sind
  Geheimnisse, keine Auskunft), das Einkommen anderer Haushaltsmitglieder und der Inhalt privater Kalender anderer
  Personen, die nur mit dir geteilt sind (die gehören der anderen Person).
- Beträge stehen als Text mit Punkt („1234.50“), damit keine Rundung entsteht. Zeitangaben im Format ISO 8601.
- Bewahre diese Datei sicher auf – sie enthält persönliche und finanzielle Angaben.

Anzahl der Einträge
-------------------
{counts}
{missing}"""


def build_export(user):
    """Liefert (geöffnete temporäre Datei mit dem ZIP, Dateiname). Bis 64 MB im Speicher, darüber auf der Platte."""
    export = _Export(user)
    sections = export.build()
    now = timezone.localtime()
    tmp = tempfile.SpooledTemporaryFile(max_size=64 * 1024 * 1024)
    missing = []
    with zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as archive:
        for filename, data in sections.items():
            archive.writestr(filename, json.dumps(data, ensure_ascii=False, indent=2))
        for path, fieldfile in export.files:
            try:
                with fieldfile.open('rb') as source, archive.open(path, 'w') as target:
                    shutil.copyfileobj(source, target, 1024 * 1024)
            except (FileNotFoundError, OSError):
                missing.append(path)
        counts = '\n'.join(f'{key}: {value}' for key, value in export.counts.items() if value)
        missing_text = ('\nNicht mehr auf dem Server vorhanden (nur der Eintrag ist enthalten):\n' + '\n'.join(missing) + '\n') if missing else ''
        archive.writestr('LIESMICH.txt', README.format(
            created=now.strftime('%d.%m.%Y %H:%M'), email=user.email, counts=counts or '(noch keine Einträge)',
            missing=missing_text,
        ))
    tmp.seek(0)
    return tmp, f'4inone-daten-{now:%Y-%m-%d}.zip', export.exported_models
