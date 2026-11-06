"""Connection Engine V2 — abgeleitete Verbindungen (01.11.2026, docs/CONNECTION_ENGINE_V2_AUDIT.md).

Grundregel (Entscheidung „A: abgeleitet“): Es gibt genau EINE Quelle (Vertrag, Gerät, Reise, Sparziel, Haushalt).
Was in Finanzen („Geplant“) oder Organisation (Kalender, Aufgaben) erscheint, wird bei jedem Lesen aus dieser Quelle
berechnet. Daraus folgen die Engine-Regeln ohne Abgleich-Code:

- UPDATE: Ändert sich die Quelle, ändert sich alles Abgeleitete beim nächsten Lesen — nur für die Zukunft, weil
  Finanzen „Geplant“ nur für den laufenden und künftige Monate rechnet; gebuchte Ausgaben sind nie betroffen.
- IDEMPOTENZ/CONCURRENCY: je Person, Art und Quelle höchstens eine AutoLink-Zeile (Datenbank-Constraint); erneutes
  Anlegen liefert dieselbe Zeile. Abgeleitete Einträge können sich nicht verdoppeln, weil sie nicht gespeichert sind.
- KONFLIKTE: Es gibt keine Kopie, die jemand von Hand ändern könnte — geändert wird an der Quelle.
- PAUSE: nichts erscheint, die Einstellung bleibt. UNLINK: Zeile weg, Protokoll bleibt; echte Buchungen, Termine und
  Aufgaben werden nie angefasst.
- RECHTE: Die Quelle wird bei jedem Lesen gegen IHRE Regel geprüft (connections/registry.py). Wer den Zugang verliert
  (Haushalt verlassen, aus Reise entfernt), sieht ab sofort nichts mehr davon. Vertragsbeträge nur für die Person,
  die sie eingetragen hat (haushalt.services.can_see_cost).
- KEINE ERFUNDENEN DATEN: Erinnerungen nur mit bestätigten Angaben (Vertragsende UND Kündigungsfrist, eingetragener
  Wartungstermin, Zieldatum). Fehlt etwas, sagt `problem`, was — es wird nichts geraten.
"""

from __future__ import annotations

import calendar
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal

from django.db import IntegrityError, transaction
from django.utils import timezone

from connections.models import AutoAction, AutoKind, AutoLink, AutoLinkEvent, AutoStatus, ObjectType
from connections.registry import KINDS

SOURCE_TYPE = {
    AutoKind.CONTRACT_FINANCE: ObjectType.CONTRACT,
    AutoKind.CONTRACT_REMINDER: ObjectType.CONTRACT,
    AutoKind.DEVICE_MAINTENANCE: ObjectType.DEVICE,
    AutoKind.TRIP_CALENDAR: ObjectType.TRIP,
    AutoKind.SAVINGS_REMINDER: ObjectType.SAVINGS_GOAL,
    AutoKind.HOUSEHOLD_TASKS: 'HOUSEHOLD',
}
# Welche Verbindungen eine Quelle anbietet (Reihenfolge = Anzeige)
KINDS_FOR_SOURCE = {
    ObjectType.CONTRACT: [AutoKind.CONTRACT_FINANCE, AutoKind.CONTRACT_REMINDER],
    ObjectType.DEVICE: [AutoKind.DEVICE_MAINTENANCE],
    ObjectType.TRIP: [AutoKind.TRIP_CALENDAR],
    ObjectType.SAVINGS_GOAL: [AutoKind.SAVINGS_REMINDER],
    'HOUSEHOLD': [AutoKind.HOUSEHOLD_TASKS],
}
MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']


class AutoLinkError(Exception):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.message = message
        self.status = status


# --------------------------------------------------------------------------- Quellen und Rechte


def _household_of(user):
    from haushalt.services import membership_for

    membership = membership_for(user)
    return membership.household if membership is not None else None


def visible_source(user, kind: str, source_id: int):
    """Die Quelle, wenn die Person sie sehen darf — sonst None (fremd und nicht vorhanden sind gleich)."""
    source_type = SOURCE_TYPE[kind]
    if source_type == 'HOUSEHOLD':
        household = _household_of(user)
        return household if household is not None and household.pk == source_id else None
    return KINDS[source_type].visible(user).filter(pk=source_id).first()


def _visible_sources(user, kind: str, ids: set[int]) -> dict[int, object]:
    if not ids:
        return {}
    source_type = SOURCE_TYPE[kind]
    if source_type == 'HOUSEHOLD':
        household = _household_of(user)
        return {household.pk: household} if household is not None and household.pk in ids else {}
    return {obj.pk: obj for obj in KINDS[source_type].visible(user).filter(pk__in=ids)}


