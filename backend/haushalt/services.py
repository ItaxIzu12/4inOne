"""Fachlogik des Haushalt-Moduls: Einkaufsliste, Einkauf-zu-Ausgabe,
wiederkehrende Aufgaben mit Rotation und der Haushaltsordner.

Views bleiben dünn und rufen nur diese Funktionen auf.

Bereichsübergreifend (ADR-001): Ein abgeschlossener Einkauf wird eine Ausgabe
in den PRIVATEN Finanzen der Person, die eingekauft hat. Aufgaben und
Ordnerfristen schreiben NICHT mehr in einen Kalender — „Heute“ und der Kalender
lesen sie direkt (connections/today.py), ohne Kopie, die auseinanderlaufen
kann."""

from datetime import date, datetime, time, timedelta
from decimal import ROUND_HALF_UP, Decimal

from django.db import IntegrityError
from django.db import transaction as db_transaction
from django.db.models import Count, F, Q, Sum
from django.utils import timezone

from core.models import Household, HouseholdMembership
from core.recurrence import add_months, next_after
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
MAX_SHOPPING_LISTS = 20
# „Demnächst“ im Haushalt: Wartung, Garantieende und Kündigungsfrist in den
# nächsten 30 Tagen — die eine Definition für Übersicht, Geräte und Verträge.
UPCOMING_DAYS = 30
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
    Section.CLOTHING: (
        'hose', 'hosen', 'jeans', 'shirt', 't-shirt', 'tshirt', 'pullover', 'pulli', 'jacke',
        'mantel', 'kleid', 'rock', 'socke', 'socken', 'unterwäsche', 'schuh', 'schuhe', 'mütze',
        'schal', 'handschuh', 'pyjama', 'anzug', 'bluse', 'strumpfhose', 'leggings',
    ),
}


# ---------------------------------------------------------------------------
# Allgemein
# ---------------------------------------------------------------------------


def membership_for(user) -> HouseholdMembership | None:
    """Die Mitgliedschaft im aktiven Haushalt der Person (zuletzt beigetreten, siehe core/households.py)."""
    from core.households import active_membership

    return active_membership(user)


def is_child_account(membership: HouseholdMembership | None) -> bool:
    return membership is not None and membership.role == HouseholdMembership.Role.CHILD_ACCOUNT


# ---------------------------------------------------------------------------
# Einkaufsliste
# ---------------------------------------------------------------------------


def active_shopping_list(household: Household) -> ShoppingList:
    """Die Standardliste (die älteste nicht archivierte) — Ziel, wenn der Client
    keine Liste nennt. Sind alle archiviert, entsteht eine neue."""
    shopping_list = ShoppingList.objects.filter(household=household, archived=False).order_by('id').first()
    if shopping_list is None:
        shopping_list = ShoppingList.objects.create(household=household, name='Wocheneinkauf')
    return shopping_list


def shopping_list_for(household: Household, list_id) -> ShoppingList | None:
    """Liste `list_id` dieses Haushalts, ohne ID die Standardliste. None, wenn
    die ID nicht zum Haushalt gehört — fremde Listen bleiben unsichtbar."""
    if list_id in (None, ''):
        return active_shopping_list(household)
    try:
        return ShoppingList.objects.filter(household=household, pk=int(list_id)).first()
    except (TypeError, ValueError):
        return None


def touch_list(shopping_list: ShoppingList) -> None:
    """„Zuletzt bearbeitet“ vorrücken — auch wenn nur ein Eintrag sich ändert."""
    ShoppingList.objects.filter(pk=shopping_list.pk).update(updated_at=timezone.now())


