"""Ortsvorschläge für Ort-Felder (01.11.2026): Termine, Reiseziel, Abreiseort.

Zwei Quellen:
1. **Eigene Orte** — was die Person selbst schon eingetragen hat (eigene Termine, Reisen, an denen sie beteiligt ist).
   Verlässt 4inOne nicht.
2. **Photon** (https://photon.komoot.io, betrieben von komoot, Daten von OpenStreetMap) — nur der Suchtext wird
   gesendet, über DIESEN Server: der Dienst sieht weder IP-Adresse noch Konto. Erst ab 3 Zeichen, Ergebnisse 24 h im
   Cache (gleiche Suche → keine zweite Anfrage), Anfragen je Person begrenzt (PlacesRateThrottle). Ein Ausfall des
   Dienstes blockiert nichts: dann gibt es nur eigene Orte. Mit PLACES_PROVIDER_URL='' ganz abschaltbar.
   Nominatim scheidet aus: dessen Nutzungsregeln verbieten Suche beim Tippen.

Art `lodging` (Reisen › Unterkunft): nur Unterkünfte (OpenStreetMap tourism=hotel, hostel, …); eigene Orte sind dann
die Unterkünfte früherer Reisen. `near` (Reiseziel) wird an den Suchtext gehängt, damit „Hotel Central“ in Berlin
gefunden wird — auch `near` ist nur Text, den die Person selbst eingegeben hat.
"""

from __future__ import annotations

import hashlib
import json
import logging
import urllib.parse
import urllib.request

from django.conf import settings
from django.core.cache import caches

logger = logging.getLogger(__name__)

MIN_EXTERNAL = 3
LODGING_TAGS = ('tourism:hotel', 'tourism:hostel', 'tourism:guest_house', 'tourism:apartment', 'tourism:motel',
                'tourism:chalet', 'tourism:camp_site', 'tourism:alpine_hut')
KINDS = ('place', 'lodging')
MAX_QUERY = 100
MAX_OWN = 6
MAX_EXTERNAL = 6
CACHE_SECONDS = 24 * 3600


def clean_query(raw: str) -> str:
    text = ' '.join(str(raw or '').split())
    return ''.join(ch for ch in text if ch.isprintable())[:MAX_QUERY]


def own_places(user, query: str, kind: str = 'place') -> list[str]:
    """Bisher verwendete Orte der Person — neueste zuerst, ohne Dubletten (Groß/Klein egal)."""
    from organisation.models import PersonalEvent
    from reisen.models import Trip

    needle = query.casefold()
    candidates: list[tuple[str, object]] = []
    trips = (Trip.objects.filter(owner=user) | Trip.objects.filter(participants__user=user)).distinct()
    if kind == 'lodging':
        for accommodation, stamp in trips.exclude(accommodation='').values_list('accommodation', 'updated_at').order_by('-updated_at')[:100]:
            candidates.append((accommodation, stamp))
        return _dedupe(candidates, needle)
    for location, stamp in PersonalEvent.objects.filter(owner=user).exclude(location='').values_list('location', 'updated_at').order_by('-updated_at')[:300]:
        candidates.append((location, stamp))
    for destination, departure, stamp in trips.values_list('destination', 'departure', 'updated_at').order_by('-updated_at')[:100]:
        for value in (destination, departure):
            if value:
                candidates.append((value, stamp))
    return _dedupe(candidates, needle)


def _dedupe(candidates: list[tuple[str, object]], needle: str) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value, _ in sorted(candidates, key=lambda item: item[1], reverse=True):
        key = value.strip().casefold()
        if not key or key in seen or (needle and needle not in key):
            continue
        seen.add(key)
        result.append(value.strip())
        if len(result) >= MAX_OWN:
            break
    return result


def _area(props: dict) -> str:
    """Lage einer Unterkunft: Stadtteil, sonst Ort („Mitte“ → „Berlin Mitte“)."""
    city = props.get('city') or props.get('town') or props.get('village') or ''
    district = props.get('district') or props.get('locality') or ''
    if district and city and district != city:
        return f'{city} {district}'[:120]
    return str(district or city)[:120]


def _label(props: dict) -> tuple[str, str] | None:
    """Photon-Treffer → (Name, Zusatz) wie „Café Rosa“ / „Lindenstraße 4, 10115 Berlin“."""
    street = ' '.join(p for p in (props.get('street'), props.get('housenumber')) if p)
    city = ' '.join(p for p in (props.get('postcode'), props.get('city') or props.get('town') or props.get('village')) if p)
    name = props.get('name') or street or city
    if not name:
        return None
    parts = [p for p in (street if street != name else '', city if city != name else '', props.get('country')) if p]
    return str(name)[:120], ', '.join(parts)[:160]


def external_places(query: str, kind: str = 'place', near: str = '') -> tuple[list[dict], bool]:
    """(Treffer, erreichbar). Nur der Suchtext (und ggf. das Reiseziel) verlässt den Server."""
    base = getattr(settings, 'PLACES_PROVIDER_URL', '')
    if not base or len(query) < MIN_EXTERNAL:
        return [], True
    if near and near.casefold() not in query.casefold():
        query = f'{query} {near}'[:MAX_QUERY]
    cache = caches['default']
    key = f'places:{kind}:' + hashlib.sha256(query.casefold().encode()).hexdigest()
    try:
        cached = cache.get(key)
    except Exception:  # Redis nicht erreichbar → ohne Cache weiter
        cached = None
    if cached is not None:
        return cached, True
    params: list[tuple[str, object]] = [('q', query), ('lang', 'de'), ('limit', MAX_EXTERNAL)]
    if kind == 'lodging':
        params += [('osm_tag', tag) for tag in LODGING_TAGS]
    url = f"{base}?{urllib.parse.urlencode(params)}"
    request = urllib.request.Request(url, headers={'User-Agent': '4inOne/1 (+place suggestions)', 'Accept': 'application/json'})
    try:
        with urllib.request.urlopen(request, timeout=3) as response:  # noqa: S310 — feste Adresse aus den Einstellungen
            if response.status != 200:
                return [], False
            data = json.loads(response.read(512 * 1024))
    except Exception as error:  # Netzwerk, Zeitüberschreitung, ungültiges JSON
        logger.info('Ortsvorschläge nicht erreichbar: %s', type(error).__name__)
        return [], False
    results: list[dict] = []
    seen: set[str] = set()
    for feature in (data.get('features') or [])[:MAX_EXTERNAL * 2]:
        props = (feature or {}).get('properties') or {}
        label = _label(props)
        if label is None:
            continue
        name, detail = label
        if (name + detail).casefold() in seen:
            continue
        seen.add((name + detail).casefold())
        results.append({'name': name, 'detail': detail, 'area': _area(props)})
        if len(results) >= MAX_EXTERNAL:
            break
    try:
        cache.set(key, results, CACHE_SECONDS)
    except Exception:
        pass
    return results, True
