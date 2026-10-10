import { Component, computed, inject, input, output, signal } from '@angular/core';
import { AppIcon } from '../../shared/icons/app-icon';
import { BudgetCategory, Trip, TripBudgetCategory, TripExpense } from './reisen-api.service';
import { BUDGET_META, budgetRows, formatMoney, percent, totalBudget, tripValue } from './reisen-logic';
import { FxService } from '../../core/fx/fx.service';
import { HomeCurrency } from '../../core/fx/home-currency';

const RECENT = 6;

/** Reise › Budget: eigenständig, ohne Finanzen. Gesamtbudget, ausgegeben, verbleibend — in der Reisewährung, darunter
 * ungefähr in der Heimatwährung (Richtkurs); geplant gegen ausgegeben je Kategorie; die Ausgaben in Originalwährung.
 * Ohne Gesamtbudget nie „0 € Budget / 100 % verbraucht“, sondern nur „Bisher ausgegeben“. */
@Component({
  selector: 'app-trip-budget',
  imports: [AppIcon],
  templateUrl: './trip-budget.html',
  styleUrls: ['./trip-common.scss', './trip-budget.scss'],
})
export class TripBudget {
  readonly trip = input.required<Trip>();
  readonly planned = input.required<TripBudgetCategory[]>();
  readonly expenses = input.required<TripExpense[]>();
  readonly canEdit = input(true);
  /** Heimatwährung des Betrachters (Einstellungen → Profil). */
  readonly home = inject(HomeCurrency).code;
  readonly addExpense = output<void>();
  readonly editExpense = output<TripExpense>();
  readonly editPlan = output<void>();
  /** Eine Kategorie-Zeile: geplanten Betrag ändern, neu planen oder die Planung entfernen. */
  readonly editCategory = output<BudgetCategory>();

  readonly meta = BUDGET_META;
  readonly showAll = signal(false);

  readonly total = computed(() => totalBudget(this.trip(), this.planned()));
  private readonly fx = inject(FxService);
  /** In Reisewährung — jede Ausgabe mit ihrem gespeicherten Wert in Reisewährung, nie roh addiert. */
  readonly spent = computed(() => this.expenses().reduce((s, e) => s + tripValue(e, this.trip().currency), 0));
  /** Ausgaben in anderer Währung, für die beim Speichern kein Kurs verfügbar war — nicht in „Ausgegeben“ enthalten. */
  readonly unconverted = computed(() => this.expenses().filter((e) => e.amount_trip == null && e.currency && e.currency !== this.trip().currency).length);
  readonly showHome = computed(() => this.trip().currency !== this.home());
  readonly left = computed(() => this.total() - this.spent());
  readonly spentPct = computed(() => percent(this.spent(), this.total()));
  readonly rows = computed(() => budgetRows(this.planned(), this.expenses(), this.trip().currency));
  readonly blank = computed(() => !this.total() && !this.expenses().length);
  readonly sorted = computed(() => [...this.expenses()].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id));
  readonly shown = computed(() => (this.showAll() ? this.sorted() : this.sorted().slice(0, RECENT)));
  /** Vor der Reise gezahlt? Dann steht es dabei — Flüge und Hotels werden oft Monate vorher bezahlt. */
  readonly before = computed(() => this.trip().start_date);

  constructor() {
    this.fx.ensureLoaded();
  }

  money(value: number | string, compact = true): string {
    return formatMoney(value, this.trip().currency, compact);
  }
  /** „≈ 1.430 €“ zum aktuellen Richtkurs, auf ganze Einheiten gerundet (Planungswerte); leer bei gleicher Währung,
   * bei 0 oder ohne Kurs. */
  approx(value: number): string {
    if (!this.showHome() || !value) return '';
    const preview = this.fx.preview(value, this.trip().currency, this.home());
    return preview ? '≈ ' + formatMoney(Math.round(preview.value), this.home(), true) : '';
  }
  /** Ausgabe: Originalbetrag in Originalwährung. */
  original(e: TripExpense): string {
    return formatMoney(e.amount, e.currency || this.trip().currency);
  }
  /** Ausgabe: der beim Speichern festgehaltene Vergleichswert — historisch, springt nicht mit späteren Kursen. */
  homeValue(e: TripExpense): string {
    const currency = e.currency || this.trip().currency;
    if (e.amount_home != null && e.home_currency && e.home_currency !== currency) return '≈ ' + formatMoney(e.amount_home, e.home_currency);
    if (e.amount_home == null && currency !== this.home()) return 'Umrechnung unbekannt';
    return '';
  }
  readonly rateNote = computed(() => {
    const state = this.fx.state();
    if (!this.showHome()) return '';
    if (state === 'loading') return 'Kurs wird geladen …';
    if (state === 'unavailable') return 'Umrechnung in die Heimatwährung derzeit nicht verfügbar.';
    return `Umrechnung nach aktuellem Richtkurs (${state.source}, Stand ${this.shortDate(state.rateDate)}). Der tatsächliche Wechselkurs deiner Bank, Karte oder Wechselstube kann abweichen.`;
  });
  shortDate(iso: string): string {
    return new Date(`${iso}T12:00`).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  barWidth(pct: number): number {
    return Math.min(100, Math.max(0, pct));
  }
}
