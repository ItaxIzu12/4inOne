from django.db.models.signals import post_save
from django.dispatch import receiver

from core.models import Household
from finanzen.models import Category

# Farben exakt wie vorgegeben (nicht die früheren Migrations-Werte aus
# 0003_seed_category_colors.py, die nur bestehende, NAMENSGLEICHE
# Kategorien einmalig nachfärbten — dieses Signal ist der laufende
# Erzeugungsweg für JEDEN neuen Haushalt).
DEFAULT_CATEGORIES = [
    ('Fixkosten', '#5b3fd6', 'fixkosten'),
    ('Haushalt', '#ffb75e', 'haushalt'),
    ('Sonstiges', '#c23b52', 'sonstiges'),
]


@receiver(post_save, sender=Household)
def create_default_categories(sender, instance: Household, created: bool, **kwargs) -> None:
    """Jeder neue Haushalt bekommt sofort drei Standard-Kategorien, damit er
    nicht mit einer leeren Kategorien-Liste startet (siehe features/finanzen
    Kategorie-Chips beim Erfassen einer Ausgabe — ohne mindestens eine
    Kategorie wäre "Ausgabe hinzufügen" sonst nicht nutzbar).

    Bewusst ein Signal in finanzen/, nicht direkt in core/auth_views.py
    RegisterView: core darf laut ARCHITEKTUR.md §2.1 NICHT von finanzen
    importieren (nur umgekehrt) — ein Signal-Receiver hier hält sich an
    diese Richtung, während RegisterView unverändert bleibt.
    """
    if not created:
        return
    Category.objects.bulk_create(
        [
            Category(household=instance, name=name, color=color, icon_key=icon_key, is_default=True)
            for name, color, icon_key in DEFAULT_CATEGORIES
        ]
    )
