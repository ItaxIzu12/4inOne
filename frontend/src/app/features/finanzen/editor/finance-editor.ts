import { Component, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { savingsReminder } from '../../../shared/connections/auto-link-rules';
import { AutoLinks } from '../../../shared/connections/auto-links';
import { ConnectionsSection } from '../../../shared/connections/connections-section';
import { AmountInput } from '../../../shared/directives/amount-input';
import { AppDatePicker } from '../../../shared/form/date-picker';
import { display } from '../../../shared/form/date-utils';
import { Field } from '../../../shared/form/field';
import { ModalForm } from '../../../shared/form/modal-form';
import { AppSelect, SelectOption } from '../../../shared/form/select';
import { AppIcon } from '../../../shared/icons/app-icon';
import { SubmissionKey } from '../../../shared/idempotency';
import { GoalPreview, MAX_CATEGORY_NAME, SavingsGoal, budgetOverride, euros, goalCovers, planRange } from '../data/private-finance-api.service';
import { fixedKey } from '../shared/finance-tabs';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { map, of, switchMap } from 'rxjs';
import { FINANCE_CONTEXT, Resource } from '../finance-context';

/** Die erste verständliche Fehlermeldung aus der API-Antwort (z. B. „gespart darf das Ziel nicht überschreiten“). */
function apiMessage(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  for (const value of Object.values(body as Record<string, unknown>)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (typeof first === 'string' && first.length < 200) return first;
  }
  return null;
}
/** Die Sätze der Warnung vor dem Speichern eines Sparziels; leer = alles in Ordnung. */
function goalWarningSentences(preview: GoalPreview): string[] {
  const sentences: string[] = [];
  if (preview.month_over)
    sentences.push(
      `${preview.month_over.month === new Date().toLocaleDateString('sv-SE').slice(0, 7) ? 'In diesem Monat' : `Im ${preview.month_over.month.slice(5)}.${preview.month_over.month.slice(0, 4)}`} reicht das Monatsbudget nach Ausgaben dafür nicht: Es fehlen ${euros(preview.month_over.over)}.`,
    );
  const alert = preview.plan_alert;
  if (alert && !(preview.month_over && alert.month === preview.month_over.month)) {
    sentences.push(
      `Im ${alert.month.slice(5)}.${alert.month.slice(0, 4)} reicht das Monatsbudget nach Ausgaben nicht für alle Sparraten: Es fehlen ${euros(alert.over)}.`,
    );
  }
  return sentences;
}
function payloadAmount(payload: object): string {
  return (payload as { current_amount?: string }).current_amount ?? '0';
}

/** Finanzen › Dialog „Transaktion / Budget / Sparziel“: Formular, Warnungen (Budget überschritten, Sparplanung), neue Kategorie, Verbindungen, Speichern und Löschen.
 * Formular und Zustand (welcher Eintrag, Warnungen) gehören PrivateFinance und kommen über FINANCE_CONTEXT;
 * PrivateFinance öffnet den Dialog mit open(). Verhalten unverändert. */
@Component({
  selector: 'app-finance-editor',
  standalone: true,
  imports: [AmountInput, AppDatePicker, AppIcon, AppSelect, AutoLinks, ConnectionsSection, DatePipe, Field, ModalForm, ReactiveFormsModule],
  templateUrl: './finance-editor.html',
  // Reihenfolge wie im Rahmen: Diagramme, Bausteine, späte Bausteine, eigene Regeln
  styleUrls: ['../shared/finance-charts.scss', '../shared/finance-blocks.scss', '../shared/finance-blocks-late.scss', './finance-editor.scss'],
})
export class FinanceEditor {
  protected readonly ctx = inject(FINANCE_CONTEXT);
  /** Verbindungs-Baustein im Dialog (Sparziel → Kalender); PrivateFinance.open() setzt ihn über resetLinks() zurück. */
  resetLinks() {
    this.autoLinkBox()?.reset();
  }
  // Gemeinsame Werte und Aktionen unter ihrem gewohnten Namen (Template unverändert)
  protected readonly todayDay = this.ctx.todayDay;
  protected readonly month = this.ctx.month;
  protected readonly categories = this.ctx.categories;
  protected readonly transactions = this.ctx.transactions;
  protected readonly budgets = this.ctx.budgets;
  protected readonly goals = this.ctx.goals;
  protected readonly goalWarning = this.ctx.goalWarning;
  protected readonly overrun = this.ctx.overrun;
  protected readonly error = this.ctx.error;
  protected readonly formError = this.ctx.formError;
  protected readonly editor = this.ctx.editor;
  protected readonly editId = this.ctx.editId;
  protected readonly money = this.ctx.money;
  protected readonly plannedSource = this.ctx.plannedSource;
  protected readonly quickCategory = this.ctx.quickCategory;
  protected readonly quickCategoryError = this.ctx.quickCategoryError;
  protected readonly cancelQuickCategory = this.ctx.cancelQuickCategory.bind(this.ctx);
  protected readonly categoryChips = this.ctx.categoryChips;
  protected readonly monthLabel = this.ctx.monthLabel;
  protected readonly span = this.ctx.span;
  protected readonly form = this.ctx.form;
  protected readonly open = this.ctx.open.bind(this.ctx);
  protected readonly amount = this.ctx.amount.bind(this.ctx);

  readonly saving = signal(false);
  /** Connection Engine V2: Zieldatum/Endmonat im Kalender (CON-10) — Vorschau aus den Formularwerten. */
  private readonly autoLinkBox = viewChild(AutoLinks);
  readonly goalAutoPreview = computed(() => {
    const v = this.ctx.goalFormValue();
    return { SAVINGS_REMINDER: savingsReminder(v.title.trim(), v.target, v.scope === 'until' && v.end ? v.end : null) };
  });
  readonly editorTitle = computed(() => {
    const noun = { transactions: 'Transaktion', budgets: 'Budget', goals: 'Sparziel' }[this.ctx.editor() ?? 'goals'];
    return `${noun} ${this.ctx.editId() ? 'bearbeiten' : 'erstellen'}`;
  });
  readonly maxCategoryName = MAX_CATEGORY_NAME;
  startQuickCategory() {
    this.ctx.quickCategory.set('');
    this.ctx.quickCategoryError.set('');
    afterNextRender(() => document.getElementById('quick-category')?.focus(), { injector: this.ctx.renderInjector });
  }
  createQuickCategory() {
    const name = (this.ctx.quickCategory() ?? '').trim().replace(/\s+/g, ' ');
    if (this.saving()) return;
    if (!name) {
      this.ctx.quickCategoryError.set('Gib der Kategorie einen Namen.');
      return;
    }
    const existing = this.ctx.categories().find((c) => c.name.toLocaleLowerCase('de') === name.toLocaleLowerCase('de'));
    if (existing) {
      // Gibt es schon: einfach auswählen statt einen Fehler zu zeigen.
      this.ctx.form.controls.category.setValue(String(existing.id));
      this.ctx.cancelQuickCategory();
      return;
    }
    this.saving.set(true);
    this.ctx.api
      .createCategory({ name, monthly_goal: null })
      .pipe(takeUntilDestroyed(this.ctx.destroy))
      .subscribe({
        next: (created) => {
          this.saving.set(false);
          this.ctx.categories.update((all) => [...all, created].sort((a, b) => a.name.localeCompare(b.name, 'de')));
          this.ctx.form.controls.category.setValue(String(created.id));
          this.ctx.cancelQuickCategory();
          afterNextRender(() => document.getElementById('booking-new-category')?.focus(), { injector: this.ctx.renderInjector });
        },
        error: (e) => {
          this.saving.set(false);
          this.ctx.quickCategoryError.set(
            (e?.status === 400 && apiMessage(e.error)) || 'Die Kategorie konnte nicht angelegt werden. Bitte versuche es erneut.',
          );
        },
      });
  }
  // Auswahllisten der Dropdowns; die Kategorien tragen ihre feste Farbe als Punkt.
  readonly typeOptions: SelectOption[] = [
    { value: 'EXPENSE', label: 'Ausgabe' },
    { value: 'INCOME', label: 'Einnahme' },
  ];
  readonly scopeOptions: SelectOption[] = [
    { value: 'single', label: 'Nur diesen Monat' },
    { value: 'until', label: 'Mehrere Monate' },
    { value: 'open', label: 'Bis auf Weiteres' },
  ];
  readonly statusOptions: SelectOption[] = [
    { value: 'ACTIVE', label: 'Aktiv' },
    { value: 'COMPLETED', label: 'Erreicht' },
    { value: 'PAUSED', label: 'Pausiert' },
  ];
  protected readonly Number = Number;
  /** Only records in the selected month belong in this contextual deletion note. */
  readonly budgetImpact = computed(() => {
    if (this.ctx.editor() !== 'budgets' || !this.ctx.editId()) return null;
    return {
      transactions: this.ctx.transactions().filter(row => row.date.startsWith(this.ctx.month())).length,
      goals: this.ctx.goals().filter(goal => goalCovers(goal, this.ctx.month())).length,
    };
  });
  budgetImpactNote(): string | null {
    const impact = this.budgetImpact();
    if (!impact || (!impact.transactions && !impact.goals)) return null;
    const parts = [
      impact.transactions ? `${impact.transactions} ${impact.transactions === 1 ? 'Transaktion' : 'Transaktionen'}` : '',
      impact.goals ? `${impact.goals} ${impact.goals === 1 ? 'Sparziel' : 'Sparziele'}` : '',
    ].filter(Boolean);
    return `Im ${this.ctx.monthLabel()} sind ${parts.join(' und ')} vorhanden. Beim Löschen dieses Budgets bleiben diese Einträge erhalten.`;
  }
  /** Hinweis im Budget-Dialog, wenn ein anderes, später beginnendes Budget einen Teil des Zeitraums übernimmt. */
  budgetOverrideNote(): string | null {
    const v = this.ctx.form.getRawValue();
    if (this.ctx.editor() !== 'budgets' || !v.month) return null;
    const others = this.ctx.budgets().filter((b) => b.id !== this.ctx.editId());
    const found = budgetOverride({ start: v.month, end: v.scope === 'until' ? v.end_month : '', open: v.scope === 'open' }, others);
    if (!found) return null;
    const from = display(found.from, 'month');
    const when = found.to === null ? `Ab ${from}` : found.to === found.from ? `Im ${from}` : `Von ${from} bis ${display(found.to, 'month')}`;
    return `${when} gilt bereits ein anderes Budget und hat dort Vorrang. Dieses Budget zählt in diesem Zeitraum nicht.`;
  }
  close() {
    if (!this.saving()) this.ctx.editor.set(null);
  }
  setup() {
    if (this.saving()) return;
    this.saving.set(true);
    this.ctx.api
      .setupCategories()
      .pipe(takeUntilDestroyed(this.ctx.destroy))
      .subscribe({
        next: (rows) => {
          this.ctx.categories.set(rows);
          this.ctx.form.controls.category.setValue(String(rows[0]?.id || ''));
          this.saving.set(false);
        },
        error: () => {
          this.saving.set(false);
          this.ctx.formError.set('Die Kategorien konnten nicht angelegt werden.');
        },
      });
  }
  save() {
    const resource = this.ctx.editor();
    if (!resource || this.saving()) return;
    const v = this.ctx.form.getRawValue();
    let payload: object;
    const amount = this.ctx.amount(v.amount, resource === 'budgets');
    if (resource === 'transactions') {
      if (!amount || !v.date || !v.category) {
        this.ctx.formError.set('Bitte Betrag, Kategorie und Datum prüfen.');
        return;
      }
      payload = {
        amount,
        type: v.type,
        category: Number(v.category),
        date: v.date,
        note: v.note,
        currency: 'EUR',
        recurring: v.recurring,
      };
    } else if (resource === 'budgets') {
      if (amount === null || !v.month) {
        this.ctx.formError.set('Bitte Monat und Budgetbetrag prüfen.');
        return;
      }
      if (v.scope === 'until' && (!v.end_month || v.end_month < v.month)) {
        this.ctx.formError.set('Bitte wähle einen Endmonat, der nicht vor dem Startmonat liegt.');
        return;
      }
      payload = {
        month: v.month + '-01',
        amount,
        currency: 'EUR',
        open_ended: v.scope === 'open',
        end_month: v.scope === 'until' ? v.end_month + '-01' : null,
      };
    } else {
      const target = this.ctx.amount(v.target_amount),
        current = this.ctx.amount(v.current_amount, true);
      if (!v.title.trim() || !target || current === null) {
        this.ctx.formError.set('Bitte Titel und Beträge des Sparziels prüfen.');
        return;
      }
      if (Number(current) > Number(target)) {
        this.ctx.formError.set(
          'Der gesparte Betrag darf das Sparziel nicht überschreiten. Erhöhe zuerst das Sparziel.',
        );
        return;
      }
      const rate = v.rate.trim() ? this.ctx.amount(v.rate) : null;
      if (v.rate.trim() && rate === null) {
        this.ctx.formError.set('Bitte gib eine Sparrate größer als 0 ein.');
        return;
      }
      if (rate !== null && Number(rate) > Number(target)) {
        this.ctx.formError.set('Die Sparrate darf nicht höher sein als das Sparziel.');
        return;
      }
      if (!v.plan_start || (v.plan_scope === 'until' && (!v.plan_end || v.plan_end < v.plan_start))) {
        this.ctx.formError.set('Bitte wähle einen Startmonat und einen Endmonat, der nicht davor liegt.');
        return;
      }
      payload = {
        title: v.title.trim(),
        target_amount: target,
        current_amount: current,
        status: v.status,
        currency: 'EUR',
        monthly_amount: rate,
        // Der Zeitraum gehört zum Ziel (wann es gilt und angezeigt wird) — unabhängig von einer Sparrate.
        plan_month: v.plan_start + '-01',
        plan_end_month: v.plan_scope === 'until' ? v.plan_end + '-01' : null,
        plan_open_ended: v.plan_scope === 'open',
      };
    }
    if ((resource === 'transactions' && v.note.length > 255) || (resource === 'goals' && v.title.length > 120)) {
      this.ctx.formError.set('Bitte prüfe die Länge deiner Angaben.');
      return;
    }
    // Only the current validation result may accompany the budget preview.
    // Clear an earlier failed attempt once every field has passed validation.
    this.ctx.formError.set('');
    if (resource === 'transactions' && v.type === 'EXPENSE' && !this.ctx.overrun()) {
      this.checkOverrun(v.date.slice(0, 7), Number(amount), () => this.persist(resource, payload, v, amount));
      return;
    }
    if (resource === 'goals' && !this.ctx.goalWarning()) {
      this.checkGoal(payload, () => this.persist(resource, payload, v, amount));
      return;
    }
    this.persist(resource, payload, v, amount);
  }
  /** Fragt VOR dem Speichern, ob das Sparziel (Gespartes oder Sparrate) das Budget sprengt; gespeichert wird erst nach Bestätigung. */
  private checkGoal(payload: object, proceed: () => void) {
    this.saving.set(true);
    this.ctx.api
      .previewGoal(payload, this.ctx.editId())
      .pipe(takeUntilDestroyed(this.ctx.destroy))
      .subscribe({
        next: (preview) => {
          this.saving.set(false);
          const sentences = goalWarningSentences(preview);
          if (sentences.length) this.ctx.goalWarning.set(sentences);
          else proceed();
        },
        error: (e) => {
          this.saving.set(false);
          // Ungültige Angaben meldet die Vorschau wie das Speichern; jede andere Störung hält das Speichern nicht auf.
          if (e.status === 400) this.ctx.formError.set(apiMessage(e.error) ?? 'Bitte prüfe deine Angaben.');
          else proceed();
        },
      });
  }
  /** Warnt vor dem Speichern, wenn die Ausgabe das verfügbare Budget ihres Monats überschreiten würde.
   * Sie wird nicht verboten (das Geld ist ja ausgegeben), aber erst nach Bestätigung gebucht. */
  private checkOverrun(month: string, amount: number, proceed: () => void) {
    const editing = this.ctx.transactions().find((t) => t.id === this.ctx.editId());
    // Beim Ändern zählt nur der Mehrbetrag gegenüber der alten Ausgabe im selben Monat.
    const previous = editing && editing.type === 'EXPENSE' && editing.date.startsWith(month) ? Number(editing.amount) : 0;
    const extra = amount - previous;
    if (extra <= 0) return proceed();
    this.saving.set(true);
    const summary$ = month === this.ctx.month() && this.ctx.summary() ? of(this.ctx.summary()!) : this.ctx.api.summary(month);
    summary$.pipe(takeUntilDestroyed(this.ctx.destroy)).subscribe({
      next: (summary) => {
        this.saving.set(false);
        // Ist die Ausgabe ein vorgemerkter fester Posten, ersetzt sie die Vormerkung — der Betrag ist schon abgezogen.
        const v = this.ctx.form.getRawValue();
        const reserved = summary.planned_items?.find((i) => i.kind === 'RECURRING' && i.key === fixedKey(v.note, v.category));
        const effective = extra - (reserved && v.type === 'EXPENSE' ? Number(reserved.amount) : 0);
        if (effective <= 0) return proceed();
        const after = summary.available === null ? null : Number(summary.available) - effective;
        if (summary.available !== null && after !== null && after < 0) {
          this.ctx.overrun.set({ available: summary.available, over: (-after).toFixed(2) });
          return;
        }
        proceed();
      },
      // Die Prüfung ist eine Hilfe, keine Bedingung: schlägt sie fehl, wird normal gebucht.
      error: () => {
        this.saving.set(false);
        proceed();
      },
    });
  }
  /** Dieselbe Absendung (z. B. nach Verbindungsfehler erneut) legt serverseitig nichts doppelt an. */
  private readonly submission = new SubmissionKey();
  private persist(resource: Resource, payload: object, v: ReturnType<typeof this.ctx.form.getRawValue>, amount: string | null) {
    this.saving.set(true);
    this.ctx.formError.set('');
    const creating = !this.ctx.editId();
    this.ctx.api
      .save(resource, payload, this.ctx.editId(), creating ? this.submission.for({ resource, payload }) : undefined)
      .pipe(
        // Sparziel: Verbindungen erst nach dem Speichern (ein neues Ziel braucht zuerst seine ID)
        switchMap((saved) => {
          const links = resource === 'goals' ? this.autoLinkBox() : undefined;
          const id = (saved as { id?: number } | null)?.id;
          return links && id ? links.commit(id).pipe(map(() => saved)) : of(saved);
        }),
        takeUntilDestroyed(this.ctx.destroy),
      )
      .subscribe({
        next: () => {
          this.saving.set(false);
          if (creating) this.submission.reset();
          this.ctx.editor.set(null);
          if (resource === 'transactions') {
            const what = v.type === 'INCOME' ? 'Einnahme' : 'Ausgabe';
            // Liegt das Datum außerhalb des angezeigten Monats, taucht die Buchung hier nicht auf — das sagen wir dazu.
            const elsewhere =
              v.date.slice(0, 7) === this.ctx.month() ? '' : ` Sie liegt im ${display(v.date.slice(0, 7), 'month')} und steht deshalb nicht in der aktuellen Liste.`;
            this.ctx.remember(`${what} von ${euros(amount)} gespeichert.${elsewhere}`, v.date.slice(0, 7));
          } else if (resource === 'budgets') {
            this.ctx.remember('Budget gespeichert.', this.ctx.month());
          } else {
            // Sparbeträge werden separat geplant; das Monatsbudget bleibt gleich.
            const previous = Number(this.ctx.goals().find((g) => g.id === this.ctx.editId())?.current_amount ?? 0);
            const changed = Number(payloadAmount(payload)) !== previous;
            const hasPlan = !!(payload as { monthly_amount?: string | null }).monthly_amount;
            const period = payload as { plan_month: string; plan_end_month: string | null; plan_open_ended: boolean };
            const shown = goalCovers(period, this.ctx.month());
            this.ctx.remember(
              (hasPlan
                ? 'Sparziel gespeichert. Die Sparrate wird in den gewählten Monaten im Restbudget berücksichtigt.'
                : changed
                  ? 'Sparziel gespeichert. Das bereits Gesparte wird im Zeitraum des Sparziels vom Restbudget abgezogen.'
                  : 'Sparziel gespeichert.') +
                (shown
                  ? ''
                  : ` Es gilt nicht im angezeigten Monat und erscheint erst im Zeitraum: ${planRange({ ...(period as object), monthly_amount: null } as SavingsGoal)}.`),
              changed || hasPlan ? this.ctx.month() : null,
            );
          }
          this.ctx.load();
        },
        error: (e) => {
          this.saving.set(false);
          this.ctx.formError.set(
            e.status === 400
              ? (apiMessage(e.error) ??
                  (resource === 'budgets'
                    ? 'Bitte prüfe deine Angaben. Pro Startmonat ist ein Budget möglich.'
                    : 'Bitte prüfe deine Angaben.'))
              : 'Speichern fehlgeschlagen. Bitte versuche es erneut.',
          );
        },
      });
  }
  remove() {
    const resource = this.ctx.editor(),
      id = this.ctx.editId();
    if (!resource || !id || this.saving()) return;
    this.saving.set(true);
    this.ctx.api
      .delete(resource, id)
      .pipe(takeUntilDestroyed(this.ctx.destroy))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.ctx.editor.set(null);
          const noun = { transactions: 'Transaktion', budgets: 'Monatsbudget', goals: 'Sparziel' }[resource];
          this.ctx.remember(`${noun} gelöscht.`, resource === 'goals' ? null : this.ctx.month());
          this.ctx.load();
        },
        error: () => {
          this.saving.set(false);
          this.ctx.formError.set('Löschen fehlgeschlagen. Bitte versuche es erneut.');
        },
      });
  }
}
