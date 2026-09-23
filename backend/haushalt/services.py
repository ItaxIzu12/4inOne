"""Fachlogik des Haushalt-Moduls: Einkaufsliste, Einkauf-zu-Ausgabe,
wiederkehrende Aufgaben mit Rotation und der Haushaltsordner.

Views bleiben dünn und rufen nur diese Funktionen auf. Querverbindungen zu
Finanzen und Organisation laufen über direkte Service-Aufrufe
(ARCHITEKTUR.md §2.1), nicht über Signale."""

import calendar
from datetime import date, datetime, time, timedelta
from decimal import ROUND_HALF_UP, Decimal

from django.db import IntegrityError
from django.db import transaction as db_transaction
from django.db.models import Count, F, Sum
from django.utils import timezone

from core.models import Household, HouseholdMembership
from finanzen import services as finanzen_services
from finanzen.models import Category
from haushalt.models import (
    SECTION_ORDER,
    FolderEntry,
    ItemMemory,
    Section,
    ShoppingItem,
    ShoppingList,
    ShoppingTrip,
    Task,
    TaskCompletion,
)
from organisation.models import CalendarEvent

# Solange ein Haushalt noch keinen Einkauf mit Betrag abgeschlossen hat,
# gibt es keine eigene Erfahrung — dann gilt dieser Durchschnittspreis pro
# Artikel als Startwert für den Schätz-Vorschlag.
DEFAULT_PRICE_PER_ITEM = Decimal('3.50')

# Nur die letzten Einkäufe fließen in die Schätzung ein, damit sich z. B.
# Preissteigerungen oder ein neuer Supermarkt schnell niederschlagen.
ESTIMATE_TRIP_WINDOW = 10

# Obergrenzen pro Haushalt — wie MAX_CATEGORIES_PER_HOUSEHOLD in finanzen/:
# weit über normalem Gebrauch, aber ein Frontend-Bug in einer Schleife oder
# ein missbrauchtes Konto kann die Datenbank nicht unbegrenzt füllen.
MAX_OPEN_ITEMS = 200
MAX_OPEN_TASKS = 200
MAX_FOLDER_ENTRIES = 200
# Gemerkte Artikel werden nicht abgelehnt, sondern ausgedünnt: über dieser
# Zahl fallen die am seltensten und am längsten nicht genutzten weg.
MAX_ITEM_MEMORIES = 500

# Grobe Zuordnung häufiger Begriffe zu Ladenbereichen, damit ein neuer
# Eintrag ohne Nachfrage an der richtigen Stelle der Liste landet. Gilt nur,
# solange der Haushalt den Artikel noch nicht selbst einsortiert hat — dann
# gewinnt ItemMemory.section.
SECTION_KEYWORDS: dict[str, tuple[str, ...]] = {
    Section.PRODUCE: (
        'apfel', 'äpfel', 'banane', 'birne', 'tomate', 'gurke', 'salat', 'kartoffel', 'zwiebel',
        'knoblauch', 'paprika', 'karotte', 'möhre', 'zitrone', 'orange', 'beere', 'traube', 'obst',
        'gemüse', 'avocado', 'brokkoli', 'zucchini', 'pilz', 'champignon', 'kräuter', 'petersilie',
    ),
    Section.BAKERY: ('brot', 'brötchen', 'toast', 'baguette', 'croissant', 'brezel', 'kuchen'),
    Section.DAIRY: (
        'milch', 'joghurt', 'käse', 'butter', 'quark', 'sahne', 'ei', 'eier', 'margarine', 'frischkäse',
        'mozzarella', 'schmand', 'aufschnitt',
    ),
    Section.MEAT: ('fleisch', 'hähnchen', 'huhn', 'hack', 'wurst', 'schinken', 'fisch', 'lachs', 'thunfisch'),
    Section.FROZEN: ('tiefkühl', 'pizza', 'eis', 'pommes', 'tk-'),
    Section.PANTRY: (
        'nudel', 'pasta', 'reis', 'mehl', 'zucker', 'salz', 'öl', 'essig', 'müsli', 'haferflocken',
        'konserve', 'dose', 'soße', 'sauce', 'gewürz', 'kaffee', 'tee', 'honig', 'marmelade', 'schokolade',
        'kekse', 'chips',
    ),
    Section.DRINKS: ('wasser', 'saft', 'bier', 'wein', 'cola', 'limo', 'sprudel', 'getränk'),
    Section.TOILETRIES: (
        'shampoo', 'duschgel', 'seife', 'zahnpasta', 'zahnbürste', 'deo', 'creme', 'windel', 'tampon',
        'binden', 'rasier',
    ),
    Section.HOUSEHOLD: (
        'klopapier', 'toilettenpapier', 'küchenrolle', 'spülmittel', 'waschmittel', 'müllbeutel',
        'schwamm', 'reiniger', 'tabs', 'alufolie', 'backpapier', 'batterie', 'glühbirne',
    ),
}


