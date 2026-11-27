"""Passt „Reisen“, „Wohnen“ und „Lebensmittel“ an die Veyora-Bereichsfarben an (28.11.2026).

Reisen folgt --travel-fill (#197390), Wohnen dem Farbton von --household-accent (Haushalt ist
jetzt orange/karamell), Lebensmittel wechselt von Orange zu Beere, damit es sich von Wohnen
unterscheidet (finanzen/category_colors.py). Umgefärbt werden nur private Kategorien, die noch
genau die alte, automatisch vergebene Farbe tragen. Haushalts-Kategorien (owner = NULL) und
selbst gewählte Farben bleiben unverändert. Rückwärts genau umkehrbar.
"""

from django.db import migrations

# Bewusst kopiert statt importiert: Eine Migration darf sich nicht ändern,
# wenn category_colors.py später angepasst wird.
CHANGES = {'#3d6b9a': '#197390', '#ab445f': '#ab632b', '#eb6834': '#a8326e'}


def recolor(apps, schema_editor, mapping=CHANGES):
    Category = apps.get_model('finanzen', 'Category')
    for old, new in mapping.items():
        Category.objects.filter(owner__isnull=False, color__iexact=old).update(color=new)


def restore(apps, schema_editor):
    recolor(apps, schema_editor, {new: old for old, new in CHANGES.items()})


class Migration(migrations.Migration):
    dependencies = [('finanzen', '0023_category_colors_area_tokens')]

    operations = [migrations.RunPython(recolor, restore)]