# --------------------------------------------------------------------------- Fachregeln je Art


def _de(day: date) -> str:
    return day.strftime('%d.%m.%Y')


def _euro(value: Decimal) -> str:
    return f'{value:,.2f} €'.replace(',', 'X').replace('.', ',').replace('X', '.')


CYCLE_MONTHS = {'MONTHLY': 1, 'QUARTERLY': 3, 'YEARLY': 12}
CYCLE_LABEL = {'MONTHLY': 'monatlich', 'QUARTERLY': 'vierteljährlich', 'YEARLY': 'jährlich', 'ONE_TIME': 'einmalig'}


def contract_finance_problem(entry, user) -> str:
    from haushalt.models import FolderEntry
    from haushalt.services import can_see_cost, contract_status

    if not can_see_cost(entry, user):
        return 'Den Betrag hat jemand anderes eingetragen — er bleibt privat und lässt sich nur von dieser Person planen.'
    if entry.cost is None or entry.cost <= 0:
        return 'Trage zuerst den Betrag ein — ohne Betrag gibt es nichts zu planen.'
    if entry.billing_cycle != 'MONTHLY' and entry.start_date is None:
        return 'Für nicht monatliche Zahlungen fehlt das Startdatum — sonst ist unklar, in welchem Monat gezahlt wird.'
    if contract_status(entry) == FolderEntry.Status.ENDED:
        return 'Der Vertrag ist beendet.'
    return ''


def contract_payment_days(entry, start: date, end: date) -> list[date]:
    """Zahlungstage eines Vertrags im Zeitraum [start, end). Monatlich: jeden Monat am Tag des Startdatums (sonst 1.),
    am Monatsende gekappt; vierteljährlich/jährlich: ab dem Startmonat im Rhythmus; einmalig: nur am Startdatum.
    Vor dem Start und nach dem Ende (ohne automatische Verlängerung) nichts."""
    days: list[date] = []
    anchor = entry.start_date
    month = date(start.year, start.month, 1)
    while month < end:
        last = calendar.monthrange(month.year, month.month)[1]
        if entry.billing_cycle == 'ONE_TIME':
            due = anchor if anchor and anchor.year == month.year and anchor.month == month.month else None
        else:
            step = CYCLE_MONTHS.get(entry.billing_cycle, 1)
            offset = (month.year - anchor.year) * 12 + (month.month - anchor.month) if anchor else 0
            due = month.replace(day=min(anchor.day if anchor else 1, last)) if offset % step == 0 else None
        if due is not None and start <= due < end:
            started = anchor is None or due >= anchor
            running = entry.end_date is None or due <= entry.end_date or entry.auto_renewal
            if started and running:
                days.append(due)
        month = (month.replace(day=28) + timedelta(days=4)).replace(day=1)
    return days


def contract_reminder_day(entry) -> tuple[date | None, str]:
    """(Kündigungstag, Problem). Nur mit Vertragsende UND eingetragener Kündigungsfrist — nie geraten (QA-04)."""
    from haushalt.models import FolderEntry
    from haushalt.services import cancellation_deadline, contract_status, has_notice_period

    status = contract_status(entry)
    if status in (FolderEntry.Status.CANCELLED, FolderEntry.Status.ENDED):
        return None, 'Der Vertrag ist gekündigt oder beendet — es gibt keine Kündigungsfrist mehr.'
    if entry.end_date is None and not has_notice_period(entry):
        return None, 'Vertragsende und Kündigungsfrist fehlen — ohne sie erfindet 4inOne keine Frist.'
    if entry.end_date is None:
        return None, 'Das Vertragsende fehlt — ohne Laufzeitende lässt sich keine Kündigungsfrist berechnen.'
    if not has_notice_period(entry):
        return None, 'Die Kündigungsfrist fehlt — trage sie ein (z. B. 1 Monat), dann entsteht die Erinnerung.'
    day = cancellation_deadline(entry)
    if day is not None and day < timezone.localdate():
        return day, 'Die Kündigungsfrist ist vorbei — trage bei Verlängerung das neue Laufzeitende ein.'
    return day, ''


