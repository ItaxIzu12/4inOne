"""Wechselkurse (Richtkurse) für Umrechnungen in Reisen.

Quelle: die täglichen Euro-Referenzkurse der Europäischen Zentralbank (eine öffentliche XML-Datei, kein API-Key).
Es werden KEINE Nutzerdaten gesendet — das Backend lädt nur die komplette Tabelle. Die Kurse liegen in der Datenbank
(`ExchangeRate`, je Kursdatum), damit gespeicherte Ausgaben nachvollziehbar bleiben und ein Ausfall der EZB die
Funktion nicht blockiert.

Regeln:
- Geladen wird höchstens alle `REFRESH_AFTER` (Sperre im lokalen 'fx'-Cache — auch fehlgeschlagene Versuche zählen,
  damit ein EZB-Ausfall nicht jede Anfrage verlangsamt).
- Eine Tabelle älter als `MAX_AGE_DAYS` gilt als nicht verfügbar — nie wird ein unbekannt alter Kurs als aktuell
  ausgegeben, nie ein Kurs geraten (kein „1“ als Ersatz). Ohne Kurs liefert der Dienst `None`.
- Kreuzkurse laufen über EUR: JPY→USD = (USD je EUR) / (JPY je EUR). Alles in Decimal.
"""

from __future__ import annotations

import logging
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

from django.conf import settings
from django.core.cache import caches
from django.utils import timezone

from .currencies import CURRENCIES

logger = logging.getLogger(__name__)

ECB_URL = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml'
REFRESH_AFTER = timedelta(hours=6)
MAX_AGE_DAYS = 7
RATE_PLACES = Decimal('0.0000000001')
CENT = Decimal('0.01')
_MAX_BYTES = 64 * 1024


@dataclass(frozen=True)
class Rate:
    """1 Einheit `source` = `rate` Einheiten `target`, Stand `rate_date` (Kursdatum der EZB)."""

    rate: Decimal
    rate_date: date


class EcbProvider:
    """Lädt die aktuelle EZB-Tabelle: (Kursdatum, {Währung: Einheiten je 1 EUR})."""

    def fetch(self) -> tuple[date, dict[str, Decimal]]:
        request = urllib.request.Request(ECB_URL, headers={'User-Agent': '4inOne/1 (+exchange rates)'})
        with urllib.request.urlopen(request, timeout=5) as response:  # noqa: S310 — feste HTTPS-Adresse
            body = response.read(_MAX_BYTES + 1)
        return parse_ecb(body)


def parse_ecb(body: bytes) -> tuple[date, dict[str, Decimal]]:
    if len(body) > _MAX_BYTES:
        raise ValueError('EZB-Antwort zu groß')
    # Keine DTDs/Entities: die echte Datei hat keine, alles andere wird nicht geparst.
    if b'<!DOCTYPE' in body or b'<!ENTITY' in body:
        raise ValueError('Unerwartetes XML')
    root = ET.fromstring(body)
    day = None
    rates: dict[str, Decimal] = {}
    for cube in root.iter():
        if not cube.tag.endswith('Cube'):
            continue
        if 'time' in cube.attrib:
            day = date.fromisoformat(cube.attrib['time'])
        code, raw = cube.attrib.get('currency'), cube.attrib.get('rate')
        if code in CURRENCIES and raw:
            try:
                value = Decimal(raw)
            except InvalidOperation:
                continue
            if value > 0:
                rates[code] = value
    if day is None or not rates:
        raise ValueError('EZB-Tabelle unvollständig')
    return day, rates


def _provider():
    return EcbProvider()


def refresh_if_due() -> None:
    if not getattr(settings, 'FX_FETCH_ENABLED', True):
        return
    if not caches['fx'].add('fx:attempt', 1, timeout=int(REFRESH_AFTER.total_seconds())):
        return
    from .models import ExchangeRate

    try:
        day, rates = _provider().fetch()
    except Exception:  # Netzwerk, Zeitüberschreitung, kaputte Datei — die App arbeitet mit dem Gespeicherten weiter
        logger.warning('EZB-Kurse konnten nicht geladen werden.', exc_info=True)
        return
    ExchangeRate.objects.bulk_create(
        [ExchangeRate(currency=code, rate=value, rate_date=day) for code, value in rates.items()],
        ignore_conflicts=True,
    )


def latest_table() -> tuple[date, dict[str, Decimal]] | None:
    """Neueste Kurstabelle (inkl. EUR = 1) oder None, wenn keine hinreichend aktuelle vorliegt."""
    from .models import ExchangeRate

    refresh_if_due()
    newest = ExchangeRate.objects.order_by('-rate_date').values_list('rate_date', flat=True).first()
    if newest is None or (timezone.localdate() - newest).days > MAX_AGE_DAYS:
        return None
    rates = dict(ExchangeRate.objects.filter(rate_date=newest).values_list('currency', 'rate'))
    rates['EUR'] = Decimal('1')
    return newest, rates


def get_rate(source: str, target: str, table: tuple[date, dict[str, Decimal]] | None = None) -> Rate | None:
    if source == target:
        return Rate(Decimal('1'), timezone.localdate())
    table = table if table is not None else latest_table()
    if table is None:
        return None
    day, rates = table
    if source not in rates or target not in rates:
        return None
    return Rate((rates[target] / rates[source]).quantize(RATE_PLACES, rounding=ROUND_HALF_UP), day)


def convert(amount: Decimal, rate: Rate) -> Decimal:
    return (amount * rate.rate).quantize(CENT, rounding=ROUND_HALF_UP)
