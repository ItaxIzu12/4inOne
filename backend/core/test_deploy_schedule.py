"""Betrieb (docs/ARCHITECTURE.md › S1, 24.11.2026): Jeder Wartungsbefehl hat einen systemd-Zeitplan in deploy/systemd/.

Fängt den Fehler ab, der S1 ausgelöst hat: ein neuer Management-Befehl (z. B. ein Aufräumbefehl mit Löschzusage) wird
gebaut, läuft im Betrieb aber nie, weil niemand ihn einplant. Bewusst nur von Hand gestartete Befehle stehen in MANUAL.
"""

import configparser
from pathlib import Path

from django.core.management import get_commands

ROOT = Path(__file__).resolve().parents[2]
SYSTEMD = ROOT / 'deploy' / 'systemd'
DOCKER = ROOT / 'deploy' / 'docker'
PROJECT_APPS = {'core', 'finanzen', 'haushalt', 'organisation', 'reisen', 'connections', 'datenexport', 'monitoring', 'website', 'integrations'}

# Werkzeuge für Menschen, kein Zeitplan nötig
MANUAL = {
    'beta_feedback_report': 'Bericht für die Beta-Auswertung',
    'beta_usage_report': 'Bericht für die Beta-Auswertung',
    'monitoring_admin': 'legt den Monitoring-Zugang einmalig an',
}


def _units(suffix):
    result = {}
    for path in sorted(SYSTEMD.glob(f'*{suffix}')):
        parser = configparser.ConfigParser(strict=False, interpolation=None)
        parser.optionxform = str  # Schlüssel wie OnCalendar unverändert lassen
        parser.read_string(path.read_text(encoding='utf-8'))
        result[path.name] = parser
    return result


def _exec_lines(path: Path) -> list[str]:
    # configparser fasst doppelte ExecStart-Zeilen zusammen, deshalb direkt lesen
    return [line.split('=', 1)[1] for line in path.read_text(encoding='utf-8').splitlines() if line.startswith('ExecStart=')]


def test_every_maintenance_command_is_scheduled():
    project_commands = {name for name, app in get_commands().items() if app in PROJECT_APPS}
    scheduled = ' '.join(line for service in SYSTEMD.glob('*.service') for line in _exec_lines(service))
    missing = sorted(c for c in project_commands - set(MANUAL) if f'manage.py {c}' not in scheduled)
    assert not missing, f'Ohne Zeitplan in deploy/systemd/: {missing} – Timer anlegen oder in MANUAL begründen'
    assert set(MANUAL) <= project_commands, 'MANUAL enthält Befehle, die es nicht mehr gibt'


def test_every_timer_has_a_service_and_a_schedule():
    services = _units('.service')
    for name, timer in _units('.timer').items():
        assert name.replace('.timer', '.service') in services, f'{name} ohne passenden Dienst'
        assert timer.get('Timer', 'OnCalendar', fallback=''), f'{name} ohne OnCalendar'
        assert timer.get('Timer', 'Persistent', fallback='') == 'true', f'{name}: Persistent=true holt verpasste Läufe nach'
        assert timer.get('Install', 'WantedBy', fallback='') == 'timers.target'


def test_scheduled_services_are_oneshot_and_run_as_deploy():
    timers = {n.replace('.timer', '.service') for n in _units('.timer')}
    for name, service in _units('.service').items():
        if name not in timers:
            continue
        assert service.get('Service', 'Type') == 'oneshot', name
        assert service.get('Service', 'User') == 'deploy', name
        for line in _exec_lines(SYSTEMD / name):
            assert line.startswith('/srv/4inone/'), f'{name}: absoluter Pfad erwartet ({line})'


# ------------------------------------------------------------------ Docker-Betrieb (deploy/docker/, Phase 3)
def test_docker_variant_runs_the_same_commands():
    """Jeder Wartungsbefehl steht auch in deploy/docker/run-task.sh, und jede Aufgabe dort hat einen Timer."""
    script = (DOCKER / 'run-task.sh').read_text(encoding='utf-8')
    project_commands = {name for name, app in get_commands().items() if app in PROJECT_APPS}
    missing = sorted(c for c in project_commands - set(MANUAL) if f'manage {c}' not in script)
    assert not missing, f'Ohne Aufgabe in deploy/docker/run-task.sh: {missing}'

    timers = {path.name: path.read_text(encoding='utf-8') for path in (DOCKER / 'systemd').glob('4inone-docker-*.timer')}
    names = {name.removeprefix('4inone-docker-').removesuffix('.timer') for name in timers}
    assert names == {'backup', 'cleanup', 'prune', 'reminders', 'calendars'}
    for name, text in timers.items():
        task = name.removeprefix('4inone-docker-').removesuffix('.timer')
        assert f'Unit=4inone-docker@{task}.service' in text, name
        assert f'  {task})' in script, f'run-task.sh kennt die Aufgabe {task} nicht'
        assert 'Persistent=true' in text, name


def test_docker_setup_keeps_secrets_and_data_out_of_images():
    ignore = (ROOT / '.dockerignore').read_text(encoding='utf-8').splitlines()
    for pattern in ('**/.env', 'backups', 'backend/private_media', 'backend/db.sqlite3', 'frontend/node_modules'):
        assert pattern in ignore, f'.dockerignore muss {pattern} ausschließen'
    compose = (DOCKER / 'compose.yml').read_text(encoding='utf-8')
    # Nur „web“ veröffentlicht Ports; Datenbank und Redis nie
    assert compose.count('ports:') == 1
    assert 'POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?' in compose  # kommt aus der env-Datei, kein Standardwert


# ------------------------------------------------------------------ Statische Dateien des Admins (§ 10.3 C)
def test_collectstatic_gathers_admin_css(settings, tmp_path):
    """Ohne STATIC_ROOT/collectstatic liefe der Django-Admin in Produktion ohne CSS (DEBUG=False liefert nichts aus)."""
    from django.core.management import call_command

    settings.STATIC_ROOT = tmp_path / 'staticfiles'
    call_command('collectstatic', interactive=False, verbosity=0)
    assert (settings.STATIC_ROOT / 'admin' / 'css' / 'base.css').is_file()


def test_nginx_serves_static_in_both_variants():
    native = (ROOT / 'deploy' / 'nginx' / '4inone.conf').read_text(encoding='utf-8')
    docker = (DOCKER / 'nginx' / '4inone.conf.template').read_text(encoding='utf-8')
    assert 'alias /srv/4inone/backend/staticfiles/;' in native
    assert 'alias /usr/share/nginx/static/;' in docker
    assert 'COPY --from=static /app/staticfiles/ /usr/share/nginx/static/' in (DOCKER / 'web.Dockerfile').read_text(encoding='utf-8')
    assert 'collectstatic --noinput' in (ROOT / 'deploy' / 'scripts' / 'update.sh').read_text(encoding='utf-8')
