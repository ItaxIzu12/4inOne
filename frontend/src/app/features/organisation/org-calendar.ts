import { Component, computed, input, model, output, signal } from '@angular/core';
import { AppIcon } from '../../shared/icons/app-icon';
import { EventCategory, PersonalEvent } from './organisation-api.service';
import {
  EVENT_CATEGORIES,
  dayWord,
  eventCategory,
  eventsOn,
  localDay,
  longDay,
  monthGrid,
  relativeStart,
  timeRange,
  startTime,
  upcomingEvents,
  weekOf,
  weekdayDay,
} from './organisation-logic';

type View = 'month' | 'week' | 'day';

/**
 * Kalender nach Entwurf: Monat/Woche/Tag, Filter nach Kategorie, rechts der
 * gewählte Tag mit Terminkarten, darunter „Demnächst“. Neue und geänderte
 * Termine öffnet die Hülle (organisation.ts) im gemeinsamen Formular.
 */
@Component({
  selector: 'app-org-calendar',
  standalone: true,
  imports: [AppIcon],
  templateUrl: './org-calendar.html',
  styleUrls: ['./org-common.scss', './org-calendar.scss'],
})
export class OrgCalendar {
  readonly events = input<PersonalEvent[]>([]);
  readonly selectedDay = model(localDay(new Date()));
  readonly openEvent = output<PersonalEvent>();
  readonly newEvent = output<string>();

  protected readonly view = signal<View>('month');
  protected readonly views: { key: View; label: string }[] = [
    { key: 'month', label: 'Monat' },
    { key: 'week', label: 'Woche' },
    { key: 'day', label: 'Tag' },
  ];
  protected readonly categories = EVENT_CATEGORIES;
  /** Ausgeblendete Kategorien; leer = alle sichtbar. */
  protected readonly hidden = signal<ReadonlySet<EventCategory>>(new Set());
  protected readonly month = signal(this.firstOf(this.selectedDay()));
  protected readonly weekdays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

  protected readonly visible = computed(() => this.events().filter((e) => !this.hidden().has(e.category ?? 'sonstiges')));
  protected readonly grid = computed(() => monthGrid(this.month(), this.visible()));
  protected readonly week = computed(() => weekOf(this.selectedDay()).map((day) => ({ day, events: eventsOn(this.visible(), day) })));
  protected readonly dayEvents = computed(() => eventsOn(this.visible(), this.selectedDay()));
  protected readonly upcoming = computed(() => upcomingEvents(this.visible(), new Date(), 6));
  protected readonly title = computed(() => {
    if (this.view() === 'month') return this.month().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
    if (this.view() === 'week') {
      const days = weekOf(this.selectedDay());
      return `${weekdayDay(days[0])} – ${weekdayDay(days[6])}`;
    }
    return longDay(this.selectedDay());
  });
  protected readonly dayInfo = computed(() => {
    const list = this.dayEvents();
    const count = list.length === 1 ? '1 Termin' : `${list.length} Termine`;
    const next = list.find((e) => new Date(e.ends_at ?? e.starts_at) >= new Date());
    return next && this.selectedDay() === localDay(new Date()) ? `${count} · ${relativeStart(next)}` : count;
  });

  protected readonly timeRange = timeRange;
  protected readonly startTime = startTime;
  protected readonly category = eventCategory;
  protected readonly longDay = longDay;
  protected readonly dayWord = dayWord;
  protected readonly relativeStart = relativeStart;
  protected readonly todayKey = localDay(new Date());

  private firstOf(day: string): Date {
    const d = new Date(`${day}T12:00`);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }

  protected select(day: string): void {
    this.selectedDay.set(day);
    const d = new Date(`${day}T12:00`);
    if (d.getMonth() !== this.month().getMonth() || d.getFullYear() !== this.month().getFullYear()) this.month.set(this.firstOf(day));
  }

  /** Pfeile: Monat, Woche oder Tag weiter — je nach Ansicht. */
  protected step(delta: number): void {
    if (this.view() === 'month') {
      const m = this.month();
      const next = new Date(m.getFullYear(), m.getMonth() + delta, 1);
      this.month.set(next);
      this.selectedDay.set(localDay(next));
      return;
    }
    const d = new Date(`${this.selectedDay()}T12:00`);
    d.setDate(d.getDate() + delta * (this.view() === 'week' ? 7 : 1));
    this.select(localDay(d));
  }

  protected stepDay(delta: number): void {
    const d = new Date(`${this.selectedDay()}T12:00`);
    d.setDate(d.getDate() + delta);
    this.select(localDay(d));
  }

  protected goToday(): void {
    this.select(localDay(new Date()));
  }

  protected toggleCategory(value: EventCategory): void {
    this.hidden.update((set) => {
      const next = new Set(set);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  protected showAll(): void {
    this.hidden.set(new Set());
  }

  protected eventDay(e: PersonalEvent): string {
    return localDay(new Date(e.starts_at));
  }
}
