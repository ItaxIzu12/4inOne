"""Auswertung der Beta-Rückmeldungen als Markdown (Entwicklungsplan Phase 5, Vorlage docs/beta/AUSWERTUNG.md).

    python manage.py beta_feedback_report                 # auf die Konsole
    python manage.py beta_feedback_report --output beta.md

Pseudonymisiert: Personen erscheinen als P1, P2 … (Reihenfolge der ersten Rückmeldung), nie mit Name oder E-Mail.
Die Freitexte stehen so, wie sie geschrieben wurden — vor dem Weitergeben auf persönliche Angaben durchsehen."""

from collections import Counter, defaultdict
from statistics import mean

from django.core.management.base import BaseCommand

from core.models import BetaFeedback

ANSWER = dict(BetaFeedback.Answer.choices)
TASK = dict(BetaFeedback.Task.choices)
AREA = dict(BetaFeedback.Area.choices)


def _avg(values: list[int]) -> str:
    return f'{mean(values):.1f} (n = {len(values)})' if values else '—'


def _share(counter: Counter) -> str:
    total = sum(counter.values())
    if not total:
        return '—'
    return ' · '.join(f'{ANSWER[k]} {counter[k]}' for k in ('YES', 'NO', 'UNSURE') if counter[k]) + f' (n = {total})'


def _cell(text: str) -> str:
    return ' '.join(text.split()).replace('|', '\\|')


class Command(BaseCommand):
    help = 'Fasst die Beta-Rückmeldungen pseudonymisiert als Markdown zusammen.'

    def add_arguments(self, parser):
        parser.add_argument('--output', help='Datei, in die der Bericht geschrieben wird (sonst Konsole).')

    def handle(self, *args, output=None, **options):
        rows = list(BetaFeedback.objects.order_by('created_at', 'id'))
        alias: dict[int, str] = {}
        for row in rows:
            alias.setdefault(row.user_id, f'P{len(alias) + 1}')

        lines = ['# Beta-Auswertung (automatisch erzeugt)', '',
                 f'Rückmeldungen: **{len(rows)}** von **{len(alias)}** Personen.', '']
        lines += ['## Je Aufgabe', '', '| Aufgabe | Rückmeldungen | Verständlich (1–5) | Kontrollierbar (1–5) | Spart Zeit | Weiter nutzen |',
                  '|---|---|---|---|---|---|']
        by_task = defaultdict(list)
        for row in rows:
            by_task[row.task or ''].append(row)
        for key in [*TASK, '']:
            group = by_task.get(key, [])
            if not group:
                continue
            lines.append('| {} | {} | {} | {} | {} | {} |'.format(
                TASK.get(key, 'ohne Aufgabe'), len(group),
                _avg([r.understood for r in group if r.understood]),
                _avg([r.in_control for r in group if r.in_control]),
                _share(Counter(r.saves_time for r in group if r.saves_time)),
                _share(Counter(r.would_continue for r in group if r.would_continue)),
            ))
        lines += ['', '## Je Bereich', '', '| Bereich | Rückmeldungen | Personen |', '|---|---|---|']
        for key, label in AREA.items():
            group = [r for r in rows if r.area == key]
            if group:
                lines.append(f'| {label} | {len(group)} | {len({r.user_id for r in group})} |')
        lines += ['', '## Freitexte', '', '| Person | Datum | Aufgabe | Bereich | Seite | Text |', '|---|---|---|---|---|---|']
        for row in rows:
            if row.message:
                lines.append(f'| {alias[row.user_id]} | {row.created_at:%d.%m.%Y} | {row.task or "—"} | {AREA[row.area]} | '
                             f'{_cell(row.page) or "—"} | {_cell(row.message)} |')
        lines += ['', '> Hinweis: Positive Rückmeldungen allein belegen keine langfristige Nutzung (Plan Phase 5).', '']

        text = '\n'.join(lines)
        if output:
            with open(output, 'w', encoding='utf-8') as handle:
                handle.write(text)
            self.stdout.write(f'Bericht geschrieben: {output} ({len(rows)} Rückmeldungen)')
        else:
            self.stdout.write(text)
