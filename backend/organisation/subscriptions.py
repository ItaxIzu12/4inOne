"""O3 – Kalender-Abo (nur lesend, 22.11.2026).

Ein ICS-Link (Google „Geheime Adresse im iCal-Format“, Outlook „ICS veröffentlichen“, iCloud „öffentlicher Kalender“,
Schulferien …) wird serverseitig abgerufen und als nur lesbare Termine gespeichert. Bei jedem Abruf werden die Termine
des Abos vollständig ersetzt – es gibt keine Kopie, die man in Veyora ändern könnte, und nichts geht zurück.

Sicherheit (Server ruft eine von Nutzern genannte Adresse auf – SSRF):
- nur https (webcal:// wird zu https://) und nur Port 443, keine Zugangsdaten im Link;
- der Rechnername wird aufgelöst; ist auch nur eine Adresse privat, lokal, Link-Local, reserviert oder Multicast,
  wird abgelehnt; verbunden wird mit genau der geprüften Adresse (kein zweites DNS-Auflösen, kein „DNS rebinding“),
  das Zertifikat wird gegen den Rechnernamen geprüft;
- Weiterleitungen höchstens 3, jede wird neu geprüft; Zeitlimit 10 s, höchstens 3 MB, höchstens 2000 Termine.

Wiederholungen werden beim Abruf für ein Fenster (60 Tage zurück bis 1 Jahr voraus) in einzelne Termine aufgelöst:
FREQ=DAILY/WEEKLY/MONTHLY/YEARLY mit INTERVAL, COUNT, UNTIL und EXDATE. Regeln, die mehr
verlangen, werden nicht geraten. Unterstützt sind auch Rang-Regeln wie „jeden ersten Montag“ (BYDAY=1MO), „letzter
Freitag“ (-1FR), Monatstage (BYMONTHDAY), Monate (BYMONTH) und BYSETPOS; nicht unterstützt (dann nur der erste Termin):
BYYEARDAY, BYWEEKNO, BYHOUR/BYMINUTE.
"""

from __future__ import annotations

import calendar
import ipaddress
import re
import socket
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone as dt_timezone
from urllib.parse import urljoin, urlsplit, urlunsplit
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import urllib3
from django.conf import settings
from django.db import transaction
from django.utils import timezone


MAX_BYTES = 3 * 1024 * 1024
MAX_EVENTS = 2000
MAX_SUBSCRIPTIONS = 5
TIMEOUT = 10
MAX_REDIRECTS = 3
PAST_DAYS = 60
FUTURE_DAYS = 366
WINDOWS_ZONES = {
    'W. Europe Standard Time': 'Europe/Berlin',
    'Central Europe Standard Time': 'Europe/Budapest',
    'Central European Standard Time': 'Europe/Warsaw',
    'Romance Standard Time': 'Europe/Paris',
    'GMT Standard Time': 'Europe/London',
    'UTC': 'UTC',
}
WEEKDAYS = {'MO': 0, 'TU': 1, 'WE': 2, 'TH': 3, 'FR': 4, 'SA': 5, 'SU': 6}


class SubscriptionError(Exception):
    """Verständliche Meldung für die Person (ohne technische Details oder die geheime Adresse)."""


# --------------------------------------------------------------------------- Adresse prüfen und abrufen


def normalize_url(raw: str) -> str:
    url = (raw or '').strip()
    if url.lower().startswith('webcal://'):
        url = 'https://' + url[len('webcal://'):]
    parts = urlsplit(url)
    if parts.scheme.lower() != 'https' or not parts.hostname:
        raise SubscriptionError('Bitte gib einen Link ein, der mit https:// oder webcal:// beginnt.')
    if parts.username or parts.password:
        raise SubscriptionError('Links mit Benutzername oder Passwort werden nicht unterstützt.')
    if parts.port not in (None, 443):
        raise SubscriptionError('Dieser Link verwendet einen ungewöhnlichen Port und wird aus Sicherheitsgründen nicht abgerufen.')
    return urlunsplit(('https', parts.netloc.lower(), parts.path or '/', parts.query, ''))


