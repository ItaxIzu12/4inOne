"""DSGVO-Datenexport: jede Person bekommt genau das, was sie in der App sieht — vollständig, ohne Geheimnisse.

Nutzt die Welt der Rechte-Matrix (core/test_permission_matrix.py): Sophie hat private Daten (Marker GEHEIM), einen
Haushalt mit Alex (HAUSHALT) und eine Reise mit Ben (BERLIN); Eve ist fremd. Geprüft wird der komplette ZIP-Inhalt,
auch die hochgeladenen Dateien.
"""

import io
import json
import zipfile
from datetime import timedelta
from decimal import Decimal

import pytest
from django.apps import apps
from django.core.cache import caches
from django.utils import timezone
from django_otp.plugins.otp_totp.models import TOTPDevice

from core.models import ContactInvite, HouseholdMembership, MfaBackupCode, PasswordResetToken, UserSession
from core.test_permission_matrix import ALLOWED, HOUSEHOLD, PRIVATE, TRIP, api, world  # noqa: F401 (Fixture)
from datenexport.export import EXCLUDED_MODELS, build_export
from finanzen.models import Transaction

pytestmark = pytest.mark.django_db
URL = '/api/v1/auth/export/'
PROJECT_APPS = {'core', 'finanzen', 'haushalt', 'organisation', 'reisen', 'connections', 'website', 'integrations', 'datenexport',
                'monitoring'}


@pytest.fixture(autouse=True)
def fresh_rate_limits():
    caches['throttle'].clear()


def _download(user):
    response = api(user).get(URL)
    assert response.status_code == 200, response.status_code
    assert response['Content-Type'] == 'application/zip'
    assert 'attachment; filename="4inone-daten-' in response['Content-Disposition']
    assert response['Cache-Control'] == 'no-store'
    return zipfile.ZipFile(io.BytesIO(b''.join(response.streaming_content)))


def _everything(archive) -> str:
    return '\n'.join(archive.read(name).decode('utf-8', errors='ignore') for name in archive.namelist())


@pytest.mark.parametrize('who', ['sophie', 'alex', 'ben', 'eve'])
def test_each_person_gets_exactly_what_the_app_shows_them(world, who):
    archive = _download(world[who])
    text = _everything(archive)
    for marker in (PRIVATE, HOUSEHOLD, TRIP):
        if marker in ALLOWED[who]:
            assert marker in text, f'{who} fehlt {marker}'
        else:
            assert marker not in text, f'{who} bekommt fremde Daten ({marker})'
    assert {'LIESMICH.txt', 'konto.json', 'finanzen.json', 'haushalt.json', 'organisation.json', 'reisen.json',
            'verknuepfungen.json'} <= set(archive.namelist())


def test_owner_export_contains_every_area_and_the_uploaded_file_itself(world):
    archive = _download(world['sophie'])
    finanzen = json.loads(archive.read('finanzen.json'))
    reisen = json.loads(archive.read('reisen.json'))
    organisation = json.loads(archive.read('organisation.json'))
    assert any(t['description'] == f'{PRIVATE}-Ausgabe' for t in finanzen['transaktionen'])
    assert reisen['reisen'][0]['title'] == f'{TRIP}-Wochenende'
    # die Datei selbst liegt im ZIP, der Eintrag verweist darauf
    path = organisation['dateien'][0]['file']
    assert path.startswith('dateien/organisation/') and archive.read(path) == f'{PRIVATE}-Inhalt'.encode()
    # andere Personen nur mit Anzeigenamen, man selbst als „Du“
    konto = json.loads(archive.read('konto.json'))
    assert konto['profil']['email'] == 'sophie@example.com'
    assert {c['other'] for c in konto['kontakte']} == {'Alex', 'Ben'}
    assert reisen['reisen'][0]['owner'] == 'Du'
    assert 'alex@example.com' not in _everything(archive) and 'ben@example.com' not in _everything(archive)


def test_no_secrets_ever_leave_the_server(world):
    sophie = world['sophie']
    now = timezone.now()
    PasswordResetToken.objects.create(user=sophie, token='RESET-SECRET-1', expires_at=now + timedelta(hours=1))
    MfaBackupCode.objects.create(user=sophie, code_hash='BACKUP-HASH-SECRET')
    UserSession.objects.create(user=sophie, sid='SID-SECRET-1', current_jti='JTI-SECRET-1', user_agent='Safari', last_seen=now)
    ContactInvite.objects.create(inviter=sophie, email='freund@example.com', token='INVITE-SECRET-1', expires_at=now + timedelta(days=7))
    TOTPDevice.objects.create(user=sophie, name='Telefon', confirmed=True, key='3132333435363738393031323334353637383930')

    archive = _download(sophie)
    text = _everything(archive)
    for secret in ('RESET-SECRET-1', 'BACKUP-HASH-SECRET', 'SID-SECRET-1', 'JTI-SECRET-1', 'INVITE-SECRET-1',
                   '3132333435363738393031323334353637383930', sophie.password, 'argon2'):
        assert secret not in text, secret
    konto = json.loads(archive.read('konto.json'))
    assert konto['profil']['zwei_faktor_aktiv'] is True
    assert konto['sitzungen'][0]['user_agent'] == 'Safari'  # das Gerät selbst ist Auskunft, die Kennung nicht
    assert konto['kontakt_einladungen'][0]['email'] == 'freund@example.com'


def test_the_income_of_other_household_members_stays_private(world):
    HouseholdMembership.objects.filter(user=world['sophie']).update(monthly_income=Decimal('4321.09'))
    HouseholdMembership.objects.filter(user=world['alex']).update(monthly_income=Decimal('1234.56'))
    text = _everything(_download(world['alex']))
    assert '1234.56' in text  # das eigene Einkommen gehört in die Auskunft
    assert '4321.09' not in text


def test_soft_deleted_transactions_are_still_disclosed(world):
    transaction = world['objs']['transaction']
    transaction.soft_delete()
    finanzen = json.loads(_download(world['sophie']).read('finanzen.json'))
    row = next(t for t in finanzen['transaktionen'] if t['id'] == transaction.pk)
    assert row['deleted_at'] is not None
    assert Transaction.objects.filter(pk=transaction.pk).count() == 0  # in der App weg, im Export noch da


def test_a_file_missing_on_disk_does_not_break_the_export(world):
    world['objs']['file'].file.storage.delete(world['objs']['file'].file.name)
    archive = _download(world['sophie'])
    assert 'Nicht mehr auf dem Server vorhanden' in archive.read('LIESMICH.txt').decode()


def test_export_requires_login_and_is_rate_limited(world):
    from rest_framework.test import APIClient

    assert APIClient().get(URL).status_code == 401
    client = api(world['eve'])
    assert client.get(URL).status_code == 200
    assert client.get(URL).status_code == 200
    assert client.get(URL).status_code == 429  # RATE_LIMIT_DATA_EXPORT (Standard 2/min)


def test_every_model_is_exported_or_excluded_on_purpose(world):
    """Kommt ein neues Modell dazu, wird dieser Test rot, bis es exportiert oder begründet ausgenommen ist."""
    _, _, exported = build_export(world['sophie'])
    project_models = {m._meta.label for m in apps.get_models() if m._meta.app_label in PROJECT_APPS}
    missing = project_models - exported - EXCLUDED_MODELS.keys()
    assert not missing, f'Neue Modelle ohne Entscheidung im Datenexport: {sorted(missing)}'
    assert not (exported & EXCLUDED_MODELS.keys())
