"""Haushaltsordner › Fotos & PDF an Geräten und Verträgen (31.10.2026).

Anna (Admin) und Ben (Mitglied) teilen einen Haushalt, Kim ist ein Kind-Konto, Fremd gehört zu einem anderen Haushalt.
Anhängen dürfen alle erwachsenen Mitglieder; löschen nur, wer hochgeladen hat, und Admins."""

import io
import os

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from core.models import HouseholdMembership
from haushalt import services
from haushalt.models import FolderAttachment

pytestmark = pytest.mark.django_db

URL = '/api/v1/haushalt/ordner/'
PDF = b'%PDF-1.7\n%\xe2\xe3\xcf\xd3\n1 0 obj\n'


@pytest.fixture(autouse=True)
def private_media(tmp_path, settings):
    settings.PRIVATE_MEDIA_ROOT = tmp_path / 'private'


@pytest.fixture
def admin(anna):
    HouseholdMembership.objects.filter(user=anna).update(role=HouseholdMembership.Role.ADMIN)
    return anna


def _image(fmt='JPEG', **save) -> bytes:
    from PIL import Image

    out = io.BytesIO()
    Image.new('RGB', (30, 20), (90, 140, 200)).save(out, fmt, **save)
    return out.getvalue()


def _jpeg_with_gps() -> bytes:
    from PIL import Image

    exif = Image.Exif()
    exif[0x010F] = 'Testkamera'
    exif[0x8825] = {1: 'N', 2: (52.0, 31.0, 12.0), 3: 'E', 4: (13.0, 24.0, 18.0)}
    return _image(exif=exif)


def _device(client, name='Waschmaschine'):
    return client.post(URL, {'kind': 'geraet', 'name': name}, format='json').data['id']


def _attach(client, entry, name='typenschild.jpg', content=None):
    content = _jpeg_with_gps() if content is None else content
    return client.post(f'{URL}{entry}/anhaenge/', {'file': SimpleUploadedFile(name, content)}, format='multipart')


def test_member_attaches_a_photo_without_location_data_and_the_household_sees_it(admin, ben, client_for):
    from PIL import Image

    entry = _device(client_for(ben))
    r = _attach(client_for(ben), entry)
    assert r.status_code == 201, r.data
    stored = b''.join(client_for(admin).get(f"{URL}{entry}/anhaenge/{r.data['id']}/").streaming_content)
    with Image.open(io.BytesIO(stored)) as image:
        assert not image.getexif()
    assert b'Testkamera' not in stored
    listed = client_for(admin).get(f'{URL}{entry}/').data['attachments']
    assert [a['name'] for a in listed] == ['typenschild.jpg']


def test_only_the_uploader_and_admins_may_delete(admin, ben, client_for, household):
    entry = _device(client_for(admin))
    from_admin = _attach(client_for(admin), entry).data
    from_ben = _attach(client_for(ben), entry, 'bon.pdf', PDF).data

    bens_view = {a['id']: a['can_delete'] for a in client_for(ben).get(f'{URL}{entry}/').data['attachments']}
    assert bens_view == {from_admin['id']: False, from_ben['id']: True}
    assert client_for(ben).delete(f"{URL}{entry}/anhaenge/{from_admin['id']}/").status_code == 403
    assert client_for(ben).delete(f"{URL}{entry}/anhaenge/{from_ben['id']}/").status_code == 204

    third = _attach(client_for(ben), entry).data
    assert client_for(admin).delete(f"{URL}{entry}/anhaenge/{third['id']}/").status_code == 204
    assert list(FolderAttachment.objects.values_list('id', flat=True)) == [from_admin['id']]


def test_edit_keeps_attachments_and_more_can_be_added_later(admin, client_for):
    client = client_for(admin)
    entry = _device(client)
    _attach(client, entry)
    assert client.patch(f'{URL}{entry}/', {'name': 'Waschmaschine Keller'}, format='json').status_code == 200
    _attach(client, entry, 'rechnung.pdf', PDF)
    assert [a['name'] for a in client.get(f'{URL}{entry}/').data['attachments']] == ['typenschild.jpg', 'rechnung.pdf']


def test_other_households_and_child_accounts_have_no_access(admin, kind, fremd, client_for):
    entry = _device(client_for(admin))
    attachment = _attach(client_for(admin), entry).data
    for outsider, expected in ((fremd, 404), (kind, 403)):
        client = client_for(outsider)
        assert client.get(f"{URL}{entry}/anhaenge/{attachment['id']}/").status_code == expected
        assert client.delete(f"{URL}{entry}/anhaenge/{attachment['id']}/").status_code == expected
        assert _attach(client, entry).status_code == expected
    assert FolderAttachment.objects.count() == 1


def test_an_attachment_id_of_another_entry_is_not_found(admin, client_for):
    client = client_for(admin)
    first, second = _device(client, 'A'), _device(client, 'B')
    attachment = _attach(client, first).data
    assert client.get(f"{URL}{second}/anhaenge/{attachment['id']}/").status_code == 404
    assert client.delete(f"{URL}{second}/anhaenge/{attachment['id']}/").status_code == 404


def test_only_photos_and_pdf_and_limits(admin, client_for, monkeypatch):
    client = client_for(admin)
    entry = _device(client)
    assert _attach(client, entry, 'liste.txt', b'Pass').status_code == 400
    assert _attach(client, entry, 'evil.svg', b'<svg onload=alert(1)>').status_code == 400
    assert _attach(client, entry, 'kaputt.jpg', b'\xff\xd8\xff' + b'\x00' * 40).status_code == 400
    monkeypatch.setattr(services, 'MAX_FOLDER_ATTACHMENTS', 1)
    assert _attach(client, entry).status_code == 201
    assert _attach(client, entry).status_code == 400
    monkeypatch.setattr(services, 'MAX_FOLDER_ATTACHMENTS', 10)
    monkeypatch.setattr(services, 'FOLDER_FILES_QUOTA', 10)
    assert _attach(client, entry).status_code == 400


def test_deleting_the_entry_removes_the_stored_files(admin, client_for, django_capture_on_commit_callbacks):
    client = client_for(admin)
    entry = _device(client)
    attachment = _attach(client, entry).data
    path = FolderAttachment.objects.get(pk=attachment['id']).file.path
    with django_capture_on_commit_callbacks(execute=True):
        assert client.delete(f'{URL}{entry}/').status_code == 204
    assert not FolderAttachment.objects.exists()
    assert not os.path.exists(path)
