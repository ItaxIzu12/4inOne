from django.contrib import admin

# Marke im Django-Admin (Kopfzeile, Browser-Titel, Startseite). Nur Beschriftungen; Pfad (ADMIN_URL_PATH), Rechte und
# Modelle bleiben unverändert. Name wie im Frontend (frontend/src/app/core/brand/brand.config.ts).
PRODUCT_NAME = 'Lumiknot'
admin.site.site_header = f'{PRODUCT_NAME} – Verwaltung'
admin.site.site_title = PRODUCT_NAME
admin.site.index_title = 'Übersicht'
