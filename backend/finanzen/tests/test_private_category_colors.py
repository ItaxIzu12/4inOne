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
STYLES = Path(__file__).resolve().parents[3] / 'frontend/src/styles.css'


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
    """Reisen = die Füllfarbe des Bereichs Reisen, Wohnen = derselbe Farbton wie
    der Bereich Haushalt. Geprüft gegen die Design-Tokens, die in der App
    wirklich gelten (frontend/src/styles.css, bei doppelten Werten der letzte)."""
    css = STYLES.read_text()
    tokens = {}
    for m in re.finditer(r'--(travel-fill|household-accent):\s*(#[0-9a-fA-F]{6})', css):
        tokens[m.group(1)] = m.group(2).lower()  # späterer Wert überschreibt
    assert tokens['travel-fill'] == cc.REISEN
    assert abs(_hue(tokens['household-accent']) - _hue(cc.WOHNEN)) < 6


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
    """0019 färbt nach Bedeutung, 0023 zieht Reisen/Wohnen auf die Bereichs-Tokens nach."""
    first = import_module('finanzen.migrations.0019_category_colors_by_meaning')
    tokens = import_module('finanzen.migrations.0023_category_colors_area_tokens')
    user = get_user_model().objects.create_user(username='mig')
    reisen = Category.objects.create(owner=user, name='Reisen', color='#1f5c41')
    eigene = Category.objects.create(owner=user, name='Haustier', color='#3a8a63')
    household_cat = Category.objects.create(household=user_household(), name='Reisen', color='#164c49')

    first.recolor(django_apps, None)
    tokens.recolor(django_apps, None)

    reisen.refresh_from_db(); eigene.refresh_from_db(); household_cat.refresh_from_db()
    assert reisen.color == cc.REISEN
    assert eigene.color == cc.NEUTRAL
    assert household_cat.color == '#164c49'  # Haushalts-Kategorien bleiben unberührt


def test_migrations_together_keep_the_same_mapping_as_the_live_code():
    """Die Migrationen kopieren die Zuordnung absichtlich. 0019 gefolgt von 0023
    muss genau die Farben des laufenden Codes ergeben."""
    first = import_module('finanzen.migrations.0019_category_colors_by_meaning')
    tokens = import_module('finanzen.migrations.0023_category_colors_area_tokens')
    for name in ['Reisen', 'Wohnen', 'Lebensmittel', 'Mobilität', 'Freizeit', 'Gesundheit', 'Sonstiges', 'Kino', 'xyz']:
        color = first.color_for_name(name)
        assert tokens.CHANGES.get(color, color) == cc.color_for_name(name)


def test_token_migration_only_touches_old_automatic_colors_and_is_reversible():
    tokens = import_module('finanzen.migrations.0023_category_colors_area_tokens')
    user = get_user_model().objects.create_user(username='mig2')
    alt_reisen = Category.objects.create(owner=user, name='Urlaub', color='#2E8AEF')  # Großschreibung egal
    alt_wohnen = Category.objects.create(owner=user, name='Miete', color='#c2336f')
    eigene_farbe = Category.objects.create(owner=user, name='Reisekasse', color='#123456')
    household_cat = Category.objects.create(household=user_household(), name='Wohnen', color='#c2336f')

    tokens.recolor(django_apps, None)
    for c in (alt_reisen, alt_wohnen, eigene_farbe, household_cat):
        c.refresh_from_db()
    assert (alt_reisen.color, alt_wohnen.color) == ('#3d6b9a', '#ab445f')
    assert eigene_farbe.color == '#123456'
    assert household_cat.color == '#c2336f'

    tokens.restore(django_apps, None)
    alt_reisen.refresh_from_db(); alt_wohnen.refresh_from_db()
    assert (alt_reisen.color, alt_wohnen.color) == ('#2e8aef', '#c2336f')


def user_household():
    from core.models import Household

    return Household.objects.create(name='Haushalt für Migrationstest')