def _public_address(host: str) -> str:
    try:
        infos = socket.getaddrinfo(host, 443, proto=socket.IPPROTO_TCP)
    except (socket.gaierror, UnicodeError):
        raise SubscriptionError('Diese Adresse wurde nicht gefunden. Prüfe den Link.')
    addresses = {info[4][0] for info in infos}
    if not addresses:
        raise SubscriptionError('Diese Adresse wurde nicht gefunden. Prüfe den Link.')
    for address in addresses:
        ip = ipaddress.ip_address(address.split('%')[0])
        if not ip.is_global or ip.is_multicast or ip.is_reserved:
            raise SubscriptionError('Dieser Link zeigt auf ein internes Netz und wird nicht abgerufen.')
    return sorted(addresses)[0]


def fetch(url: str) -> str:
    """ICS-Text der Adresse – mit den oben beschriebenen Schutzregeln."""
    current = normalize_url(url)
    for _ in range(MAX_REDIRECTS + 1):
        parts = urlsplit(current)
        host = parts.hostname
        address = _public_address(host)
        pool = urllib3.HTTPSConnectionPool(
            address, port=443, server_hostname=host, assert_hostname=host, cert_reqs='CERT_REQUIRED',
            timeout=urllib3.Timeout(connect=TIMEOUT, read=TIMEOUT), retries=False,
        )
        path = urlunsplit(('', '', parts.path or '/', parts.query, ''))
        try:
            response = pool.request(
                'GET', path, headers={'Host': host, 'Accept': 'text/calendar, */*;q=0.5', 'User-Agent': 'Veyora-Kalenderabo/1.0'},
                redirect=False, preload_content=False,
            )
        except urllib3.exceptions.HTTPError:
            raise SubscriptionError('Der Kalender war nicht erreichbar. Versuch es später noch einmal.')
        try:
            if response.status in (301, 302, 303, 307, 308) and response.headers.get('Location'):
                current = normalize_url(urljoin(current, response.headers['Location']))
                continue
            if response.status in (401, 403, 404):
                raise SubscriptionError('Der Kalender ist unter diesem Link nicht (mehr) freigegeben. Prüfe den Link.')
            if response.status != 200:
                raise SubscriptionError('Der Kalender war nicht erreichbar. Versuch es später noch einmal.')
            body = b''
            for chunk in response.stream(64 * 1024):
                body += chunk
                if len(body) > MAX_BYTES:
                    raise SubscriptionError('Der Kalender ist zu groß (mehr als 3 MB).')
        finally:
            response.release_conn()
            pool.close()
        text = body.decode('utf-8', errors='replace')
        if 'BEGIN:VCALENDAR' not in text.upper():
            raise SubscriptionError('Unter diesem Link liegt kein Kalender im ICS-Format.')
        return text
    raise SubscriptionError('Der Link leitet zu oft weiter.')


# --------------------------------------------------------------------------- ICS lesen


@dataclass
class Occurrence:
    uid: str
    title: str
    starts_at: datetime
    ends_at: datetime | None
    all_day: bool
    location: str


def _unescape(value: str) -> str:
    return value.replace('\\n', '\n').replace('\\N', '\n').replace('\\,', ',').replace('\\;', ';').replace('\\\\', '\\')


def _props(lines: list[str]) -> list[tuple[str, dict, str]]:
    props = []
    for line in lines:
        quoted, split = False, -1
        for i, ch in enumerate(line):
            if ch == '"':
                quoted = not quoted
            elif ch == ':' and not quoted:
                split = i
                break
        if split < 0:
            continue
        name, *raw = line[:split].split(';')
        params = {}
        for p in raw:
            if '=' in p:
                k, v = p.split('=', 1)
                params[k.upper()] = v.strip('"')
        props.append((name.upper(), params, line[split + 1:]))
    return props


def _zone(params: dict, local: ZoneInfo) -> ZoneInfo:
    tzid = params.get('TZID')
    if not tzid:
        return local
    try:
        return ZoneInfo(WINDOWS_ZONES.get(tzid, tzid))
    except (ZoneInfoNotFoundError, ValueError):
        return local


