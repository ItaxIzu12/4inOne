"""Organisation: Kategorien, Projekte, Notizen und private Dateien."""
import io
import zipfile

import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from organisation import files as file_rules
from organisation.models import PersonalFile, PersonalNote

pytestmark = pytest.mark.django_db
BASE = '/api/v1/organisation/'
PNG = b'\x89PNG\r\n\x1a\n' + b'\x00' * 64
PDF = b'%PDF-1.7\n%\xe2\xe3\xcf\xd3\n1 0 obj\n'


@pytest.fixture(autouse=True)
def private_media(tmp_path, settings):
    settings.PRIVATE_MEDIA_ROOT = tmp_path / 'private'


@pytest.fixture
def users():
    return [get_user_model().objects.create_user(username=n, password='test-secret-234') for n in ['alice', 'bob']]


@pytest.fixture
def client(users):
    c = APIClient()
    c.force_authenticate(users[0])
    return c


def upload(client, name, content, **extra):
    return client.post(BASE + 'files/', {'file': SimpleUploadedFile(name, content), **extra}, format='multipart')


def test_event_category_and_task_project(client):
    event = client.post(BASE + 'events/', {'title': 'Zahnarzt', 'starts_at': '2026-09-24T10:00:00+02:00', 'category': 'gesundheit'}, format='json')
    assert event.status_code == 201 and event.data['category'] == 'gesundheit'
    assert client.post(BASE + 'events/', {'title': 'X', 'starts_at': '2026-09-24T10:00:00+02:00', 'category': 'party'}, format='json').status_code == 400
    plain = client.post(BASE + 'events/', {'title': 'Y', 'starts_at': '2026-09-24T10:00:00+02:00'}, format='json')
    assert plain.data['category'] == 'sonstiges'
    task = client.post(BASE + 'tasks/', {'title': 'Fliesen', 'project': ' Hausbau '}, format='json')
    assert task.data['project'] == 'Hausbau'


def test_notes_are_private_and_pinned_first(client, users):
    client.post(BASE + 'notes/', {'title': 'Alt', 'body': 'a'}, format='json')
    pinned = client.post(BASE + 'notes/', {'title': 'Wichtig', 'body': 'b', 'pinned': True}, format='json')
    assert pinned.status_code == 201
    assert [n['title'] for n in client.get(BASE + 'notes/').data] == ['Wichtig', 'Alt']
    assert client.post(BASE + 'notes/', {'title': '  '}, format='json').status_code == 400
    other = APIClient()
    other.force_authenticate(users[1])
    assert other.get(BASE + 'notes/').data == []
    assert other.patch(f"{BASE}notes/{pinned.data['id']}/", {'title': 'X'}, format='json').status_code == 404
    assert PersonalNote.objects.get(pk=pinned.data['id']).title == 'Wichtig'


def test_upload_detects_type_by_content_and_cleans_the_name(client, users):
    r = upload(client, '../../etc/Reise"plan.pdf', PDF)
    assert r.status_code == 201, r.data
    assert r.data['content_type'] == 'application/pdf'
    assert r.data['name'] == 'Reise_plan.pdf'
    assert 'file' not in r.data  # kein Speicherpfad nach außen
    stored = PersonalFile.objects.get(pk=r.data['id'])
    assert 'Reise' not in stored.file.name and stored.file.name.startswith(f'organisation/{users[0].pk}/')
    assert upload(client, 'bild.png', PNG).data['category'] == 'bild'


@pytest.mark.parametrize('name,content', [
    ('evil.pdf', b'<html><script>alert(1)</script>'),   # Inhalt passt nicht zur Endung
    ('evil.svg', b'<svg onload=alert(1)>'),             # SVG/HTML nie erlaubt
    ('bild.pdf', PNG),                                  # PNG mit PDF-Endung
    ('notiz.txt', b'<!doctype html><p>x'),              # „Text“ mit Markup
    ('programm.exe', b'MZ\x90\x00' + b'\x00' * 32),
])
def test_disallowed_or_mismatched_files_are_rejected(client, name, content):
    r = upload(client, name, content)
    assert r.status_code == 400
    assert PersonalFile.objects.count() == 0


def test_office_documents_are_recognised():
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w') as archive:
        archive.writestr('xl/workbook.xml', '<workbook/>')
    buffer.seek(0)
    assert file_rules.sniff(buffer.getvalue()[:2048], buffer) == file_rules.ALLOWED_KEYS['xlsx']


def test_size_limit_and_quota(client, monkeypatch):
    monkeypatch.setattr(file_rules, 'MAX_FILE_SIZE', 100)
    assert upload(client, 'gross.pdf', PDF + b'x' * 200).status_code == 400
    monkeypatch.setattr(file_rules, 'MAX_FILE_SIZE', 10_000)
    monkeypatch.setattr(file_rules, 'QUOTA', 150)
    assert upload(client, 'a.pdf', PDF + b'x' * 100).status_code == 201
    assert upload(client, 'b.pdf', PDF + b'x' * 100).status_code == 400
    storage = client.get(BASE + 'files/speicher/').data
    assert storage['quota'] == 150 and storage['used'] == len(PDF) + 100


def test_content_is_owner_only_and_served_safely(client, users):
    pdf = upload(client, 'plan.pdf', PDF).data
    txt = upload(client, 'liste.txt', b'Pass\nTicket\n').data
    response = client.get(f"{BASE}files/{pdf['id']}/inhalt/")
    assert response.status_code == 200
    assert b''.join(response.streaming_content) == PDF
    assert response['Content-Type'] == 'application/pdf'
    assert response['X-Content-Type-Options'] == 'nosniff'
    assert 'sandbox' in response['Content-Security-Policy']
    assert response['Content-Disposition'].startswith('inline')
    assert client.get(f"{BASE}files/{txt['id']}/inhalt/")['Content-Disposition'].startswith('attachment')
    assert client.get(f"{BASE}files/{pdf['id']}/inhalt/?download=1")['Content-Disposition'].startswith('attachment')

    other = APIClient()
    other.force_authenticate(users[1])
    assert other.get(f"{BASE}files/{pdf['id']}/inhalt/").status_code == 404
    assert other.get(BASE + 'files/').data == []
    assert other.delete(f"{BASE}files/{pdf['id']}/").status_code == 404
    assert APIClient().get(f"{BASE}files/{pdf['id']}/inhalt/").status_code in (401, 403)


def test_metadata_can_change_and_delete_removes_the_stored_file(client, django_capture_on_commit_callbacks):
    entry = upload(client, 'plan.pdf', PDF).data
    patched = client.patch(f"{BASE}files/{entry['id']}/", {'favorite': True, 'category': 'reise', 'name': 'Reise/Unterlagen.pdf'}, format='json')
    assert patched.status_code == 200
    assert patched.data['favorite'] is True and patched.data['category'] == 'reise' and patched.data['name'] == 'Unterlagen.pdf'
    assert client.patch(f"{BASE}files/{entry['id']}/", {'category': 'geheim'}, format='json').status_code == 400
    stored = PersonalFile.objects.get(pk=entry['id']).file
    path = stored.path
    with django_capture_on_commit_callbacks(execute=True):
        assert client.delete(f"{BASE}files/{entry['id']}/").status_code == 204
    import os
    assert not os.path.exists(path)
