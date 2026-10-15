"""Zusätzliche Prüfungen für `manage.py check --deploy`: Produktionsbetrieb nicht versehentlich mit
Entwicklungs-Einstellungen starten."""

from django.conf import settings
from django.core.checks import Error, Warning, register


@register(deploy=True)
def production_storage_and_limits(app_configs, **kwargs):
    problems = []
    if settings.DATABASES['default']['ENGINE'].endswith('sqlite3'):
        problems.append(Error(
            'Produktion läuft auf SQLite.',
            hint='DATABASE_URL auf PostgreSQL setzen (ARCHITEKTUR.md §2.2) — SQLite serialisiert alle Schreibzugriffe.',
            id='4inone.E001',
        ))
    if settings.CACHES['throttle']['BACKEND'].endswith('LocMemCache'):
        problems.append(Warning(
            'Rate-Limits zählen pro Server-Prozess.',
            hint='Bei mehreren Workern RATE_LIMIT_CACHE=database setzen und einmal `manage.py createcachetable` ausführen.',
            id='4inone.W001',
        ))
    if str(settings.PRIVATE_MEDIA_ROOT).startswith(str(settings.BASE_DIR)):
        problems.append(Warning(
            'Hochgeladene Dateien liegen im Programmverzeichnis.',
            hint='PRIVATE_MEDIA_ROOT auf ein dauerhaftes, gesichertes Volume außerhalb des Codes legen.',
            id='4inone.W002',
        ))
    return problems