def _instant(params: dict, value: str, local: ZoneInfo) -> tuple[datetime | None, bool]:
    m = re.match(r'^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$', value.strip())
    if not m:
        return None, False
    y, mo, d = int(m[1]), int(m[2]), int(m[3])
    try:
        if m[4] is None:
            return datetime(y, mo, d, tzinfo=local), True
        wall = datetime(y, mo, d, int(m[4]), int(m[5]), int(m[6] or 0))
        return (wall.replace(tzinfo=dt_timezone.utc) if m[7] else wall.replace(tzinfo=_zone(params, local))), False
    except ValueError:
        return None, False


def _duration(value: str) -> timedelta | None:
    m = re.match(r'^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$', value.strip())
    if not m:
        return None
    delta = timedelta(weeks=int(m[2] or 0), days=int(m[3] or 0), hours=int(m[4] or 0), minutes=int(m[5] or 0), seconds=int(m[6] or 0))
    return -delta if m[1] == '-' else delta


def _ints(value: str, low: int, high: int) -> list[int] | None:
    """„1,15,-1“ → [1, 15, -1]; None bei ungültigen Werten (dann wird die Regel nicht geraten)."""
    try:
        numbers = [int(v) for v in value.split(',') if v.strip()]
    except ValueError:
        return None
    return numbers if numbers and all(low <= abs(n) <= high and n != 0 for n in numbers) else None


def _byday(value: str) -> list[tuple[int | None, int]] | None:
    """„MO,WE“ → [(None, 0), (None, 2)]; „1MO,-1FR“ → [(1, 0), (-1, 4)]."""
    specs = []
    for part in value.split(','):
        m = re.match(r'^([+-]?\d{1,2})?(MO|TU|WE|TH|FR|SA|SU)$', part.strip())
        if not m:
            return None
        specs.append((int(m[1]) if m[1] else None, WEEKDAYS[m[2]]))
    return specs


def _month_days(year: int, month: int, monthdays: list[int] | None, byday: list[tuple[int | None, int]] | None, default_day: int) -> list[date]:
    """Tage eines Monats nach BYMONTHDAY bzw. BYDAY (mit Rang wie „1MO“ oder „-1FR“); ungültige Tage entfallen (RFC 5545)."""
    last = calendar.monthrange(year, month)[1]
    days: set[int] = set()
    if monthdays:
        days |= {d if d > 0 else last + 1 + d for d in monthdays}
    elif byday:
        for rank, weekday in byday:
            matches = [d for d in range(1, last + 1) if date(year, month, d).weekday() == weekday]
            if rank is None:
                days |= set(matches)
            elif 1 <= abs(rank) <= len(matches):
                days.add(matches[rank - 1] if rank > 0 else matches[rank])
    else:
        days.add(default_day)
    return [date(year, month, d) for d in sorted(days) if 1 <= d <= last]