def device_maintenance_day(entry) -> tuple[date | None, str]:
    from haushalt.models import FolderEntry

    if entry.status == FolderEntry.Status.RETIRED:
        return None, 'Das Gerät ist außer Betrieb.'
    if entry.maintenance_due_date is None:
        return None, 'Es ist kein Wartungstermin eingetragen — trage „Nächste Wartung“ ein.'
    return entry.maintenance_due_date, ''


def savings_day(goal) -> tuple[date | None, str]:
    """Zieldatum, sonst der Endmonat des Sparzeitraums (1. des Monats) — beides von der Person eingetragen.
    Offener Zeitraum ohne Zieldatum → kein Termin (nichts geraten)."""
    if goal.target_date is not None:
        return goal.target_date, ''
    if goal.plan_end_month is not None:
        return goal.plan_end_month.replace(day=1), ''
    return None, 'Das Sparziel hat kein Ende (offener Zeitraum) — es gibt keinen Termin zum Erinnern.'


def trip_problem(trip) -> str:
    return 'Die Reise ist abgesagt.' if getattr(trip, 'status', '') == 'CANCELLED' else ''


def describe(user, kind: str, source) -> tuple[str, str]:
    """(Vorschau, Problem): was genau in welchem Bereich erscheint — oder warum nichts erscheinen kann."""
    if kind == AutoKind.CONTRACT_FINANCE:
        problem = contract_finance_problem(source, user)
        if problem:
            return '', problem
        from haushalt.services import cost_on

        today = timezone.localdate()
        start = f' ab {MONTHS[source.start_date.month - 1]} {source.start_date.year}' if source.start_date else ''
        upcoming = ''
        if source.next_cost is not None and source.next_cost_from and source.next_cost_from > today:
            upcoming = f', ab {_de(source.next_cost_from)} {_euro(source.next_cost)}'
        return (f'Finanzen › Geplant: {_euro(cost_on(source, today))} {CYCLE_LABEL.get(source.billing_cycle, "")}{start}'
                f'{upcoming} — keine Buchung.', '')
    if kind == AutoKind.CONTRACT_REMINDER:
        day, problem = contract_reminder_day(source)
        if problem and day is None:
            return '', problem
        from haushalt.services import reminder_lead_day

        lead = reminder_lead_day(source, day)
        ahead = f' Hinweis {source.reminder_lead_days} Tage vorher ({_de(lead)}).' if lead else ''
        return f'Organisation › Kalender: „Kündigen bis: {source.name}“ am {_de(day)}.{ahead}', problem
    if kind == AutoKind.DEVICE_MAINTENANCE:
        day, problem = device_maintenance_day(source)
        return (f'Organisation › Kalender: „Wartung: {source.name}“ am {_de(day)}.', '') if day else ('', problem)
    if kind == AutoKind.TRIP_CALENDAR:
        problem = trip_problem(source)
        if problem:
            return '', problem
        return f'Organisation › Kalender: {source.title} vom {_de(source.start_date)} bis {_de(source.end_date)} (ganztägig).', ''
    if kind == AutoKind.SAVINGS_REMINDER:
        day, problem = savings_day(source)
        if not day:
            return '', problem
        when = f'am {_de(day)}' if source.target_date else f'im {MONTHS[day.month - 1]} {day.year} (letzter Monat)'
        return f'Organisation › Kalender: „Sparziel: {source.title}“ {when} — löst keine Zahlung aus.', ''
    if kind == AutoKind.HOUSEHOLD_TASKS:
        return 'Organisation › Aufgaben: offene Haushaltsaufgaben, die dir oder niemandem zugewiesen sind. Erledigen gilt für beide Ansichten.', ''
    return '', ''


# --------------------------------------------------------------------------- Verwalten (CREATE/PAUSE/RESUME/UNLINK/STATUS)


def _log(user, kind: str, source_id: int, action: str) -> None:
    AutoLinkEvent.objects.create(owner=user, kind=kind, source_id=source_id, action=action)


def link_state(user, link: AutoLink | None, kind: str, source) -> dict:
    preview, problem = describe(user, kind, source)
    return {
        'kind': kind,
        'label': AutoKind(kind).label,
        'link_id': link.pk if link else None,
        'status': link.status if link else None,
        'preview': preview,
        'problem': problem,
        # Anlegen ist auch mit Problem erlaubt (z. B. Frist kommt später) — außer der Betrag gehört jemand anderem
        'available': not (kind == AutoKind.CONTRACT_FINANCE and problem.startswith('Den Betrag hat jemand anderes')),
    }


