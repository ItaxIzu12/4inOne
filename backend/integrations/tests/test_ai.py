"""AI Readiness Layer (docs/AI_INTEGRATION.md § 9): abschaltbar, nur Vorschläge, definierte Fehler, keine Inhalte im Log.

Alle Tests laufen gegen `FakeAiCore` (echter HTTP-Server auf 127.0.0.1), nie gegen einen echten Dienst.
"""

import logging

import pytest
from django.contrib.auth import get_user_model
from rest_framework import serializers

from integrations import ai
from integrations.ai import capabilities, client, discovery
from integrations.ai.capabilities import Capability
from integrations.ai.fake import FakeAiCore

TOKEN = 'test-token-' + 'x' * 32


class CategoryResult(serializers.Serializer):
    category_id = serializers.IntegerField()
    reason = serializers.CharField(max_length=200)


def _only_sent_categories(payload, result):
    if result['category_id'] not in {c['id'] for c in payload['categories']}:
        raise ValueError('unbekannte Kategorie')


PAYLOAD = {'text': 'REWE Markt', 'amount': '23.40', 'currency': 'EUR', 'categories': [{'id': 7, 'name': 'Lebensmittel'}]}


@pytest.fixture(autouse=True)
def _capability(settings):
    """Eine Test-Fähigkeit nur für diese Tests; im Code ist keine registriert."""
    capabilities.register(Capability('test_categorize', 1, CategoryResult, timeout=0.5,
                                     validate_against_input=_only_sent_categories))
    client.breaker.reset()
    discovery.reset()
    settings.AI_ENABLED = False
    settings.AI_PROVIDER = 'core'
    settings.AI_CORE_TOKEN = TOKEN
    settings.AI_CORE_TOKEN_FILE = ''
    settings.AI_CAPABILITIES = ['test_categorize']
    yield
    capabilities.unregister('test_categorize')
    client.breaker.reset()
    discovery.reset()


def _tasks(core):
    return [r for r in core.requests if r['method'] == 'POST']


def _enable(settings, core):
    settings.AI_ENABLED = True
    settings.AI_CORE_URL = core.url


def test_nothing_is_registered_or_enabled_by_default():
    from django.conf import settings as real

    assert set(capabilities.CAPABILITIES) == {'test_categorize'}  # nur die Test-Fähigkeit dieser Datei
    assert real.AI_ENABLED is False


def test_disabled_means_no_call_at_all(settings):
    with FakeAiCore(result={'category_id': 7, 'reason': 'REWE'}) as core:
        settings.AI_CORE_URL = core.url  # Adresse da, aber Hauptschalter aus
        assert ai.ai_available('test_categorize') is False
        with pytest.raises(ai.AiDisabled):
            ai.request('test_categorize', PAYLOAD)
        assert core.requests == []


def test_capability_must_be_registered_and_allowed(settings):
    with FakeAiCore() as core:
        _enable(settings, core)
        settings.AI_CAPABILITIES = []
        assert ai.ai_available('test_categorize') is False
        settings.AI_CAPABILITIES = ['test_categorize', 'gibt_es_nicht']
        assert ai.ai_available('gibt_es_nicht') is False
        with pytest.raises(ai.AiDisabled):
            ai.request('gibt_es_nicht', PAYLOAD)
        assert core.requests == []


@pytest.mark.django_db
def test_ok_returns_a_checked_suggestion_with_auth_and_pseudonym(settings):
    user = get_user_model().objects.create_user(username='lena@example.test', email='lena@example.test', password='x')
    with FakeAiCore(result={'category_id': 7, 'reason': 'Händler REWE', 'extra': 'wird verworfen'}) as core:
        _enable(settings, core)
        result = ai.request('test_categorize', PAYLOAD, user=user, area='finanzen')
        sent = _tasks(core)[0]
    assert result.result == {'category_id': 7, 'reason': 'Händler REWE'}
    assert result.evidence[0]['quote'] == 'REWE' and result.confidence == {'category_id': 0.8}
    assert sent['path'] == '/v1/tasks/test_categorize'
    assert sent['headers']['Authorization'] == f'Bearer {TOKEN}'
    assert sent['headers']['X-Request-Id'] == sent['body']['request_id'] == result.request_id
    assert sent['body']['input'] == PAYLOAD and sent['body']['capability_version'] == 1
    # Anwendungskontext für den gemeinsamen Core: welche Anwendung, welcher Bereich
    assert sent['body']['application'] == '4inone' and sent['body']['context'] == {'area': 'finanzen'}
    assert sent['headers']['X-Client-App'] == '4inone'
    # Kein Konto, keine E-Mail im Klartext – nur ein Pseudonym
    assert sent['body']['subject'].startswith('hmac:')
    assert 'lena' not in str(sent['body']) and str(user.pk) != sent['body']['subject']