def _starts(first: datetime, rule: dict, window_end: datetime, limit: int) -> list[datetime] | None:
    """Beginn aller Vorkommen bis window_end (COUNT zählt ab dem ersten Termin) — None, wenn die Regel nicht unterstützt
    ist (dann erscheint nur der erste Termin). Unterstützt: FREQ=DAILY/WEEKLY/MONTHLY/YEARLY mit INTERVAL, COUNT, UNTIL,
    BYDAY (bei MONTHLY/YEARLY auch mit Rang wie 1MO oder -1FR), BYMONTHDAY, BYMONTH und BYSETPOS."""
    freq = rule.get('FREQ')
    supported = {'FREQ', 'INTERVAL', 'COUNT', 'UNTIL', 'WKST', 'BYDAY', 'BYMONTHDAY', 'BYMONTH', 'BYSETPOS'}
    if freq not in ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY') or set(rule) - supported:
        return None
    try:
        interval = max(1, int(rule.get('INTERVAL', '1')))
        count = int(rule['COUNT']) if 'COUNT' in rule else None
    except ValueError:
        return None
    until = None
    if 'UNTIL' in rule:
        until, _ = _instant({}, rule['UNTIL'], first.tzinfo)
        if until is None:
            return None
        if len(rule['UNTIL'].strip()) == 8:  # nur Datum: der ganze Tag zählt
            until = until + timedelta(days=1) - timedelta(seconds=1)
    byday = _byday(rule['BYDAY']) if 'BYDAY' in rule else None
    monthdays = _ints(rule['BYMONTHDAY'], 1, 31) if 'BYMONTHDAY' in rule else None
    months = _ints(rule['BYMONTH'], 1, 12) if 'BYMONTH' in rule else None
    setpos = _ints(rule['BYSETPOS'], 1, 366) if 'BYSETPOS' in rule else None
    if ('BYDAY' in rule and byday is None) or ('BYMONTHDAY' in rule and monthdays is None) \
            or ('BYMONTH' in rule and (months is None or any(m < 0 for m in months))) or ('BYSETPOS' in rule and setpos is None):
        return None
    if byday and freq in ('DAILY', 'WEEKLY') and any(rank is not None for rank, _ in byday):
        return None  # Rang („1MO“) nur bei Monat/Jahr sinnvoll
    if setpos and freq not in ('MONTHLY', 'YEARLY'):
        return None

    wall = first.replace(tzinfo=None)
    zone = first.tzinfo
    clock = wall.time()
    result: list[datetime] = []

    def period_dates(step: int) -> list[date]:
        if freq == 'DAILY':
            day = wall.date() + timedelta(days=step * interval)
            ok = (not byday or day.weekday() in {w for _, w in byday}) and (not months or day.month in months)
            return [day] if ok else []
        if freq == 'WEEKLY':
            week_start = wall.date() - timedelta(days=wall.weekday()) + timedelta(weeks=step * interval)
            weekdays = sorted({w for _, w in byday}) if byday else [wall.weekday()]
            return [d for d in (week_start + timedelta(days=w) for w in weekdays) if not months or d.month in months]
        if freq == 'MONTHLY':
            index = wall.month - 1 + step * interval
            year, month = wall.year + index // 12, index % 12 + 1
            if months and month not in months:
                return []
            days = _month_days(year, month, monthdays, byday, wall.day)
        else:  # YEARLY
            year = wall.year + step * interval
            days = [d for m in (months or [wall.month]) for d in _month_days(year, m, monthdays, byday, wall.day)]
        if setpos:
            picked = {days[p - 1] if p > 0 else days[p] for p in setpos if 1 <= abs(p) <= len(days)}
            days = sorted(picked)
        return days

    for step in range(5000):
        candidates = period_dates(step)
        if candidates and datetime.combine(candidates[0], clock).replace(tzinfo=zone) > window_end:
            break
        for day in candidates:
            moment = datetime.combine(day, clock)
            if moment < wall:
                continue
            aware = moment.replace(tzinfo=zone)
            if (until and aware > until) or aware > window_end or (count is not None and len(result) >= count) or len(result) >= limit:
                return result
            result.append(aware)
    return result