# ---------------------------------------------------------------------------
# Allgemein
# ---------------------------------------------------------------------------


def membership_for(user) -> HouseholdMembership | None:
    """Die Mitgliedschaft im (aktuell einzigen) Haushalt der Person —
    dieselbe .first()-Konvention wie in finanzen/views.py."""
    return HouseholdMembership.objects.select_related('household').filter(user=user).order_by('id').first()


def is_child_account(membership: HouseholdMembership | None) -> bool:
    return membership is not None and membership.role == HouseholdMembership.Role.CHILD_ACCOUNT


def add_months(value: date, months: int) -> date:
    """value + months Monate; der Tag wird auf das Monatsende begrenzt
    (31.01. + 1 Monat = 28./29.02.)."""
    month_index = value.month - 1 + months
    year = value.year + month_index // 12
    month = month_index % 12 + 1
    day = min(value.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def _start_of_day(value: date) -> datetime:
    return timezone.make_aware(datetime.combine(value, time.min))


def upsert_all_day_event(
    household: Household, source: str, source_key: str, title: str, day: date | None, user=None
) -> CalendarEvent | None:
    """Legt einen ganztägigen Termin an, aktualisiert ihn oder entfernt ihn
    (day=None). Der source_key macht den Aufruf wiederholbar: dieselbe Frist
    erzeugt nie einen zweiten Termin."""
    existing = CalendarEvent.objects.filter(household=household, source_key=source_key).first()
    if day is None:
        if existing is not None:
            existing.delete()
        return None
    if existing is None:
        return CalendarEvent.objects.create(
            household=household,
            created_by=user,
            title=title[:120],
            starts_at=_start_of_day(day),
            all_day=True,
            source=source,
            source_key=source_key,
        )
    existing.title = title[:120]
    existing.starts_at = _start_of_day(day)
    existing.all_day = True
    existing.save(update_fields=['title', 'starts_at', 'all_day'])
    return existing


# ---------------------------------------------------------------------------
# Einkaufsliste
# ---------------------------------------------------------------------------


def active_shopping_list(household: Household) -> ShoppingList:
    shopping_list = ShoppingList.objects.filter(household=household).order_by('id').first()
    if shopping_list is None:
        shopping_list = ShoppingList.objects.create(household=household)
    return shopping_list


def guess_section(household: Household, name: str) -> str:
    memory = ItemMemory.objects.filter(household=household, name__iexact=name.strip()).first()
    if memory is not None:
        return memory.section
    lowered = name.lower()
    words = lowered.replace('-', ' ').split()
    for section, keywords in SECTION_KEYWORDS.items():
        for keyword in keywords:
            # Sehr kurze Schlüsselwörter ("ei", "öl", "eis") nur als ganzes
            # Wort, sonst landet z. B. "Reis" wegen "ei" im Kühlregal.
            if len(keyword) <= 3:
                if keyword in words:
                    return section
            elif keyword in lowered:
                return section
    return Section.OTHER


def remember_item(household: Household, name: str, section: str) -> None:
    """Merkt sich einen Artikel für die Schnellauswahl. Die Einordnung in
    einen Ladenbereich folgt immer der letzten Entscheidung des Haushalts."""
    name = name.strip()
    now = timezone.now()
    memory = ItemMemory.objects.filter(household=household, name__iexact=name).first()
    if memory is None:
        try:
            # Savepoint: tragen zwei Personen gleichzeitig denselben neuen
            # Artikel ein, verliert eine das Rennen um die Eindeutigkeits-
            # Regel — dann zählt sie einfach den Eintrag der anderen hoch,
            # statt mit einem 500 abzubrechen.
            with db_transaction.atomic():
                ItemMemory.objects.create(
                    household=household, name=name, section=section, use_count=1, last_used_at=now
                )
            _prune_item_memories(household)
            return
        except IntegrityError:
            memory = ItemMemory.objects.filter(household=household, name__iexact=name).first()
            if memory is None:
                raise
    ItemMemory.objects.filter(pk=memory.pk).update(use_count=F('use_count') + 1, section=section, last_used_at=now)


def _prune_item_memories(household: Household) -> None:
    surplus = ItemMemory.objects.filter(household=household).count() - MAX_ITEM_MEMORIES
    if surplus > 0:
        stale = ItemMemory.objects.filter(household=household).order_by('use_count', 'last_used_at')[:surplus]
        ItemMemory.objects.filter(pk__in=list(stale.values_list('pk', flat=True))).delete()


def update_memory_section(household: Household, name: str, section: str) -> None:
    ItemMemory.objects.filter(household=household, name__iexact=name.strip()).update(section=section)


def suggestions(household: Household, shopping_list: ShoppingList, limit: int = 12) -> list[ItemMemory]:
    """Häufig gekaufte Artikel, die gerade NICHT offen auf der Liste stehen."""
    open_names = {
        name.lower() for name in shopping_list.items.filter(is_checked=False).values_list('name', flat=True)
    }
    result = []
    for memory in ItemMemory.objects.filter(household=household).order_by('-use_count', '-last_used_at')[: limit * 3]:
        if memory.name.lower() not in open_names:
            result.append(memory)
        if len(result) == limit:
            break
    return result


def price_per_item(household: Household) -> tuple[Decimal, bool]:
    """Durchschnittlicher Preis pro Artikel aus den letzten gebuchten
    Einkäufen. Zweiter Wert: ob die Zahl aus eigenen Einkäufen stammt (sonst
    Startwert).

    Der Betrag kommt aus der Buchung in Finanzen, nicht aus
    ShoppingTrip.amount: wer die Ausgabe dort korrigiert, korrigiert damit
    auch die Schätzung. Weich gelöschte Buchungen zählen nicht mehr mit
    (select_related lädt sie trotzdem, weil Django dafür den Basis-Manager
    ohne Soft-Delete-Filter nimmt — daher der explizite Filter)."""
    trips = (
        ShoppingTrip.objects.filter(
            household=household,
            item_count__gt=0,
            transaction__isnull=False,
            transaction__deleted_at__isnull=True,
        )
        .select_related('transaction')
        .order_by('-completed_at')[:ESTIMATE_TRIP_WINDOW]
    )
    totals = [(trip.transaction.amount, trip.item_count) for trip in trips]
    if not totals:
        return DEFAULT_PRICE_PER_ITEM, False
    amount = sum((a for a, _ in totals), Decimal('0'))
    count = sum(c for _, c in totals)
    return (amount / count).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP), True