def states_for(user, source_type: str, source_id: int) -> list[dict]:
    kinds = KINDS_FOR_SOURCE.get(source_type)
    if not kinds:
        raise AutoLinkError('Für diese Art gibt es keine Verbindungen.', 400)
    source = visible_source(user, kinds[0], source_id)
    if source is None:
        raise AutoLinkError('Nicht gefunden.', 404)
    links = {l.kind: l for l in AutoLink.objects.filter(owner=user, kind__in=kinds, source_id=source_id)}
    return [link_state(user, links.get(kind), kind, source) for kind in kinds]


def create(user, kind: str, source_id: int) -> tuple[AutoLink, bool]:
    """Idempotent: gibt es die Verbindung schon (auch parallel angelegt), kommt dieselbe zurück — nie zwei."""
    if kind not in AutoKind.values:
        raise AutoLinkError('Diese Verbindung gibt es nicht.', 400)
    source = visible_source(user, kind, source_id)
    if source is None:
        raise AutoLinkError('Nicht gefunden.', 404)
    if not link_state(user, None, kind, source)['available']:
        raise AutoLinkError(describe(user, kind, source)[1], 403)
    existing = AutoLink.objects.filter(owner=user, kind=kind, source_id=source_id).first()
    if existing is not None:
        return existing, False
    try:
        with transaction.atomic():
            link = AutoLink.objects.create(owner=user, kind=kind, source_id=source_id)
            _log(user, kind, source_id, AutoAction.CREATE)
    except IntegrityError:  # gleichzeitig angelegt → die andere gewinnt
        return AutoLink.objects.get(owner=user, kind=kind, source_id=source_id), False
    return link, True


def _own_link(user, link_id: int) -> AutoLink:
    link = AutoLink.objects.filter(owner=user, pk=link_id).first()
    # Eigene Zeile, aber die Quelle ist nicht mehr sichtbar → wie nicht vorhanden behandeln
    if link is None or visible_source(user, link.kind, link.source_id) is None:
        raise AutoLinkError('Nicht gefunden.', 404)
    return link


def set_status(user, link_id: int, status: str) -> AutoLink:
    if status not in AutoStatus.values:
        raise AutoLinkError('Unbekannter Status.', 400)
    with transaction.atomic():
        link = _own_link(user, link_id)
        link = AutoLink.objects.select_for_update().get(pk=link.pk)
        if link.status != status:
            link.status = status
            link.save(update_fields=['status', 'updated_at'])
            _log(user, link.kind, link.source_id, AutoAction.PAUSE if status == AutoStatus.PAUSED else AutoAction.RESUME)
    return link


def unlink(user, link_id: int) -> None:
    """Hebt nur die Verbindung auf — Quelle, Buchungen, Termine und Aufgaben bleiben unverändert (QA-09)."""
    with transaction.atomic():
        link = _own_link(user, link_id)
        _log(user, link.kind, link.source_id, AutoAction.UNLINK)
        link.delete()


def remove_for_source(kinds: list[str], source_id: int) -> None:
    """Quelle gelöscht (Signal): Verbindungen aller Personen entfernen, im Protokoll vermerken."""
    for link in AutoLink.objects.filter(kind__in=kinds, source_id=source_id):
        _log(link.owner, link.kind, link.source_id, AutoAction.SOURCE_GONE)
        link.delete()


# --------------------------------------------------------------------------- Abgeleitetes lesen


def _active(user, kind: str) -> dict[int, AutoLink]:
    return {l.source_id: l for l in AutoLink.objects.filter(owner=user, kind=kind, status=AutoStatus.ACTIVE)}


def contract_planned(user, start: date, end: date, month_rows) -> list[dict]:
    """CON-01 für finanzen.private_api.planned_expenses: aktive Verträge als „Geplant“ im Zahlungsmonat.

    - Nur laufender und künftige Monate (wie wiederkehrende Posten) → Preisänderungen wirken nur nach vorn (QA-02),
      Vergangenes und gebuchte Ausgaben bleiben unberührt (QA-03).
    - Wird im Monat eine Ausgabe mit dem Vertragsnamen als Notiz gebucht, ersetzt sie den Planwert — nie doppelt (QA-01)."""
    from haushalt.services import cost_on

    if start < timezone.localdate().replace(day=1):
        return []
    links = _active(user, AutoKind.CONTRACT_FINANCE)
    if not links:
        return []
    booked = {(note or '').strip().casefold() for note in month_rows.filter(type='EXPENSE').values_list('description', flat=True)}
    items = []
    for entry in _visible_sources(user, AutoKind.CONTRACT_FINANCE, set(links)).values():
        if contract_finance_problem(entry, user) or entry.name.strip().casefold() in booked:
            continue
        for day in contract_payment_days(entry, start, end):
            items.append({'kind': 'CONTRACT', 'key': f'contract:{entry.pk}', 'id': None, 'source_id': entry.pk,
                          'title': entry.name.strip(), 'category': None, 'amount': cost_on(entry, day), 'date': day})
    return items


