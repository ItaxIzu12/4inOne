import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { forkJoin } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AppShell } from '../../layout/app-shell';
import { AppIcon } from '../../shared/icons/app-icon';
import { ConnectionsSection } from '../../shared/connections/connections-section';
import { Field } from '../../shared/form/field';
import { SaveFeedback } from '../../shared/save-feedback/save-feedback';
import { ModalForm } from '../../shared/form/modal-form';
import {
  PrivateFinanceApi,
  FinanceCategory,
  FinanceTransaction,
  FinanceBudget,
  SavingsGoal,
  FinanceSummary,
  financeMonth,
  budgetCovers,
  budgetRange,
  planRange,
  euros,
} from './private-finance-api.service';
type Resource = 'transactions' | 'budgets' | 'goals';
/** Die erste verständliche Fehlermeldung aus der API-Antwort (z. B. „gespart darf das Ziel nicht überschreiten“). */
function apiMessage(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  for (const value of Object.values(body as Record<string, unknown>)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (typeof first === 'string' && first.length < 200) return first;
  }
  return null;
}
function payloadAmount(payload: object): string {
  return (payload as { current_amount?: string }).current_amount ?? '0';
}
@Component({
  selector: 'app-private-finance',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, DatePipe, AppShell, AppIcon, ConnectionsSection, Field, ModalForm, SaveFeedback],
  templateUrl: './private-finance.html',
  styleUrl: './private-finance.scss',
})
export class PrivateFinance {
  private api = inject(PrivateFinanceApi);
  private fb = inject(FormBuilder);
  private destroy = inject(DestroyRef);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  readonly tab = signal('overview');
  readonly month = signal(financeMonth());
  readonly summary = signal<FinanceSummary | null>(null);
  readonly categories = signal<FinanceCategory[]>([]);
  readonly transactions = signal<FinanceTransaction[]>([]);
  readonly budgets = signal<FinanceBudget[]>([]);
  readonly goals = signal<SavingsGoal[]>([]);
  readonly loading = signal(true);
  /** Bestätigung nach Speichern/Löschen — mit dem neuen verfügbaren Betrag. */
  readonly notice = signal('');
  private pending: { text: string; month: string | null } | null = null;
  private noticeTimer?: ReturnType<typeof setTimeout>;
  readonly error = signal('');
  readonly saving = signal(false);
  readonly formError = signal('');
  readonly editor = signal<Resource | null>(null);
  readonly editId = signal<number | undefined>(undefined);
  readonly typeFilter = signal('ALL');
  readonly money = euros;
  readonly goalStatus = { ACTIVE: 'Aktiv', COMPLETED: 'Erreicht', PAUSED: 'Pausiert' };
  readonly editorTitle = computed(() => {
    const noun = { transactions: 'Buchung', budgets: 'Budget', goals: 'Sparziel' }[this.editor() ?? 'goals'];
    return `${noun} ${this.editId() ? 'bearbeiten' : 'erstellen'}`;
  });
  /** Ausgaben + Zurückgelegtes: das, was vom verfügbaren Gesamtbetrag schon „weg“ ist. */
  readonly used = computed(() => String(Number(this.summary()?.expenses ?? 0) + Number(this.summary()?.saved ?? 0)));
  readonly hasPlanned = computed(() => Number(this.summary()?.saved_planned ?? 0) > 0);
  readonly hasSaved = computed(() => Number(this.summary()?.saved ?? 0) !== 0);
  readonly rows = computed(() =>
    this.transactions().filter(
      (t) =>
        t.date.startsWith(this.month()) &&
        (this.typeFilter() === 'ALL' || t.type === this.typeFilter()),
    ),
  );
  /** Das Budget, das für den angezeigten Monat gilt: bei Überschneidung das mit dem späteren Start. */
  readonly activeBudget = computed(() =>
    this.budgets()
      .filter((b) => budgetCovers(b, this.month()))
      .sort((a, b) => b.month.localeCompare(a.month))[0],
  );
  readonly range = budgetRange;
  readonly plan = planRange;
  readonly form = this.fb.nonNullable.group({
    amount: [''],
    type: ['EXPENSE'],
    category: [''],
    date: [''],
    note: ['', Validators.maxLength(255)],
    month: [''],
    scope: ['single'],
    end_month: [''],
    rate: [''],
    plan_scope: ['open'],
    plan_start: [''],
    plan_end: [''],
    title: ['', Validators.maxLength(120)],
    target_amount: [''],
    current_amount: ['0.00'],
    target_date: [''],
    status: ['ACTIVE'],
  });
  constructor() {
    this.load();
    this.destroy.onDestroy(() => clearTimeout(this.noticeTimer));
  }
  load() {
    this.loading.set(true);
    this.error.set('');
    forkJoin({
      summary: this.api.summary(this.month()),
      categories: this.api.categories(),
      transactions: this.api.transactions(),
      budgets: this.api.budgets(),
      goals: this.api.goals(),
    })
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (r) => {
          this.summary.set(r.summary);
          this.categories.set(r.categories);
          this.transactions.set(r.transactions);
          this.budgets.set(r.budgets);
          this.goals.set(r.goals);
          this.loading.set(false);
          this.announcePending(r.summary);
          this.openGoalFromQuery();
        },
        error: () => {
          this.loading.set(false);
          this.error.set('Deine Finanzen konnten nicht geladen werden. Bitte versuche es erneut.');
        },
      });
  }
  /** Merkt sich die Meldung; sie erscheint, sobald die neuen Zahlen geladen sind. `month`: der Monat der
   * Buchung — nur wenn er angezeigt wird, ändert sich der verfügbare Betrag sichtbar. null = kein Bezug. */
  private remember(text: string, month: string | null) {
    this.pending = { text, month };
  }
  private announcePending(summary: FinanceSummary) {
    const pending = this.pending;
    if (!pending) return;
    this.pending = null;
    let text = pending.text;
    if (pending.month !== null) {
      if (pending.month !== this.month()) {
        text += ` Sie zählt zu ${pending.month.slice(5)}.${pending.month.slice(0, 4)}, nicht zum angezeigten Monat.`;
      } else if (summary.available !== null) {
        text += ` Verfügbar: ${euros(summary.available)}.`;
      }
    }
    clearTimeout(this.noticeTimer);
    this.notice.set(text);
    this.noticeTimer = setTimeout(() => this.notice.set(''), 6000);
  }
  /** Deep-Link (?goal=<id>) aus „Verknüpft“: zeigt das Sparziel und öffnet es. */
  private openGoalFromQuery() {
    const id = Number(this.route.snapshot.queryParamMap.get('goal'));
    if (!id) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { goal: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    const goal = this.goals().find((g) => g.id === id);
    if (goal) {
      this.tab.set('goals');
      this.open('goals', goal);
    }
  }
  setMonth(value: string) {
    if (!/^\d{4}-\d{2}$/.test(value)) return;
    this.month.set(value);
    this.load();
  }
  percent(current: string | null | undefined, target: string | null | undefined) {
    return target && Number(target) > 0
      ? Math.min(100, Math.max(0, Math.round((Number(current || 0) / Number(target)) * 100)))
      : target != null && Number(current || 0) > 0 ? 100 : 0;
  }
  categoryName(id: number) {
    return this.categories().find((c) => c.id === id)?.name || 'Sonstiges';
  }
  open(resource: Resource, item?: FinanceTransaction | FinanceBudget | SavingsGoal) {
    this.form.reset({
      amount: '',
      type: 'EXPENSE',
      category: String(this.categories()[0]?.id || ''),
      date: new Date().toLocaleDateString('sv-SE'),
      note: '',
      month: this.month(),
      scope: 'single',
      end_month: '',
      rate: '',
      plan_scope: 'open',
      plan_start: financeMonth(),
      plan_end: '',
      title: '',
      target_amount: '',
      current_amount: '0.00',
      target_date: '',
      status: 'ACTIVE',
    });
    this.editor.set(resource);
    this.editId.set(item?.id);
    this.formError.set('');
    if (item) {
      if ('type' in item) this.form.patchValue({ ...item, category: String(item.category) });
      else if ('month' in item)
        this.form.patchValue({
          amount: item.amount,
          month: item.month.slice(0, 7),
          scope: item.open_ended ? 'open' : item.end_month && item.end_month !== item.month ? 'until' : 'single',
          end_month: item.end_month ? item.end_month.slice(0, 7) : '',
        });
      else
        this.form.patchValue({
          ...item,
          target_date: item.target_date || '',
          rate: item.monthly_amount ?? '',
          plan_scope: item.plan_open_ended
            ? 'open'
            : item.plan_end_month && item.plan_end_month !== item.plan_month
              ? 'until'
              : 'single',
          plan_start: item.plan_month ? item.plan_month.slice(0, 7) : financeMonth(),
          plan_end: item.plan_end_month ? item.plan_end_month.slice(0, 7) : '',
        });
    }
  }
  close() {
    if (!this.saving()) this.editor.set(null);
  }
  setup() {
    if (this.saving()) return;
    this.saving.set(true);
    this.api
      .setupCategories()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (rows) => {
          this.categories.set(rows);
          this.form.controls.category.setValue(String(rows[0]?.id || ''));
          this.saving.set(false);
        },
        error: () => {
          this.saving.set(false);
          this.formError.set('Die Kategorien konnten nicht angelegt werden.');
        },
      });
  }
  amount(value: string, allowZero = false) {
    const cleaned = value.trim().replace(',', '.');
    if (!/^\d{1,8}(\.\d{1,2})?$/.test(cleaned)) return null;
    const [whole, fraction = ''] = cleaned.split('.');
    const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
    if (!allowZero && cents === 0n) return null;
    return `${BigInt(whole)}.${fraction.padEnd(2, '0')}`;
  }
  save() {
    const resource = this.editor();
    if (!resource || this.saving()) return;
    const v = this.form.getRawValue();
    let payload: object;
    const amount = this.amount(v.amount, resource === 'budgets');
    if (resource === 'transactions') {
      if (!amount || !v.date || !v.category) {
        this.formError.set('Bitte Betrag, Kategorie und Datum prüfen.');
        return;
      }
      payload = {
        amount,
        type: v.type,
        category: Number(v.category),
        date: v.date,
        note: v.note,
        currency: 'EUR',
      };
    } else if (resource === 'budgets') {
      if (amount === null || !v.month) {
        this.formError.set('Bitte Monat und Budgetbetrag prüfen.');
        return;
      }
      if (v.scope === 'until' && (!v.end_month || v.end_month < v.month)) {
        this.formError.set('Bitte wähle einen Endmonat, der nicht vor dem Startmonat liegt.');
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
      const target = this.amount(v.target_amount),
        current = this.amount(v.current_amount, true);
      if (!v.title.trim() || !target || current === null) {
        this.formError.set('Bitte Titel und Beträge des Sparziels prüfen.');
        return;
      }
      if (Number(current) > Number(target)) {
        this.formError.set(
          'Der gesparte Betrag darf das Sparziel nicht überschreiten. Erhöhe zuerst das Sparziel.',
        );
        return;
      }
      const rate = v.rate.trim() ? this.amount(v.rate) : null;
      if (v.rate.trim() && rate === null) {
        this.formError.set('Bitte gib eine Sparrate größer als 0 ein.');
        return;
      }
      if (rate !== null && Number(rate) > Number(target)) {
        this.formError.set('Die Sparrate darf nicht höher sein als das Sparziel.');
        return;
      }
      if (rate !== null && (!v.plan_start || (v.plan_scope === 'until' && (!v.plan_end || v.plan_end < v.plan_start)))) {
        this.formError.set('Bitte wähle einen Startmonat und einen Endmonat, der nicht davor liegt.');
        return;
      }
      payload = {
        title: v.title.trim(),
        target_amount: target,
        current_amount: current,
        target_date: v.target_date || null,
        status: v.status,
        currency: 'EUR',
        monthly_amount: rate,
        plan_month: rate !== null ? v.plan_start + '-01' : null,
        plan_end_month: rate !== null && v.plan_scope === 'until' ? v.plan_end + '-01' : null,
        plan_open_ended: rate !== null && v.plan_scope === 'open',
      };
    }
    if ((resource === 'transactions' && v.note.length > 255) || (resource === 'goals' && v.title.length > 120)) {
      this.formError.set('Bitte prüfe die Länge deiner Angaben.');
      return;
    }
    this.saving.set(true);
    this.formError.set('');
    this.api
      .save(resource, payload, this.editId())
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.editor.set(null);
          if (resource === 'transactions') {
            const what = v.type === 'INCOME' ? 'Einnahme' : 'Ausgabe';
            this.remember(`${what} von ${euros(amount)} gespeichert.`, v.date.slice(0, 7));
          } else if (resource === 'budgets') {
            this.remember('Budget gespeichert.', this.month());
          } else {
            // Ändert sich der gesparte Betrag, wirkt das aufs Budget des laufenden Monats.
            const previous = Number(this.goals().find((g) => g.id === this.editId())?.current_amount ?? 0);
            const changed = Number(payloadAmount(payload)) !== previous;
            const hasPlan = !!(payload as { monthly_amount?: string | null }).monthly_amount;
            this.remember(
              hasPlan
                ? 'Sparziel gespeichert. Die Sparrate wird in den gewählten Monaten von deinem verfügbaren Budget zurückgelegt.'
                : changed
                  ? 'Sparziel gespeichert. Das Gesparte mindert dein verfügbares Budget.'
                  : 'Sparziel gespeichert.',
              changed || hasPlan ? this.month() : null,
            );
          }
          this.load();
        },
        error: (e) => {
          this.saving.set(false);
          this.formError.set(
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
    const resource = this.editor(),
      id = this.editId();
    if (!resource || !id || this.saving()) return;
    this.saving.set(true);
    this.api
      .delete(resource, id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.editor.set(null);
          const noun = { transactions: 'Buchung', budgets: 'Monatsbudget', goals: 'Sparziel' }[resource];
          this.remember(`${noun} gelöscht.`, resource === 'goals' ? null : this.month());
          this.load();
        },
        error: () => {
          this.saving.set(false);
          this.formError.set('Löschen fehlgeschlagen. Bitte versuche es erneut.');
        },
      });
  }
}