def set_item_checked(item: ShoppingItem, checked: bool, user) -> ShoppingItem:
    item.is_checked = checked
    item.checked_at = timezone.now() if checked else None
    item.checked_by = user if checked else None
    item.save(update_fields=['is_checked', 'checked_at', 'checked_by'])
    return item


@db_transaction.atomic
def complete_shopping(
    household: Household, user, amount: Decimal | None, category: Category | None
) -> tuple[ShoppingTrip, list[ShoppingItem]]:
    """Schließt den Einkauf ab: alle abgehakten Einträge verlassen die Liste,
    werden als ShoppingTrip festgehalten und — wenn ein Betrag angegeben ist
    — als Ausgabe in Finanzen gebucht. Offene Einträge bleiben stehen (das
    ist, was beim nächsten Mal noch fehlt)."""
    shopping_list = active_shopping_list(household)
    checked = list(shopping_list.items.select_for_update().filter(is_checked=True))
    if not checked:
        raise ValueError('Es ist noch nichts abgehakt.')

    transaction = None
    if amount is not None:
        transaction = finanzen_services.create_transaction_from_shopping_list(
            household, user, amount, len(checked), category
        )

    trip = ShoppingTrip.objects.create(
        household=household,
        completed_by=user,
        item_count=len(checked),
        item_names=[item.name for item in checked],
        amount=amount,
        transaction=transaction,
    )
    ShoppingItem.objects.filter(pk__in=[item.pk for item in checked]).delete()
    return trip, checked