@dataclass
class DerivedItem:
    key: str
    kind: str
    title: str
    date: date
    end_date: date | None
    source_type: str
    source_id: int
    domain: str

    def as_dict(self) -> dict:
        return {'key': self.key, 'kind': self.kind, 'title': self.title, 'date': self.date.isoformat(),
                'end_date': self.end_date.isoformat() if self.end_date else None, 'all_day': True,
                'source_type': self.source_type, 'source_id': self.source_id, 'domain': self.domain}


def calendar_items(user, start: date, end: date) -> list[dict]:
    """CON-02/04/07/10 für Organisation: abgeleitete, nur lesbare Kalendereinträge im Zeitraum [start, end]."""
    from haushalt.services import reminder_lead_day

    items: list[DerivedItem] = []
    contracts = _visible_sources(user, AutoKind.CONTRACT_REMINDER, set(_active(user, AutoKind.CONTRACT_REMINDER)))
    for entry in contracts.values():
        day, _problem = contract_reminder_day(entry)
        if day and start <= day <= end:
            items.append(DerivedItem(f'contract:{entry.pk}', AutoKind.CONTRACT_REMINDER, f'Kündigen bis: {entry.name}', day, None, ObjectType.CONTRACT, entry.pk, 'haushalt'))
        lead = reminder_lead_day(entry, day) if day and day >= timezone.localdate() else None
        if lead and start <= lead <= end:
            items.append(DerivedItem(f'contract-lead:{entry.pk}', AutoKind.CONTRACT_REMINDER, f'Kündigung vorbereiten: {entry.name} (bis {_de(day)})', lead, None, ObjectType.CONTRACT, entry.pk, 'haushalt'))
    devices = _visible_sources(user, AutoKind.DEVICE_MAINTENANCE, set(_active(user, AutoKind.DEVICE_MAINTENANCE)))
    for entry in devices.values():
        day, _ = device_maintenance_day(entry)
        if day and start <= day <= end:
            items.append(DerivedItem(f'device:{entry.pk}', AutoKind.DEVICE_MAINTENANCE, f'Wartung: {entry.name}', day, None, ObjectType.DEVICE, entry.pk, 'haushalt'))
    trips = _visible_sources(user, AutoKind.TRIP_CALENDAR, set(_active(user, AutoKind.TRIP_CALENDAR)))
    for trip in trips.values():
        if not trip_problem(trip) and trip.start_date <= end and trip.end_date >= start:
            items.append(DerivedItem(f'trip:{trip.pk}', AutoKind.TRIP_CALENDAR, trip.title, trip.start_date, trip.end_date, ObjectType.TRIP, trip.pk, 'reisen'))
    goals = _visible_sources(user, AutoKind.SAVINGS_REMINDER, set(_active(user, AutoKind.SAVINGS_REMINDER)))
    for goal in goals.values():
        day, _ = savings_day(goal)
        if day and start <= day <= end:
            items.append(DerivedItem(f'goal:{goal.pk}', AutoKind.SAVINGS_REMINDER, f'Sparziel: {goal.title}', day, None, ObjectType.SAVINGS_GOAL, goal.pk, 'finanzen'))
    items.sort(key=lambda i: (i.date, i.title.casefold(), i.key))
    return [i.as_dict() for i in items]


def household_tasks(user):
    """CON-03: offene Haushaltsaufgaben für Organisation › Aufgaben — derselbe Datensatz (ein logischer Task),
    nur wenn verbunden, ohne Kind-Sperre (Aufgaben sehen alle Mitglieder) und nur mir oder niemandem zugewiesen."""
    from django.db.models import Q
    from haushalt.models import Task as HouseholdTask

    household = _household_of(user)
    if household is None or not AutoLink.objects.filter(owner=user, kind=AutoKind.HOUSEHOLD_TASKS, source_id=household.pk, status=AutoStatus.ACTIVE).exists():
        return HouseholdTask.objects.none()
    return (HouseholdTask.objects.filter(household=household, is_done=False, is_paused=False)
            .filter(Q(assigned_to=user) | Q(assigned_to__isnull=True)).order_by('due_date', 'id'))
