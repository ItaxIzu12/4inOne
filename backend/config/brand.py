"""Marke im Backend (docs/BRAND_CONFIGURATION.md).

Verbindliche Quelle ist frontend/src/app/core/brand/brand.config.ts. Diese Datei spiegelt nur, was das Backend
braucht; `npm run check:brand` (auch in CI) bricht ab, wenn die Werte voneinander abweichen.
Keine Django-Importe: settings.py liest die Datei, bevor Django eingerichtet ist.
"""

PRODUCT_NAME = 'Lumiknot'
PRODUCT_SLUG = 'lumiknot'
"""Technische Kurzform für neue Bezeichner (Dateinamen, neue Variablen `LUMIKNOT_…`)."""
