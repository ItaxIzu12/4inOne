import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { AppIcon } from '../../shared/icons/app-icon';
import { Trip } from './reisen-api.service';
import type { TripTab } from './trip-overview';
import { TRANSPORT_LABELS, cancellationInfo, formatMoney, localDay, passStub, peopleLabel, placeParts, shortRange, transportIcon, tripPhase } from './reisen-logic';

/**
 * Reisen › Bordkarte („Von hier nach dort“, 31.10.2026): die eine Fläche in der Reisefarbe. Links Abreiseort → Ziel
 * groß, darunter Zeitraum, Verkehrsmittel, Personen und was noch offen ist; rechts hinter der Perforation die Tage bis
 * zur Abreise (unterwegs: der wievielte Tag). Aufgaben, Packliste und Budget stehen getrennt als Marken — kein
 * zusammengerechneter „Vorbereitet“-Wert (ein gepacktes T-Shirt wiegt nicht wie eine Buchung).
 *
 * `mode="list"`: die ganze Karte ist ein Knopf und öffnet die Reise; vorgelesen wird genau ihr sichtbarer Inhalt
 * (WCAG 2.5.3 „Label in Name“ — kein abweichendes aria-label). `mode="detail"`: die Marken führen in die Reiter.
 */
@Component({
  selector: 'app-trip-pass',
  imports: [AppIcon, NgTemplateOutlet],
  templateUrl: './trip-pass.html',
  styleUrl: './trip-pass.scss',
})
export class TripPass {
  readonly trip = input.required<Trip>();
  readonly mode = input<'list' | 'detail'>('list');
  /** Zahlen der Reise — in der Liste aus der Reise selbst, im Detail aus den geladenen Listen (aktueller). */
  readonly packed = input<number | null>(null);
  readonly packingTotal = input<number | null>(null);
  readonly tasksOpen = input<number | null>(null);
  readonly tasksTotal = input<number | null>(null);
  readonly budgetSpent = input<number | null>(null);
  readonly budgetTotal = input<number | null>(null);
  readonly open = output<number>();
  readonly openTab = output<TripTab>();

  private readonly today = localDay(new Date());
  protected readonly phase = computed(() => tripPhase(this.trip(), this.today));
  protected readonly kicker = computed(() => {
    const phase = this.phase();
    if (phase === 'ongoing') return 'Jetzt unterwegs';
    if (phase === 'past') return 'Vergangene Reise';
    if (phase === 'cancelled') return 'Abgesagt';
    return this.mode() === 'list' ? 'Als Nächstes' : 'Deine Reise';
  });
  protected readonly from = computed(() => placeParts(this.trip().departure));
  protected readonly to = computed(() => placeParts(this.trip().destination || this.trip().title));
  /** Unter dem Ziel: Unterkunft und Lage, sonst das Land/die Region aus dem Ziel. */
  protected readonly toNote = computed(() => {
    const t = this.trip();
    if (t.accommodation) return t.accommodation + (t.accommodation_area ? ' · ' + t.accommodation_area : '');
    return this.to().region;
  });
  protected readonly stub = computed(() => passStub(this.trip(), this.today));
  protected readonly icon = computed(() => transportIcon(this.trip().transport_type));
  protected readonly facts = computed(() => {
    const t = this.trip();
    const parts = t.start_date && t.end_date ? [shortRange(t)] : [];
    if (t.transport_type) parts.push(TRANSPORT_LABELS[t.transport_type]);
    parts.push(peopleLabel(t.participants?.length || 1));
    return parts;
  });

  private readonly counts = computed(() => {
    const t = this.trip();
    return {
      packed: this.packed() ?? t.packing_packed,
      packingTotal: this.packingTotal() ?? t.packing_total,
      tasksOpen: this.tasksOpen() ?? t.tasks_open,
      tasksTotal: this.tasksTotal() ?? t.tasks_total,
      spent: this.budgetSpent() ?? Number(t.budget_spent || 0),
      budget: this.budgetTotal() ?? Number(t.budget_amount || 0),
    };
  });
  /** Die Marken: offene Aufgaben, Packliste, Budget — nur, was es gibt. */
  protected readonly chips = computed(() => {
    const c = this.counts();
    const chips: { tab: TripTab | null; text: string; strong: boolean }[] = [];
    // Kostenlose Stornierung läuft in den nächsten 14 Tagen ab: zuerst, weil eine verpasste Frist Geld kostet.
    // Reine Info-Marke (kein Reiter dahinter); in den letzten 3 Tagen hervorgehoben.
    const cancel = cancellationInfo(this.trip(), this.today);
    if (cancel?.soon) chips.push({ tab: null, text: `Kostenlos stornierbar bis ${cancel.date}`, strong: cancel.days <= 3 });
    if (c.tasksTotal) chips.push({ tab: 'planung', text: c.tasksOpen ? (c.tasksOpen === 1 ? '1 Aufgabe offen' : `${c.tasksOpen} Aufgaben offen`) : 'Aufgaben erledigt', strong: false });
    if (c.packingTotal) chips.push({ tab: 'packliste', text: c.packed === c.packingTotal ? 'Alles gepackt' : `${c.packed}/${c.packingTotal} gepackt`, strong: false });
    if (c.budget) {
      const left = c.budget - c.spent;
      const money = (v: number) => formatMoney(v, this.trip().currency, true);
      chips.push({ tab: 'budget', text: left < 0 ? `${money(-left)} über Budget` : `${money(left)} übrig`, strong: left < 0 });
    }
    return chips;
  });

}