def parse(text: str, local: ZoneInfo | None = None, now: datetime | None = None) -> list[Occurrence]:
    """Alle Termine im Fenster (60 Tage zurück bis 1 Jahr voraus), Wiederholungen als einzelne Termine."""
    local = local or ZoneInfo(settings.TIME_ZONE)
    now = now or timezone.now()
    window_start = now - timedelta(days=PAST_DAYS)
    window_end = now + timedelta(days=FUTURE_DAYS)
    lines = re.sub(r'\r\n[ \t]|\n[ \t]|\r[ \t]', '', text).splitlines()
    events: list[list[str]] = []
    current, depth = None, 0
    for line in lines:
        upper = line.upper()
        if upper == 'BEGIN:VEVENT':
            current, depth = [], 0
        elif current is None:
            continue
        elif upper.startswith('BEGIN:'):
            depth += 1
        elif upper == 'END:VEVENT':
            events.append(current)
            current = None
        elif upper.startswith('END:'):
            depth -= 1
        elif depth == 0:
            current.append(line)
    result: list[Occurrence] = []
    for lines_ in events:
        props = _props(lines_)
        get = lambda name: next((p for p in props if p[0] == name), None)  # noqa: E731
        status = get('STATUS')
        if (status and status[2].upper() == 'CANCELLED') or get('RECURRENCE-ID'):
            continue
        start_p = get('DTSTART')
        if not start_p:
            continue
        starts, all_day = _instant(start_p[1], start_p[2], local)
        if starts is None:
            continue
        all_day = all_day or start_p[1].get('VALUE') == 'DATE'
        end_p, dur_p = get('DTEND'), get('DURATION')
        length = None
        if end_p:
            ends, _ = _instant(end_p[1], end_p[2], local)
            if ends is not None and ends >= starts:
                length = ends - starts
        elif dur_p:
            length = _duration(dur_p[2])
        if all_day:
            # Ganztägig: DTEND ist der Tag NACH dem letzten Tag → gespeichert wird Mitternacht des letzten Tags.
            days = max(1, length.days) if length else 1
            length = timedelta(days=days - 1) if days > 1 else None
        title = (_unescape(get('SUMMARY')[2]) if get('SUMMARY') else '').strip()[:120] or 'Ohne Titel'
        location = (_unescape(get('LOCATION')[2]) if get('LOCATION') else '').strip()[:240]
        uid = (get('UID')[2] if get('UID') else '')[:255]
        excluded = set()
        for name, params, value in props:
            if name == 'EXDATE':
                for part in value.split(','):
                    when, _ = _instant(params, part, local)
                    if when:
                        excluded.add(when.astimezone(dt_timezone.utc).replace(second=0, microsecond=0))
        rule_p = get('RRULE')
        starts_list = [starts]
        if rule_p:
            rule = dict(kv.split('=', 1) for kv in rule_p[2].upper().split(';') if '=' in kv)
            expanded = _starts(starts, rule, window_end, MAX_EVENTS)
            if expanded is not None:
                starts_list = expanded
        for begin in starts_list:
            if begin.astimezone(dt_timezone.utc).replace(second=0, microsecond=0) in excluded:
                continue
            end = begin + length if length else None
            if (end or begin) < window_start or begin > window_end:
                continue
            result.append(Occurrence(uid, title, begin, end, all_day, location))
            if len(result) >= MAX_EVENTS:
                return result
    return result


# --------------------------------------------------------------------------- Abo aktualisieren


def refresh(subscription, text: str | None = None) -> int:
    """Termine des Abos neu laden und vollständig ersetzen. Gibt die Anzahl zurück; Fehler landen in last_error."""
    from organisation.models import SubscribedEvent

    try:
        occurrences = parse(text if text is not None else fetch(subscription.url))
    except SubscriptionError as error:
        subscription.last_error = str(error)[:240]
        subscription.save(update_fields=['last_error'])
        raise
    with transaction.atomic():
        subscription.events.all().delete()
        SubscribedEvent.objects.bulk_create([
            SubscribedEvent(subscription=subscription, uid=o.uid, title=o.title, starts_at=o.starts_at, ends_at=o.ends_at,
                            all_day=o.all_day, location=o.location)
            for o in occurrences
        ])
        subscription.last_synced_at = timezone.now()
        subscription.last_error = ''
        subscription.save(update_fields=['last_synced_at', 'last_error'])
    return len(occurrences)


def events_between(user, start: date, end: date, tz: ZoneInfo):
    """Abo-Termine der Person, die [start, end] berühren (nur eigene Abos)."""
    from django.db.models import Q

    from organisation.models import SubscribedEvent

    lower = datetime.combine(start, time.min, tzinfo=tz)
    upper = datetime.combine(end + timedelta(days=1), time.min, tzinfo=tz)
    return (
        SubscribedEvent.objects.filter(subscription__owner=user, starts_at__lt=upper)
        .filter(Q(starts_at__gte=lower) | Q(ends_at__gte=lower))
        .select_related('subscription')
        .order_by('starts_at', 'id')[:MAX_EVENTS]
    )