def sort_items(items):
    """Offene Einträge nach Ladenbereich (Supermarkt-Reihenfolge), dann
    alphabetisch; abgehakte ans Ende."""
    order = {section: index for index, section in enumerate(SECTION_ORDER)}
    return sorted(items, key=lambda item: (item.is_checked, order.get(item.section, 99), item.name.lower()))


# ---------------------------------------------------------------------------
# Aufgaben
# ---------------------------------------------------------------------------


def task_source_key(task: Task) -> str:
    return f'aufgabe:{task.pk}'


def sync_task_event(task: Task) -> None:
    """Hält den Kalendertermin einer Aufgabe aktuell: offene Aufgaben mit
    Fälligkeitsdatum stehen als ganztägiger Termin im gemeinsamen Kalender,
    erledigte oder undatierte nicht."""
    day = task.due_date if (task.due_date and not task.is_done) else None
    title = task.title
    if task.assigned_to_id:
        name = task.assigned_to.first_name or task.assigned_to.email
        title = f'{task.title} ({name})'
    event = upsert_all_day_event(task.household, CalendarEvent.Source.TASK, task_source_key(task), title, day)
    if task.calendar_event_id != (event.pk if event else None):
        task.calendar_event = event
        task.save(update_fields=['calendar_event'])


def remove_task_event(task: Task) -> None:
    upsert_all_day_event(task.household, CalendarEvent.Source.TASK, task_source_key(task), task.title, None)


def next_assignee(task: Task):
    """Nächste Person der Rotation nach der aktuell zuständigen. Wer den
    Haushalt verlassen hat, wird übersprungen."""
    member_ids = set(HouseholdMembership.objects.filter(household=task.household).values_list('user_id', flat=True))
    rotation = [user for user in task.rotation_members.order_by('id') if user.pk in member_ids]
    if not rotation:
        return task.assigned_to
    ids = [user.pk for user in rotation]
    if task.assigned_to_id in ids:
        return rotation[(ids.index(task.assigned_to_id) + 1) % len(rotation)]
    return rotation[0]


@db_transaction.atomic
def complete_task(task: Task, user) -> Task:
    """Aufgabe abhaken. Wiederkehrende Aufgaben rücken um ihr Intervall ab
    HEUTE weiter (nicht ab dem alten Fälligkeitsdatum — wer eine Woche zu
    spät putzt, ist nicht sofort wieder dran) und wechseln ggf. die
    zuständige Person."""
    now = timezone.now()
    TaskCompletion.objects.create(
        task=task, household=task.household, title=task.title, done_by=user, done_at=now, effort=task.effort
    )
    task.last_done_at = now
    task.last_done_by = user
    if task.recurrence_days:
        task.due_date = timezone.localdate() + timedelta(days=task.recurrence_days)
        if task.rotate:
            task.assigned_to = next_assignee(task)
    else:
        task.is_done = True
    task.save()
    sync_task_event(task)
    return task


