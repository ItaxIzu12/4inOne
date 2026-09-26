"""Kategorie-Farben: fest, nach Bedeutung, nie nach Listenposition.

Früher färbte die Oberfläche nach Position; eine neue Kategorie mit hohem
Betrag schob alle anderen eine Zeile nach unten und damit in eine andere
Farbe. Außerdem soll „Reisen“ das Blau des Bereichs Reisen tragen."""

import colorsys
import re
from importlib import import_module
from pathlib import Path

import pytest
from django.apps import apps as django_apps
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from finanzen import category_colors as cc
from finanzen.models import Category

pytestmark = pytest.mark.django_db
BASE = '/api/v1/finanzen/private/'
APP_SHELL = Path(__file__).resolve().parents[3] / 'frontend/src/app/layout/app-shell.scss'


@pytest.fixture
def client_user():
    user = get_user_model().objects.create_user(username='farben@example.com')
    client = APIClient()
    client.force_authenticate(user)
    return client, user


def _expense(client, category_id, amount):
    response = client.post(
        BASE + 'transactions/',
        {'amount': amount, 'type': 'EXPENSE', 'category': category_id, 'date': '2026-09-10'},
        format='json',
    )
    assert response.status_code == 201, response.data


def _summary(client):
    data = client.get(BASE + 'summary/?month=2026-09').data['categories']
    return {row['name']: row['color'] for row in data}, [row['name'] for row in data]


def test_default_categories_get_their_meaning_color(client_user):
    client, _ = client_user
    colors = {row['name']: row['color'] for row in client.post(BASE + 'categories/setup/').data}
    assert colors == {
        'Wohnen': cc.WOHNEN,
        'Lebensmittel': cc.LEBENSMITTEL,
        'Mobilität': cc.MOBILITAET,
        'Freizeit': cc.FREIZEIT,
        'Gesundheit': cc.GESUNDHEIT,
        'Reisen': cc.REISEN,
        'Sonstiges': cc.NEUTRAL,
    }
    # Jede Standard-Kategorie ist unterscheidbar.
    assert len(set(colors.values())) == len(colors)


def _hue(hex_color):
    r, g, b = (int(hex_color[i:i + 2], 16) / 255 for i in (1, 3, 5))
    return colorsys.rgb_to_hls(r, g, b)[0] * 360


def test_travel_and_home_match_the_area_colors_of_the_app():
    """Reisen = genau das Blau des Bereichs Reisen, Wohnen = derselbe Farbton
    wie der Bereich Haushalt (eine dunklere Stufe). Geprüft gegen die Werte,
    die in der App wirklich gelten: bei doppelten Regeln der letzte Block."""
    scss = APP_SHELL.read_text()
    area = {}
    for m in re.finditer(r'^\.(travel|household)\s*\{\s*color:\s*(#[0-9a-fA-F]{6})', scss, re.M):
        area[m.group(1)] = m.group(2).lower()  # späterer Block überschreibt
    assert area['travel'] == cc.REISEN
    assert abs(_hue(area['household']) - _hue(cc.WOHNEN)) < 6


@pytest.mark.parametrize('name,color', [
    ('Urlaub Italien', cc.REISEN), ('Miete', cc.WOHNEN), ('Supermarkt', cc.LEBENSMITTEL),
    ('Auto & Tanken', cc.MOBILITAET), ('Apotheke', cc.GESUNDHEIT), ('Fitnessstudio', cc.FREIZEIT),
    ('Haustier', cc.NEUTRAL),
])
def test_own_categories_are_colored_by_meaning(client_user, name, color):
    client, _ = client_user
    response = client.post(BASE + 'categories/', {'name': name}, format='json')
    assert response.status_code == 201, response.data
    assert response.data['color'] == color


def test_colors_stay_when_a_new_category_reorders_the_summary(client_user):
    client, _ = client_user
    cats = {row['name']: row['id'] for row in client.post(BASE + 'categories/setup/').data}
    _expense(client, cats['Lebensmittel'], '80.00')
    _expense(client, cats['Mobilität'], '40.00')
    before, order_before = _summary(client)
    assert order_before == ['Lebensmittel', 'Mobilität']

    _expense(client, cats['Reisen'], '120.00')  # größter Betrag, rutscht nach oben

    after, order_after = _summary(client)
    assert order_after == ['Reisen', 'Lebensmittel', 'Mobilität']
    assert after['Lebensmittel'] == before['Lebensmittel'] == cc.LEBENSMITTEL
    assert after['Mobilität'] == before['Mobilität'] == cc.MOBILITAET
    assert after['Reisen'] == cc.REISEN


def test_color_cannot_be_set_by_the_client(client_user):
    client, _ = client_user
    response = client.post(BASE + 'categories/', {'name': 'Rot', 'color': '#ff0000'}, format='json')
    assert response.status_code == 201
    assert response.data['color'] == cc.NEUTRAL


def test_summary_marks_uncategorised_expenses_like_sonstiges(client_user):
    client, user = client_user
    cat = Category.objects.create(owner=user, name='Weg', color=cc.REISEN)
    _expense(client, cat.id, '10.00')
    cat.delete()  # Transaction.category wird NULL
    row = client.get(BASE + 'summary/?month=2026-09').data['categories'][0]
    assert row['name'] == 'Sonstiges'
    assert row['color'] == cc.UNCATEGORISED_COLOR == cc.NEUTRAL


def test_migration_recolors_existing_categories_by_meaning():
    migration = import_module('finanzen.migrations.0019_category_colors_by_meaning')
    user = get_user_model().objects.create_user(username='mig')
    reisen = Category.objects.create(owner=user, name='Reisen', color='#1f5c41')
    eigene = Category.objects.create(owner=user, name='Haustier', color='#3a8a63')
    household_cat = Category.objects.create(household=user_household(), name='Reisen', color='#164c49')

    migration.recolor(django_apps, None)

    reisen.refresh_from_db(); eigene.refresh_from_db(); household_cat.refresh_from_db()
    assert reisen.color == cc.REISEN
    assert eigene.color == cc.NEUTRAL
    assert household_cat.color == '#164c49'  # Haushalts-Kategorien bleiben unberührt


def test_migration_keeps_the_same_mapping_as_the_live_code():
    """Die Migration kopiert die Zuordnung absichtlich. Solange beide existieren,
    müssen sie übereinstimmen."""
    migration = import_module('finanzen.migrations.0019_category_colors_by_meaning')
    for name in ['Reisen', 'Wohnen', 'Lebensmittel', 'Mobilität', 'Freizeit', 'Gesundheit', 'Sonstiges', 'Kino', 'xyz']:
        assert migration.color_for_name(name) == cc.color_for_name(name)


def user_household():
    from core.models import Household

    return Household.objects.create(name='Haushalt für Migrationstest')
