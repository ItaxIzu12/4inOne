from django.contrib import admin

from config.brand import PRODUCT_NAME

# Marke im Django-Admin (Kopfzeile, Browser-Titel, Startseite). Nur Beschriftungen; Pfad (ADMIN_URL_PATH), Rechte und
# Modelle bleiben unverändert. Name aus config/brand.py (gespiegelt aus frontend/…/brand.config.ts).
admin.site.site_header = f'{PRODUCT_NAME} – Verwaltung'
admin.site.site_title = PRODUCT_NAME
admin.site.index_title = 'Übersicht'
