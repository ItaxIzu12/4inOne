"""Passt die Farben „Reisen“ und „Wohnen“ an die Bereichsfarben der App an.

Die Bereichsfarben stehen inzwischen als Design-Tokens in frontend/src/styles.css
(Reisen --travel-fill #3d6b9a, Haushalt --household-accent #ab445f). Umgefärbt
werden nur private Kategorien, die noch genau die alte, automatisch vergebene
Farbe tragen. Haushalts-Kategorien (owner = NULL) bleiben unverändert.
"""

from django.db import migrations

# Bewusst kopiert statt importiert: Eine Migration darf sich nicht ändern,
# wenn category_colors.py später angepasst wird.
CHANGES = {'#2e8aef': '#3d6b9a', '#c2336f': '#ab445f'}


def recolor(apps, schema_editor, mapping=CHANGES):
    Category = apps.get_model('finanzen', 'Category')
    for old, new in mapping.items():
        Category.objects.filter(owner__isnull=False, color__iexact=old).update(color=new)


def restore(apps, schema_editor):
    recolor(apps, schema_editor, {new: old for old, new in CHANGES.items()})


class Migration(migrations.Migration):
    dependencies = [('finanzen', '0022_buchung_wiederkehrend')]

    operations = [migrations.RunPython(recolor, restore)]