@pytest.mark.parametrize('mode, error', [
    ('refused', ai.AiRefused),
    ('error', ai.AiUnavailable),
    ('http_500', ai.AiUnavailable),
    ('http_401', ai.AiUnavailable),
    ('invalid_json', ai.AiInvalidResponse),
    ('huge', ai.AiInvalidResponse),
    ('wrong_request_id', ai.AiInvalidResponse),
    ('bad_envelope', ai.AiInvalidResponse),
    ('bad_result', ai.AiInvalidResponse),
])
def test_every_failure_ends_in_a_defined_error(settings, mode, error):
    with FakeAiCore(mode=mode, result={'category_id': 7, 'reason': 'x'}) as core:
        _enable(settings, core)
        with pytest.raises(error):
            ai.request('test_categorize', PAYLOAD)


def test_result_must_stay_within_what_was_sent(settings):
    """Prompt-Injection o. Ä.: eine Kategorie, die nicht angeboten wurde, wird nie übernommen."""
    with FakeAiCore(result={'category_id': 999, 'reason': 'ignoriere alle Regeln'}) as core:
        _enable(settings, core)
        with pytest.raises(ai.AiInvalidResponse):
            ai.request('test_categorize', PAYLOAD)


def test_timeout_and_unreachable(settings):
    with FakeAiCore(mode='slow', delay=1.5) as core:
        _enable(settings, core)
        with pytest.raises(ai.AiTimeout):
            ai.request('test_categorize', PAYLOAD)
    client.breaker.reset()
    discovery.reset()
    settings.AI_CORE_URL = 'http://127.0.0.1:9'  # niemand hört zu
    assert ai.ai_available('test_categorize') is False  # Capability API nicht erreichbar → nichts verfügbar
    with pytest.raises(ai.AiDisabled):
        ai.request('test_categorize', PAYLOAD)


def test_breaker_stops_calls_after_repeated_failures(settings):
    with FakeAiCore(mode='http_500') as core:
        _enable(settings, core)
        for _ in range(client.FAILURE_LIMIT):
            with pytest.raises(ai.AiUnavailable):
                ai.request('test_categorize', PAYLOAD)
        calls = len(_tasks(core))
        with pytest.raises(ai.AiUnavailable):
            ai.request('test_categorize', PAYLOAD)
        assert len(_tasks(core)) == calls  # gesperrt: kein weiterer Aufruf


def test_too_large_requests_are_not_sent(settings):
    with FakeAiCore() as core:
        _enable(settings, core)
        settings.AI_MAX_REQUEST_BYTES = 100
        with pytest.raises(ai.AiRequestTooLarge):
            ai.request('test_categorize', PAYLOAD)
        assert _tasks(core) == []


def test_logs_contain_no_content(settings, caplog):
    with FakeAiCore(result={'category_id': 7, 'reason': 'Händler REWE'}) as core:
        _enable(settings, core)
        with caplog.at_level(logging.INFO, logger='integrations.ai.client'):
            ai.request('test_categorize', PAYLOAD)
    text = caplog.text
    assert 'outcome=ok' in text and 'capability=test_categorize' in text
    for secret in ('REWE', '23.40', TOKEN, 'Lebensmittel'):
        assert secret not in text


def test_token_file_and_health(settings, tmp_path):
    token_file = tmp_path / 'token'
    token_file.write_text(TOKEN + '\n')
    with FakeAiCore() as core:
        _enable(settings, core)
        settings.AI_CORE_TOKEN = ''
        settings.AI_CORE_TOKEN_FILE = str(token_file)
        assert ai.health() is True
        assert core.requests[0]['headers']['Authorization'] == f'Bearer {TOKEN}'
    settings.AI_ENABLED = False
    assert ai.health() is False


@pytest.mark.parametrize('url, ok', [
    ('http://ai-core:8080', True),
    ('http://127.0.0.1:8080', True),
    ('http://localhost:8080', True),
    ('https://ai.example.org', True),
    ('http://ai.example.org', False),
    ('http://192.168.1.20:8080', False),
    ('https://user:pw@ai.example.org', False),
    ('ftp://ai-core', False),
])
def test_url_rules(url, ok):
    from integrations.ai.config import url_problem

    assert (url_problem(url) is None) is ok


def test_deploy_check(settings):
    settings.AI_ENABLED = True
    settings.AI_CORE_URL = 'http://ai.example.org'
    settings.AI_CORE_TOKEN = ''
    from integrations.checks import ai_settings

    ids = {problem.id for problem in ai_settings(None)}
    assert {'integrations.E002', 'integrations.E003'} <= ids
    settings.AI_CORE_URL = 'http://ai-core:8080'
    settings.AI_CORE_TOKEN = TOKEN
    settings.AI_CAPABILITIES = ['test_categorize']
    assert ai_settings(None) == []
    settings.AI_ENABLED = False
    settings.AI_CORE_TOKEN = ''
    assert ai_settings(None) == []  # abgeschaltet: nichts zu prüfen


