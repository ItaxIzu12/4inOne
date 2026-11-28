from django.contrib import admin


def test_admin_traegt_die_marke():
    assert admin.site.site_header == 'Lumiknot – Verwaltung'
    assert admin.site.site_title == 'Lumiknot'
