"""`manage.py check --deploy`: KI-Anbindung sicher eingerichtet? (docs/AI_INTEGRATION.md § 3)"""

from django.conf import settings
from django.core.checks import Error, Warning, register


@register(deploy=True)
def ai_settings(app_configs, **kwargs):
    from integrations.ai import capabilities, config

    if not settings.AI_ENABLED:
        return []
    problems = []
    if settings.AI_PROVIDER not in config.PROVIDERS:
        return [Error(f'AI_PROVIDER muss einer von {", ".join(config.PROVIDERS)} sein.', id='integrations.E004')]
    if settings.AI_PROVIDER == 'mock':
        # Mock nur für die Entwicklung (gemeinsamer Standard): in Produktion echte Vorschläge oder gar keine
        return [Error('AI_PROVIDER=mock ist nur für die Entwicklung – in Produktion AI_PROVIDER=core oder AI_ENABLED=False.',
                      id='integrations.E005')]
    if not settings.AI_CORE_URL:
        problems.append(Error('AI_ENABLED=True, aber AI_CORE_URL fehlt.', id='integrations.E001'))
    elif (reason := config.url_problem(settings.AI_CORE_URL)):
        problems.append(Error(reason, id='integrations.E002'))
    if not config.token():
        problems.append(Error('AI_ENABLED=True, aber weder AI_CORE_TOKEN noch eine lesbare AI_CORE_TOKEN_FILE.',
                              id='integrations.E003'))
    elif len(config.token()) < 32:
        problems.append(Warning('AI_CORE_TOKEN ist kürzer als 32 Zeichen.', id='integrations.W001'))
    unknown = [name for name in settings.AI_CAPABILITIES if capabilities.get(name) is None]
    if unknown:
        problems.append(Warning(f'AI_CAPABILITIES nennt Fähigkeiten, die es nicht gibt: {", ".join(unknown)}.',
                                id='integrations.W002'))
    return problems