def month_load(household: Household) -> list[dict]:
    """Lastanzeige: Aufwandspunkte und Anzahl erledigter Aufgaben pro
    Mitglied im laufenden Monat. Alle Mitglieder erscheinen, auch mit 0 —
    gerade das macht eine ungleiche Verteilung sichtbar."""
    start, end = finanzen_services.month_bounds()
    rows = (
        TaskCompletion.objects.filter(household=household, done_at__date__gte=start, done_at__date__lt=end)
        .values('done_by_id')
        .annotate(points=Sum('effort'), count=Count('id'))
    )
    by_user = {row['done_by_id']: row for row in rows}
    result = []
    for membership in HouseholdMembership.objects.filter(household=household).select_related('user').order_by('id'):
        row = by_user.get(membership.user_id, {})
        result.append(
            {
                'user_id': membership.user_id,
                'name': membership.user.first_name or membership.user.email,
                'points': row.get('points', 0) or 0,
                'count': row.get('count', 0) or 0,
            }
        )
    return result


# ---------------------------------------------------------------------------
# Haushaltsordner
# ---------------------------------------------------------------------------


def cancel_by(entry: FolderEntry) -> date | None:
    """Letzter Tag, an dem ein Vertrag noch fristgerecht gekündigt werden
    kann: Vertragsende minus Kündigungsfrist."""
    if entry.contract_end is None:
        return None
    return add_months(entry.contract_end, -(entry.notice_period_months or 0))


def folder_deadlines(entry: FolderEntry) -> list[dict]:
    """Alle Fristen eines Eintrags, jeweils mit stabilem Schlüssel für den
    Kalender und einem lesbaren Titel."""
    deadlines = []
    if entry.kind == FolderEntry.Kind.CONTRACT:
        day = cancel_by(entry)
        if day is not None:
            label = 'Kündigen bis' if entry.notice_period_months else 'Vertrag endet'
            deadlines.append({'art': 'kuendigung', 'datum': day, 'titel': f'{label}: {entry.name}'})
    else:
        if entry.warranty_until is not None:
            deadlines.append(
                {'art': 'garantie', 'datum': entry.warranty_until, 'titel': f'Garantie endet: {entry.name}'}
            )
        if entry.next_maintenance is not None:
            deadlines.append({'art': 'wartung', 'datum': entry.next_maintenance, 'titel': f'Wartung: {entry.name}'})
    return deadlines


FOLDER_DEADLINE_KINDS = ('kuendigung', 'garantie', 'wartung')


def sync_folder_events(entry: FolderEntry) -> None:
    by_kind = {deadline['art']: deadline for deadline in folder_deadlines(entry)}
    for kind in FOLDER_DEADLINE_KINDS:
        deadline = by_kind.get(kind)
        upsert_all_day_event(
            entry.household,
            CalendarEvent.Source.FOLDER,
            f'ordner:{entry.pk}:{kind}',
            deadline['titel'] if deadline else entry.name,
            deadline['datum'] if deadline else None,
            entry.created_by,
        )


def remove_folder_events(entry: FolderEntry) -> None:
    CalendarEvent.objects.filter(household=entry.household, source_key__startswith=f'ordner:{entry.pk}:').delete()


def first_maintenance(base: date, interval_months: int) -> date:
    """Erster Wartungstermin: ein Intervall nach `base` (Kaufdatum), aber nie
    in der Vergangenheit — bei einem vor Jahren gekauften Gerät der nächste
    noch anstehende Termin im Rhythmus."""
    today = timezone.localdate()
    day = add_months(base, interval_months)
    steps = 1
    while day < today:
        steps += 1
        day = add_months(base, interval_months * steps)
    return day


def complete_maintenance(entry: FolderEntry) -> FolderEntry:
    """Wartung erledigt: nächster Termin = heute + Intervall. Ohne Intervall
    entfällt der nächste Termin."""
    if entry.maintenance_interval_months:
        entry.next_maintenance = add_months(timezone.localdate(), entry.maintenance_interval_months)
    else:
        entry.next_maintenance = None
    entry.save(update_fields=['next_maintenance'])
    sync_folder_events(entry)
    return entry
