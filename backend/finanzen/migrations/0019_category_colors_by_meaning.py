"""Färbt private Kategorien nach ihrer Bedeutung statt nach Anlage-Reihenfolge.

0017 hatte die Palette der Reihe nach vergeben; danach war z. B. „Reisen“
nicht blau. Jetzt gilt die Zuordnung aus finanzen/category_colors.py:
Reisen = Blau des Bereichs Reisen, Wohnen = Rosa des Bereichs Haushalt usw.
Haushalts-Kategorien (owner = NULL) bleiben unverändert.
"""

from django.db import migrations

# Bewusst kopiert statt importiert: Eine Migration darf sich nicht ändern,
# wenn category_colors.py später angepasst wird.
NEUTRAL = '#8a93a3'
KEYWORDS = [
    ('#2e8aef', ('reise', 'urlaub', 'hotel', 'flug', 'ferien')),
    ('#c2336f', ('wohn', 'miete', 'nebenkosten', 'strom', 'heizung', 'möbel', 'haushalt')),
    ('#eb6834', ('lebensmittel', 'essen', 'supermarkt', 'einkauf', 'restaurant', 'lieferdienst', 'getränke')),
    ('#4a3aa7', ('mobil', 'auto', 'tank', 'bahn', 'öpnv', 'fahrrad', 'taxi', 'parken')),
    ('#1baf7a', ('gesund', 'arzt', 'apotheke', 'medikament', 'zahn', 'therapie')),
    ('#dca800', ('freizeit', 'hobby', 'sport', 'fitness', 'kino', 'konzert', 'streaming', 'kultur')),
]


def color_for_name(name):
    lowered = name.strip().lower()
    for color, keywords in KEYWORDS:
        if any(keyword in lowered for keyword in keywords):
            return color
    return NEUTRAL


def recolor(apps, schema_editor):
    Category = apps.get_model('finanzen', 'Category')
    for category in Category.objects.filter(owner__isnull=False):
        color = color_for_name(category.name)
        if category.color != color:
            category.color = color
            category.save(update_fields=['color'])


class Migration(migrations.Migration):
    dependencies = [('finanzen', '0018_savings_goal_period_backfill')]

    operations = [migrations.RunPython(recolor, migrations.RunPython.noop)]
