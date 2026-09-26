"""Gibt bestehenden privaten Kategorien einmalig feste Farben.

Bisher färbte die Oberfläche die Kategorien nach ihrer Position in der Liste;
das gespeicherte Feld color wurde nicht angezeigt und steht bei privaten
Kategorien überall auf dem Modell-Standard. Deshalb bekommt jede Person ihre
Kategorien der Reihe nach (nach Anlage-ID) aus der festen Palette. Haushalts-
Kategorien (owner = NULL) bleiben unverändert.
"""

from django.db import migrations

# Bewusst kopiert statt importiert: Migrationen dürfen sich nicht ändern, wenn
# die Palette in finanzen/category_colors.py später angepasst wird.
PALETTE = ['#1f5c41', '#3a8a63', '#6db08c', '#a6d3b8', '#8a8f4e', '#b9a06a', '#6b7280', '#a8aeb8']


def assign_colors(apps, schema_editor):
    Category = apps.get_model('finanzen', 'Category')
    index_by_owner = {}
    for category in Category.objects.filter(owner__isnull=False).order_by('owner_id', 'id'):
        index = index_by_owner.get(category.owner_id, 0)
        category.color = PALETTE[index % len(PALETTE)]
        category.save(update_fields=['color'])
        index_by_owner[category.owner_id] = index + 1


class Migration(migrations.Migration):
    dependencies = [('finanzen', '0016_savings_goal_plan')]

    operations = [migrations.RunPython(assign_colors, migrations.RunPython.noop)]