def list_members(household: Household, shopping_list: ShoppingList) -> list[dict]:
    """Wer die Liste sieht und bearbeitet: alle Mitglieder des Haushalts. Wer
    sie angelegt hat, ist „Eigentümer“ — bei älteren Listen ohne Ersteller
    die erste Admin-Person des Haushalts."""
    memberships = list(HouseholdMembership.objects.filter(household=household).select_related('user').order_by('id'))
    owner_id = shopping_list.created_by_id
    if owner_id is None:
        owner_id = next(
            (m.user_id for m in memberships if m.role == HouseholdMembership.Role.ADMIN),
            memberships[0].user_id if memberships else None,
        )
    return [
        {
            'user_id': m.user_id,
            'name': ' '.join(part for part in (m.user.first_name, m.user.last_name) if part) or m.user.email.split('@')[0],
            'is_owner': m.user_id == owner_id,
        }
        for m in memberships
    ]


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
    """Durchschnittlicher Preis pro Artikel aus den letzten Einkäufen mit
    Betrag. Zweiter Wert: ob die Zahl aus eigenen Einkäufen stammt (sonst
    Startwert).

    Gerechnet wird mit ShoppingTrip.amount — dem Betrag, den jemand beim
    Abschließen IM HAUSHALT angegeben hat — und bewusst nicht mit der Buchung:
    die liegt seit ADR-001 in den privaten Finanzen der Person, die eingekauft
    hat. Eine spätere Korrektur oder Löschung dort ist privat und darf die
    Schätzung der anderen Haushaltsmitglieder nicht beeinflussen."""
    trips = ShoppingTrip.objects.filter(
        household=household, item_count__gt=0, amount__isnull=False
    ).order_by('-completed_at')[:ESTIMATE_TRIP_WINDOW]
    totals = [(trip.amount, trip.item_count) for trip in trips]
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
    household: Household,
    user,
    amount: Decimal | None,
    category: Category | None,
    shopping_list: ShoppingList | None = None,
) -> tuple[ShoppingTrip, list[ShoppingItem]]:
    """Schließt den Einkauf ab: alle abgehakten Einträge verlassen die Liste,
    werden als ShoppingTrip festgehalten und — wenn ein Betrag angegeben ist
    — als Ausgabe in den privaten Finanzen der Person gebucht, die eingekauft
    hat. Offene Einträge bleiben stehen (das ist, was beim nächsten Mal noch
    fehlt)."""
    shopping_list = shopping_list or active_shopping_list(household)
    checked = list(shopping_list.items.select_for_update().filter(is_checked=True))
    if not checked:
        raise ValueError('Es ist noch nichts abgehakt.')

    transaction = None
    if amount is not None:
        category_name = None if category is not None else _dominant_category_name(checked)
        transaction = finanzen_services.book_shopping_expense(
            user, amount, [item.name for item in checked], category, category_name
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
    touch_list(shopping_list)
    return trip, checked


def _dominant_category_name(items: list[ShoppingItem]) -> str | None:
    """Wenn die Mehrheit der abgehakten Einträge Kleidung ist, soll die
    Ausgabe auch als „Kleidung" erscheinen statt immer als die
    Standard-Kategorie (finanzen_services.PRIVATE_SHOPPING_CATEGORY). Für
    alle anderen Ladenbereiche bleibt es beim Standard."""
    clothing = sum(1 for item in items if item.section == Section.CLOTHING)
    if clothing * 2 > len(items):
        return 'Kleidung'
    return None


def sort_items(items):
    """Offene Einträge nach Ladenbereich (Supermarkt-Reihenfolge), dann
    alphabetisch; abgehakte ans Ende."""
    order = {section: index for index, section in enumerate(SECTION_ORDER)}
    return sorted(items, key=lambda item: (item.is_checked, order.get(item.section, 99), item.name.lower()))


# ---------------------------------------------------------------------------
# Aufgaben
# ---------------------------------------------------------------------------


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


def next_due_date(task: Task, today: date | None = None) -> date:
    """Nächster Termin einer wiederkehrenden Aufgabe: vom BISHERIGEN
    Fälligkeitsdatum um das Intervall weiter (Di 06.10 → Di 13.10), damit der
    Wochentag bzw. Monatstag erhalten bleibt. Liegt der Termin dann noch nicht
    in der Zukunft (spät erledigt), wird im selben Rhythmus weitergerückt —
    es entstehen keine Nachhol-Datensätze."""
    today = today or timezone.localdate()
    return next_after(task.due_date or today, task.recurrence_days, task.recurrence_months, today)


@db_transaction.atomic
@db_transaction.atomic
def complete_task(task: Task, user, expected_due: date | None = None) -> Task:
    """Aufgabe abhaken. Wiederkehrende Aufgaben rücken auf ihren nächsten
    Termin (next_due_date) und wechseln ggf. die zuständige Person; einmalige
    werden erledigt.

    Idempotent gegen Doppelklick und Netzwerk-Wiederholung: die Zeile wird gesperrt, und schickt der Client den
    Termin mit, den er gerade abhakt (`expected_due`), zählt eine zweite Anfrage für denselben Termin nicht noch
    einmal — sonst würde eine Serie einen Termin überspringen und das Protokoll doppelt zählen."""
    task = Task.objects.select_for_update().get(pk=task.pk)
    if task.is_done:
        return task
    if expected_due is not None and task.due_date != expected_due:
        return task  # dieser Termin ist bereits erledigt (die Serie steht schon auf dem nächsten)
    now = timezone.now()
    TaskCompletion.objects.create(
        task=task, household=task.household, title=task.title, done_by=user, done_at=now, effort=task.effort
    )
    task.last_done_at = now
    task.last_done_by = user
    if task.recurrence_days or task.recurrence_months:
        task.due_date = next_due_date(task)
        if task.rotate:
            task.assigned_to = next_assignee(task)
    else:
        task.is_done = True
    task.save()
    return task


def remove_member_assignments(household, user) -> None:
    """Person verlässt den Haushalt (oder wird entfernt): ihre Zuständigkeiten und Rotationsplätze in diesem
    Haushalt freigeben, damit keine Aufgabe an jemanden geht, der nicht mehr Mitglied ist. Erledigungen bleiben im
    Protokoll (das ist Vergangenheit, kein Verweis auf eine aktive Rolle)."""
    tasks = Task.objects.filter(household=household)
    tasks.filter(assigned_to=user).update(assigned_to=None)
    Task.rotation_members.through.objects.filter(task__household=household, user=user).delete()


@db_transaction.atomic
def reopen_task(task: Task) -> Task:
    """Erledigte einmalige Aufgabe wieder öffnen. Die zugehörige Erledigung
    wird aus dem Protokoll genommen, damit die Lastanzeige nicht doppelt
    zählt."""
    last = task.completions.order_by('-done_at', '-id').first()
    if last is not None:
        last.delete()
    task.is_done = False
    task.last_done_at = None
    task.last_done_by = None
    task.save()
    return task


def calendar_week(day: date) -> tuple[date, date]:
    """Kalenderwoche für de-DE: Montag bis Sonntag (date.weekday(): Montag = 0) — dieselbe Regel wie im
    Frontend (shared/dates/calendar-week.ts)."""
    monday = day - timedelta(days=day.weekday())
    return monday, monday + timedelta(days=6)


def week_stats(household, user) -> dict:
    """Erledigungen dieser Woche (ab Montag) und der Vorwoche aus dem Protokoll
    (TaskCompletion — auch wiederkehrende Aufgaben zählen jedes Mal), dazu
    die offenen Aufgaben gesamt und die der Person zugewiesenen."""
    monday, _ = calendar_week(timezone.localdate())
    start = timezone.make_aware(datetime.combine(monday, time.min))
    last_start = start - timedelta(days=7)
    completions = TaskCompletion.objects.filter(household=household)
    open_tasks = Task.objects.filter(household=household, is_done=False, is_paused=False)
    return {
        'done_this_week': completions.filter(done_at__gte=start).count(),
        'done_last_week': completions.filter(done_at__gte=last_start, done_at__lt=start).count(),
        'open_total': open_tasks.count(),
        'assigned_to_me': open_tasks.filter(assigned_to=user).count(),
    }


# Wie weit die Serie höchstens zurückschaut — und damit, wie viel Protokoll
# geladen wird (drei Jahre reichen auch für monatliche Routinen).
STREAK_LOOKBACK_DAYS = 3 * 366
ROUTINE_RATE_DAYS = 28


def _period(task: Task, today: date, k: int) -> tuple[date, date]:
    """Der k-te Zeitraum vor dem aktuellen (k = 0: der laufende) im Rhythmus
    der Routine: Tage, Kalenderwochen, Kalendermonate — oder Blöcke zu N Tagen."""
    if task.recurrence_months:
        start = add_months(today.replace(day=1), -k * task.recurrence_months)
        return start, add_months(start, task.recurrence_months) - timedelta(days=1)
    if task.recurrence_days == 7:
        return calendar_week(today - timedelta(days=7 * k))
    days = task.recurrence_days or 1
    end = today - timedelta(days=k * days)
    return end - timedelta(days=days - 1), end


def routine_streak(task: Task, done_days: list[date], today: date | None = None) -> int:
    """Serie: wie viele Zeiträume in Folge die Routine erledigt wurde, vom
    laufenden aus rückwärts. Ist der laufende noch offen, bricht das die Serie
    nicht — er ist ja noch nicht vorbei."""
    if not (task.recurrence_days or task.recurrence_months):
        return 0
    today = today or timezone.localdate()
    days = sorted(set(done_days), reverse=True)
    if not days:
        return 0
    streak = 0
    for k in range(400):
        start, end = _period(task, today, k)
        if end < days[-1]:
            break
        if any(start <= day <= end for day in days):
            streak += 1
        elif k > 0:
            break
    return streak


def completion_days(task: Task) -> list[date]:
    """Erledigungstage (lokale Zeit) im Rückblick der Serie — aus dem
    vorgeladenen recent_completions (TaskViewSet), sonst per Abfrage."""
    completions = getattr(task, 'recent_completions', None)
    if completions is None:
        since = timezone.now() - timedelta(days=STREAK_LOOKBACK_DAYS)
        completions = task.completions.filter(done_at__gte=since).only('done_at') if task.pk else []
    return [timezone.localdate(c.done_at) for c in completions]


def routine_stats(household: Household) -> dict:
    """Erledigungsrate der letzten vier Wochen über alle aktiven Routinen:
    erledigt ÷ erwartet. Erwartet wird je Routine, wie oft ihr Rhythmus seit
    Beginn des Fensters (oder seit sie angelegt ist) dran war; mehr
    Erledigungen als erwartet zählen nicht doppelt."""
    today = timezone.localdate()
    window_start = today - timedelta(days=ROUTINE_RATE_DAYS - 1)
    routines = Task.objects.filter(household=household, is_done=False, is_paused=False).filter(
        Q(recurrence_days__isnull=False) | Q(recurrence_months__isnull=False)
    )
    done_total = expected_total = 0
    for task in routines:
        start = max(window_start, timezone.localdate(task.created_at))
        length = (today - start).days + 1
        if task.recurrence_months:
            expected = 1
        else:
            expected = max(1, -(-length // task.recurrence_days))
        done = task.completions.filter(done_at__date__gte=start).count()
        done_total += min(done, expected)
        expected_total += expected
    return {
        'completion_rate': round(100 * done_total / expected_total) if expected_total else None,
        'done': done_total,
        'expected': expected_total,
    }


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
                'name': membership.user.first_name or membership.user.email.split('@')[0],
                'points': row.get('points', 0) or 0,
                'count': row.get('count', 0) or 0,
            }
        )
    return result


# ---------------------------------------------------------------------------
# Haushaltsordner
# ---------------------------------------------------------------------------


def cancellation_deadline(entry: FolderEntry) -> date | None:
    """Letzter Tag, an dem ein Vertrag noch fristgerecht gekündigt werden kann:
    Vertragsende minus Kündigungsfrist in Tagen (31.12.2026 − 30 = 01.12.2026)."""
    if entry.kind != FolderEntry.Kind.CONTRACT or entry.end_date is None:
        return None
    return entry.end_date - timedelta(days=entry.notice_period_days or 0)


# Kosten pro Abrechnungszeitraum → Monatsanteil (nur zur Anzeige im Haushalt,
# nichts davon geht nach Finanzen). Einmalige Kosten haben keinen Monatsanteil.
_MONTHS_PER_CYCLE = {
    FolderEntry.BillingCycle.MONTHLY: 1,
    FolderEntry.BillingCycle.QUARTERLY: 3,
    FolderEntry.BillingCycle.YEARLY: 12,
}


def can_see_cost(entry: FolderEntry, user) -> bool:
    """Beträge im Haushaltsordner sind privat: sichtbar nur für die Person, die sie erfasst hat. Ältere Einträge
    ohne erfassende Person sieht die verwaltende Person (Admin) des Haushalts. Alle übrigen Angaben (Anbieter,
    Fristen, Kündigung) bleiben für Mitglieder sichtbar."""
    if user is None or not user.is_authenticated:
        return False
    if entry.created_by_id is not None:
        return entry.created_by_id == user.pk
    return HouseholdMembership.objects.filter(
        household_id=entry.household_id, user=user, role=HouseholdMembership.Role.ADMIN
    ).exists()


def monthly_equivalent(entry: FolderEntry) -> Decimal | None:
    months = _MONTHS_PER_CYCLE.get(entry.billing_cycle)
    if entry.kind != FolderEntry.Kind.CONTRACT or entry.cost is None or months is None:
        return None
    return (entry.cost / months).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


def contract_status(entry: FolderEntry, today: date | None = None) -> str:
    """Wirksamer Vertragsstatus. Gespeichert werden nur ACTIVE, CANCELLED und
    ENDED; EXPIRING (Kündigungsfrist in den nächsten UPCOMING_DAYS Tagen) und
    das Ende ohne automatische Verlängerung werden berechnet."""
    today = today or timezone.localdate()
    Status = FolderEntry.Status
    if entry.status == Status.ENDED:
        return Status.ENDED
    if entry.end_date is not None and entry.end_date < today and not (
        entry.auto_renewal and entry.status == Status.ACTIVE
    ):
        return Status.ENDED
    if entry.status == Status.CANCELLED:
        return Status.CANCELLED
    deadline = cancellation_deadline(entry)
    if deadline is not None and today <= deadline <= today + timedelta(days=UPCOMING_DAYS):
        return Status.EXPIRING
    return Status.ACTIVE


def folder_deadlines(entry: FolderEntry, today: date | None = None) -> list[dict]:
    """Alle anstehenden Fristen eines Eintrags, jeweils mit stabilem Schlüssel
    und lesbarem Titel. Beendete oder gekündigte Verträge und außer Betrieb
    gesetzte Geräte haben keine Fristen mehr."""
    deadlines = []
    if entry.kind == FolderEntry.Kind.CONTRACT:
        if contract_status(entry, today) in (FolderEntry.Status.CANCELLED, FolderEntry.Status.ENDED):
            return deadlines
        day = cancellation_deadline(entry)
        if day is not None:
            label = 'Kündigen bis' if entry.notice_period_days else 'Vertrag endet'
            deadlines.append({'art': 'kuendigung', 'datum': day, 'titel': f'{label}: {entry.name}'})
    else:
        if entry.status == FolderEntry.Status.RETIRED:
            return deadlines
        if entry.warranty_end_date is not None:
            deadlines.append(
                {'art': 'garantie', 'datum': entry.warranty_end_date, 'titel': f'Garantie endet: {entry.name}'}
            )
        if entry.maintenance_due_date is not None:
            deadlines.append(
                {'art': 'wartung', 'datum': entry.maintenance_due_date, 'titel': f'Wartung: {entry.name}'}
            )
    return deadlines


FOLDER_DEADLINE_KINDS = ('kuendigung', 'garantie', 'wartung')


def upcoming_deadlines(household: Household, today: date | None = None, days: int = UPCOMING_DAYS) -> list[dict]:
    """„Demnächst“: Fristen aller Geräte und Verträge des Haushalts von heute
    bis in `days` Tagen, früheste zuerst. Ohne Vertragsnummer oder Kosten —
    nur, was „Heute“ zeigt."""
    today = today or timezone.localdate()
    horizon = today + timedelta(days=days)
    result = []
    for entry in FolderEntry.objects.filter(household=household):
        for deadline in folder_deadlines(entry, today):
            if today <= deadline['datum'] <= horizon:
                result.append(
                    {
                        'entry_id': entry.pk,
                        'kind': entry.kind,
                        'art': deadline['art'],
                        'title': deadline['titel'],
                        'name': entry.name,
                        'date': deadline['datum'],
                        'days': (deadline['datum'] - today).days,
                    }
                )
    result.sort(key=lambda d: (d['date'], d['title']))
    return result


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
    today = timezone.localdate()
    entry.last_maintenance = today
    if entry.maintenance_interval_months:
        entry.maintenance_due_date = add_months(today, entry.maintenance_interval_months)
    else:
        entry.maintenance_due_date = None
    entry.save(update_fields=['maintenance_due_date', 'last_maintenance', 'updated_at'])
    return entry
