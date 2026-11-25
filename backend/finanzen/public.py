"""Öffentliche Schnittstelle von Finanzen für andere Bereiche (docs/ARCHITECTURE.md § 3.1 Regel 3, 24.11.2026).

Andere Bereiche importieren aus `finanzen` NUR dieses Modul. Alles andere (Modelle, Services, Views) ist intern und
darf sich ändern, ohne dass Haushalt, Organisation oder Reisen brechen. Der Architekturtest
(`core/test_architecture.py`) prüft das.

Heutige Nutzer: Haushalt › Einkauf abschließen (Ausgabe buchen, Kategorie wählen), Haushalt › Lastanzeige (Monat).
"""

from finanzen.models import Category
from finanzen.services import PRIVATE_SHOPPING_CATEGORY, book_shopping_expense, month_bounds

__all__ = ['Category', 'PRIVATE_SHOPPING_CATEGORY', 'book_shopping_expense', 'month_bounds']
