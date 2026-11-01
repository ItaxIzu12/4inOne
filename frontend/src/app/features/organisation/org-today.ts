import { Component, computed, input, output, signal } from '@angular/core';
import { AppIcon } from '../../shared/icons/app-icon';
import { LinkHints, connectionHints } from '../../shared/connections/link-hints';
import { PersonalEvent, PersonalNote, PersonalTask } from './organisation-api.service';
import { eventCategory, eventsOn, localDay, noteLines, noteTitle } from './organisation-logic';
import { DAY_END_MIN, clock, dayLine, nextUp, span, tasksForToday } from './org-day-logic';

/**
 * Organisation › Heute — „Dein Tag, Stunde für Stunde“ (31.10.2026). Kopfkarte in der Organisationsfarbe (Termine
 * und Aufgaben des Tages, was als Nächstes kommt, wie viel Zeit noch frei ist), darunter die Tageslinie: Termine in
 * Folge, dazwischen die freie Zeit (antippen = dort einen Termin eintragen). Daneben die Aufgaben für heute und die
 * angeheftete Notiz. Alles aus echten Daten — die Seite lädt die Termine des heutigen Tages.
 */
@Component({
  selector: 'app-org-today',
  standalone: true,
  imports: [AppIcon, LinkHints],
  templateUrl: './org-today.html',
  styleUrls: ['./org-common.scss', './org-today.scss'],
})
export class OrgToday {
  readonly events = input<PersonalEvent[]>([]);
  readonly tasks = input<PersonalTask[]>([]);
  readonly notes = input<PersonalNote[]>([]);
  readonly loading = input(false);
  readonly busy = input(false);

  readonly openEvent = output<PersonalEvent>();
  readonly addEvent = output<string>();
  readonly openTask = output<PersonalTask>();
  readonly toggleTask = output<PersonalTask>();
  readonly openNote = output<PersonalNote>();
  readonly showAll = output<'calendar' | 'tasks' | 'notes'>();

  /** „Jetzt“ für die Rechnungen — beim Öffnen gesetzt; neu beim nächsten Laden der Seite. */
  private readonly now = new Date();
  protected readonly today = localDay(this.now);

  /** Nur die Termine dieses Tages — beim Wechsel aus dem Kalender liegen kurz noch die des ganzen Monats vor. */
  private readonly todayEvents = computed(() => eventsOn(this.events(), this.today));
  protected readonly line = computed(() => dayLine(this.todayEvents(), this.today, this.now));
  protected readonly next = computed(() => nextUp(this.todayEvents(), this.now));
  protected readonly dueTasks = computed(() => tasksForToday(this.tasks(), this.now));
  /** Wohin Termine und Aufgaben gehören („✈ Berlin Wochenende“) — ein Abruf je Art. */
  protected readonly eventLinks = connectionHints('CALENDAR_EVENT', () => this.todayEvents().map((e) => e.id));
  protected readonly taskLinks = connectionHints('TASK', () => this.dueTasks().map((d) => d.task.id));
  protected readonly lateCount = computed(() => this.dueTasks().filter((t) => t.late).length);
  protected readonly eventCount = computed(() => this.todayEvents().length);
  protected readonly pinned = computed(() => this.notes().find((n) => n.pinned) ?? null);
  /** Der Tag ist (für freie Zeit) vorbei: nach 22:00. */
  protected readonly dayOver = computed(() => this.now.getHours() * 60 + this.now.getMinutes() >= DAY_END_MIN);
  protected readonly title = computed(() => {
    const e = this.eventCount();
    const t = this.dueTasks().length;
    if (!e && !t) return 'Heute ist nichts geplant';
    const parts = [];
    if (e) parts.push(e === 1 ? '1 Termin' : `${e} Termine`);
    if (t) parts.push(t === 1 ? '1 Aufgabe' : `${t} Aufgaben`);
    return parts.join(' · ');
  });

  /** Gerade abgehakt: Haken und Durchstreichen kurz zeigen, dann erst speichern (die Zeile verschwindet danach). */
  protected readonly justDone = signal<number | null>(null);
  protected tick(task: PersonalTask): void {
    if (this.justDone() !== null || this.busy()) return;
    this.justDone.set(task.id);
    const calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    setTimeout(() => {
      this.toggleTask.emit(task);
      this.justDone.set(null);
    }, calm ? 0 : 480);
  }

  protected readonly clock = clock;
  protected readonly span = span;
  protected readonly category = eventCategory;
  protected readonly noteTitle = noteTitle;
  protected readonly noteLines = noteLines;
  protected eventEnd(e: PersonalEvent): string {
    return e.ends_at ? clock(new Date(e.ends_at).getHours() * 60 + new Date(e.ends_at).getMinutes()) : '';
  }
}
