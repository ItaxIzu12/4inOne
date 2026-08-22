import logging

from django.conf import settings
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    """DRF-Exception-Handler, der bei DEBUG=False keine internen
    Fehlerdetails/Stacktraces im Response-Body preisgibt.

    ARCHITEKTUR.md §3.4 meint damit unbehandelte, unerwartete Fehler (Bugs) —
    genau der Fall, in dem `drf_exception_handler` None zurückgibt, weil DRF
    die Exception nicht kennt und Django sonst eine 500-Seite mit vollem
    Traceback rendern würde. NICHT gemeint sind DRFs bereits strukturierte,
    sichere 4xx-Antworten (Validierungsfehler wie "Passwort zu kurz",
    401/403/404): Die enthalten von Haus aus keine Stacktraces/internen
    Pfade und müssen für eine nutzbare Fehleranzeige im Frontend erhalten
    bleiben — sie hier zusätzlich zu maskieren würde z. B. jede
    Registrierungs-Fehlermeldung in Produktion unbrauchbar machen, ohne
    einen Sicherheitsgewinn zu bringen.
    """
    response = drf_exception_handler(exc, context)

    if response is not None:
        return response

    # Unbehandelte Exception (z. B. ein Bug) — volle Details nur ins Log
    # (§3.7: zentrales Logging ohne PII im Klartext), niemals in die Antwort.
    logger.exception('Unbehandelte Exception in %s', context.get('view'))
    if settings.DEBUG:
        return None

    return Response({'detail': 'Ein interner Fehler ist aufgetreten.'}, status=500)
