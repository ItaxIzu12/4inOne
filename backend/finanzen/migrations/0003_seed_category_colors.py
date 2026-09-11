from django.db import migrations

# Bisherige, im Frontend hartkodierte Werte (siehe features/finanzen/finanzen.ts
# vor diesem Umbau) — hier als bekannte Fixture-Werte übernommen, NICHT
# zufällig neu vergeben. Betrifft nur Kategorien, die bereits unter genau
# diesem Namen existieren; legt selbst keine neuen Kategorien an (Category
# ist pro Haushalt frei definierbar, es gibt keinen globalen Standard-Satz).
KNOWN_CATEGORY_COLORS = {
    'Fixkosten': {'color': '#5b3fd6', 'icon_key': 'fixkosten'},
    'Haushalt': {'color': '#a15f14', 'icon_key': 'haushalt'},
    'Sonstiges': {'color': '#c23b52', 'icon_key': 'sonstiges'},
}


def seed_known_category_colors(apps, schema_editor):
    Category = apps.get_model('finanzen', 'Category')
    for name, values in KNOWN_CATEGORY_COLORS.items():
        Category.objects.filter(name=name).update(**values)


def noop_reverse(apps, schema_editor):
    # Absichtlich kein Zurücksetzen auf einen "vorherigen" Farbwert — vor
    # dieser Migration gab es das Feld schlicht nicht.
    pass


class Migration(migrations.Migration):
    dependencies = [
        ('finanzen', '0002_category_color_category_icon_key'),
    ]

    operations = [
        migrations.RunPython(seed_known_category_colors, noop_reverse),
    ]