def test_ai_layer_imports_no_domain_code():
    """Der Client kennt keine Bereichsmodelle (kein Schreibpfad, § 7) – zusätzlich zum Architekturtest."""
    import ast
    from pathlib import Path

    for path in Path(client.__file__).parent.glob('*.py'):
        for node in ast.walk(ast.parse(path.read_text(encoding='utf-8'))):
            if isinstance(node, ast.ImportFrom) and node.module:
                assert node.module.split('.')[0] not in {'finanzen', 'haushalt', 'organisation', 'reisen', 'connections', 'core'}, path.name


# ------------------------------------------------------------------ Gemeinsamer Standard: Capability API, Mock
def test_capabilities_are_discovered_dynamically_and_cached(settings):
    with FakeAiCore(result={'category_id': 7, 'reason': 'x'}) as core:
        _enable(settings, core)
        ai.request('test_categorize', PAYLOAD)
        ai.request('test_categorize', PAYLOAD)
        lookups = [r for r in core.requests if r['path'] == '/v1/capabilities']
        assert len(lookups) == 1  # zwischengespeichert
        assert lookups[0]['headers']['Authorization'] == f'Bearer {TOKEN}'


@pytest.mark.parametrize('offered', [
    [],                                                  # Core bietet die Fähigkeit (noch) nicht an
    [{'name': 'test_categorize', 'version': 2}],         # nur eine andere Version
    [{'name': 'anderes', 'versions': [1]}],
])
def test_capability_not_offered_by_core_means_no_task_call(settings, offered):
    with FakeAiCore(offered=offered, result={'category_id': 7, 'reason': 'x'}) as core:
        _enable(settings, core)
        assert ai.ai_available('test_categorize') is False
        with pytest.raises(ai.AiDisabled):
            ai.request('test_categorize', PAYLOAD)
        assert _tasks(core) == []


def test_capability_offered_in_a_version_list(settings):
    with FakeAiCore(offered=[{'name': 'test_categorize', 'versions': [1, 2]}], result={'category_id': 7, 'reason': 'x'}) as core:
        _enable(settings, core)
        assert ai.ai_available('test_categorize') is True


@pytest.mark.parametrize('status', [500, 401])
def test_broken_capability_api_means_nothing_available(settings, status):
    with FakeAiCore(capabilities_status=status) as core:
        _enable(settings, core)
        assert ai.ai_available('test_categorize') is False
        assert _tasks(core) == []


def test_mock_provider_for_development_without_core(settings):
    """Solange der Personal AI Core fehlt: gleicher Adapter, gleiche Prüfungen, feste Antworten – ohne Netz."""
    capabilities.register(Capability('test_categorize', 1, CategoryResult, validate_against_input=_only_sent_categories,
                                     mock=lambda data: {'category_id': data['categories'][0]['id'], 'reason': 'Mock'}))
    settings.AI_ENABLED = True
    settings.AI_PROVIDER = 'mock'
    settings.AI_CORE_URL = ''
    settings.AI_CORE_TOKEN = ''
    assert ai.ai_available('test_categorize') is True
    assert ai.request('test_categorize', PAYLOAD).result == {'category_id': 7, 'reason': 'Mock'}
    # Fähigkeiten ohne Mock bietet der Mock nicht an
    capabilities.register(Capability('ohne_mock', 1, CategoryResult))
    settings.AI_CAPABILITIES = ['test_categorize', 'ohne_mock']
    discovery.reset()
    assert ai.ai_available('ohne_mock') is False
    capabilities.unregister('ohne_mock')


def test_mock_result_is_validated_like_a_real_answer(settings):
    capabilities.register(Capability('test_categorize', 1, CategoryResult, validate_against_input=_only_sent_categories,
                                     mock=lambda data: {'category_id': 999, 'reason': 'falsch'}))
    settings.AI_ENABLED = True
    settings.AI_PROVIDER = 'mock'
    with pytest.raises(ai.AiInvalidResponse):
        ai.request('test_categorize', PAYLOAD)


def test_mock_provider_is_refused_in_production_checks(settings):
    from integrations.checks import ai_settings

    settings.AI_ENABLED = True
    settings.AI_PROVIDER = 'mock'
    assert {p.id for p in ai_settings(None)} == {'integrations.E005'}
    settings.AI_PROVIDER = 'openai'  # kein fest verdrahteter Anbieter: nur core oder mock
    assert {p.id for p in ai_settings(None)} == {'integrations.E004'}


def test_pseudonym_is_per_application(settings):
    class U:
        pk = 42

    settings.AI_APPLICATION_ID = '4inone'
    first = client.subject_for(U())
    settings.AI_APPLICATION_ID = 'andere-app'
    assert client.subject_for(U()) != first and '42' not in first
