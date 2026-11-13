"""Demo und Backend entscheiden gleich (14.11.2026).

Die Demo (nur im Browser, ohne Backend) hat eine eigene Kopie der erlaubten Paare und der „Passt dazu“-Regel. Dieser
Test liest den Demo-Code und prüft, dass Paare, Bezeichnungen, Wortlisten und Fristen exakt dem Backend entsprechen –
ändert jemand eine Seite und vergisst die andere, wird er rot.
"""

import re
from pathlib import Path

from connections import link_suggestions, relevance
from connections.models import RelationType
from connections.registry import ALLOWED_PAIRS

FRONTEND = Path(__file__).resolve().parents[3] / 'frontend' / 'src' / 'app' / 'shared' / 'connections'
DEMO = (FRONTEND / 'demo-connections-api.ts').read_text(encoding='utf-8')
RULES = (FRONTEND / 'connection-relevance.ts').read_text(encoding='utf-8')


def _ts_set(name: str) -> set[str]:
    block = re.search(rf'export const {name} = new Set\(\[(.*?)\]\);', RULES, re.S)
    assert block, name
    return set(re.findall(r"'([a-z0-9]+)'", block.group(1)))


def test_demo_has_exactly_the_allowed_pairs_with_the_same_default_relation_and_label():
    block = re.search(r'export const DEMO_PAIRS[^=]*= \[(.*?)\n\];', DEMO, re.S).group(1)
    demo = {(a, b): (rel, label) for a, b, rel, label in re.findall(r"\['(\w+)', '(\w+)', '(\w+)', '([^']+)'\]", block)}
    backend = {(str(a), str(b)): (str(rels[0]), str(RelationType(rels[0]).label)) for (a, b), rels in ALLOWED_PAIRS.items()}
    assert demo == backend


def test_demo_relevance_uses_the_same_word_lists_as_the_backend():
    assert _ts_set('STOPWORDS') == link_suggestions.STOPWORDS
    assert _ts_set('TRAVEL_WORDS') == link_suggestions.TRAVEL_WORDS
    # TRIP_GOAL_WORDS = TRAVEL_WORDS + Zusatzwörter (in TS als Spread geschrieben)
    extra = _ts_set('TRIP_GOAL_WORDS')
    assert link_suggestions.TRAVEL_WORDS | extra == link_suggestions.TRIP_GOAL_WORDS
    assert _ts_set('CONTRACT_WORDS') == link_suggestions.CONTRACT_WORDS


def test_demo_relevance_uses_the_same_time_windows():
    for name in ('GOAL_LEAD_DAYS', 'TASK_LEAD_DAYS', 'EVENT_MARGIN_DAYS'):
        value = int(re.search(rf'export const {name} = (\d+);', RULES).group(1))
        assert value == getattr(relevance, name), name
