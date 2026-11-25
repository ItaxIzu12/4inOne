"""Architekturregeln als Test (docs/ARCHITECTURE.md § 3.1, Phase 1, 24.11.2026).

Liest alle Imports der Backend-Apps (auch verzögerte Imports in Funktionen) und prüft die Schichten:

- Ebene 1 (`core`, `integrations`, `monitoring`, `website`) importiert keinen Fachbereich und keine Orchestrierung.
  Braucht `core` Wissen aus den Bereichen, melden diese sich in `core/registry.py` an.
- Ebene 2 (die vier Fachbereiche) importiert einander nicht – außer über die öffentliche Schnittstelle
  `<bereich>/public.py`.
- Ebene 3 (`connections`, `datenexport`) darf alles darunter nutzen.

Tests und Migrationen sind ausgenommen (sie dürfen Fixtures aus mehreren Bereichen anlegen). Neue Verstöße lassen den
Test (und damit CI) scheitern; begründete Ausnahmen stehen in ALLOWED mit Grund – die Liste soll nur schrumpfen.
"""

import ast
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
DOMAINS = {'finanzen', 'haushalt', 'organisation', 'reisen'}
BASE = {'core', 'integrations', 'monitoring', 'website'}
ORCHESTRATION = {'connections', 'datenexport'}
PROJECT = DOMAINS | BASE | ORCHESTRATION

# (Datei relativ zu backend/, importierte App) → Begründung. Leer seit Phase 2 (24.11.2026).
ALLOWED: dict[tuple[str, str], str] = {}


def _is_exempt(path: Path) -> bool:
    parts = path.relative_to(BACKEND).parts
    return 'migrations' in parts or 'tests' in parts or path.name.startswith('test') or path.name == 'conftest.py'


def _imports(path: Path):
    """(Modulpfad, Zeile) jedes Imports einer Projekt-App."""
    tree = ast.parse(path.read_text(encoding='utf-8'), filename=str(path))
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.level == 0 and node.module:
            top = node.module.split('.')[0]
            if top in PROJECT:
                # `from finanzen import public` → Modul finanzen.public
                if node.module == top:
                    for alias in node.names:
                        yield f'{top}.{alias.name}', node.lineno
                else:
                    yield node.module, node.lineno
        elif isinstance(node, ast.Import):
            for alias in node.names:
                if alias.name.split('.')[0] in PROJECT:
                    yield alias.name, node.lineno


def _violation(app: str, module: str) -> str | None:
    target = module.split('.')[0]
    if target == app:
        return None
    if app in BASE and target in DOMAINS | ORCHESTRATION:
        return f'Ebene 1 ({app}) darf {target} nicht importieren – Anmeldung über core/registry.py'
    if app in DOMAINS and target in DOMAINS and not (module == f'{target}.public' or module.startswith(f'{target}.public.')):
        return f'Bereich {app} darf {target} nur über {target}/public.py nutzen'
    if app in DOMAINS and target in ORCHESTRATION:
        return f'Bereich {app} darf die Orchestrierung ({target}) nicht importieren'
    return None


def _all_violations() -> dict[tuple[str, str], list[str]]:
    found: dict[tuple[str, str], list[str]] = {}
    for app in sorted(DOMAINS | BASE):
        for path in sorted((BACKEND / app).rglob('*.py')):
            if _is_exempt(path):
                continue
            rel = str(path.relative_to(BACKEND))
            for module, line in _imports(path):
                reason = _violation(app, module)
                if reason:
                    found.setdefault((rel, module.split('.')[0]), []).append(f'{rel}:{line} importiert {module} – {reason}')
    return found


def test_layer_rules_hold():
    new = {key: lines for key, lines in _all_violations().items() if key not in ALLOWED}
    assert not new, 'Neue Verstöße gegen docs/ARCHITECTURE.md § 3.1:\n' + '\n'.join(line for lines in new.values() for line in lines)


def test_allowed_exceptions_are_still_needed():
    """Eine Ausnahme, die nicht mehr gebraucht wird, muss aus ALLOWED raus (die Liste soll nur schrumpfen)."""
    stale = sorted(set(ALLOWED) - set(_all_violations()))
    assert not stale, f'Nicht mehr nötige Ausnahmen in ALLOWED: {stale}'


def test_checker_finds_violations():
    """Gegenprobe: die Regeln erkennen typische Verstöße (sonst würde der Test still alles durchlassen)."""
    assert _violation('core', 'reisen.models')
    assert _violation('core', 'connections.today')
    assert _violation('haushalt', 'finanzen.services')
    assert _violation('reisen', 'connections.models')
    assert _violation('integrations', 'finanzen.models')
    assert _violation('haushalt', 'finanzen.public') is None
    assert _violation('connections', 'haushalt.models') is None
    assert _violation('reisen', 'core.registry') is None


def test_every_domain_public_module_only_reexports_own_code():
    """public.py ist eine Schnittstelle, kein Umweg: sie importiert nur aus dem eigenen Bereich und aus core."""
    for app in sorted(DOMAINS):
        path = BACKEND / app / 'public.py'
        if not path.exists():
            continue
        for module, line in _imports(path):
            assert module.split('.')[0] in {app, 'core'}, f'{app}/public.py:{line} importiert {module}'
