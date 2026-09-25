import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { forkJoin } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AppShell } from '../../layout/app-shell';
import { AppIcon } from '../../shared/icons/app-icon';
import { Field } from '../../shared/form/field';
import { ModalForm } from '../../shared/form/modal-form';
import {
  PrivateFinanceApi,
  FinanceCategory,
  FinanceTransaction,
  FinanceBudget,
  SavingsGoal,
  FinanceSummary,
  financeMonth,
  euros,
} from './private-finance-api.service';
type Resource = 'transactions' | 'budgets' | 'goals';
@Component({
  selector: 'app-private-finance',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, DatePipe, AppShell, AppIcon, Field, ModalForm],
  templateUrl: './private-finance.html',
  styleUrl: './private-finance.scss',
})
export class PrivateFinance {
  private api = inject(PrivateFinanceApi);
  private fb = inject(FormBuilder);
  private destroy = inject(DestroyRef);
  readonly tab = signal('overview');
  readonly month = signal(financeMonth());
  readonly summary = signal<FinanceSummary | null>(null);
  readonly categories = signal<FinanceCategory[]>([]);
  readonly transactions = signal<FinanceTransaction[]>([]);
  readonly budgets = signal<FinanceBudget[]>([]);
  readonly goals = signal<SavingsGoal[]>([]);
  readonly loading = signal(true);
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
  readonly rows = computed(() =>
    this.transactions().filter(
      (t) =>
        t.date.startsWith(this.month()) &&
        (this.typeFilter() === 'ALL' || t.type === this.typeFilter()),
    ),
  );
  readonly activeBudget = computed(() =>
    this.budgets().find((b) => b.month.startsWith(this.month())),
  );
  readonly form = this.fb.nonNullable.group({
    amount: [''],
    type: ['EXPENSE'],
    category: [''],
    date: [''],
    note: ['', Validators.maxLength(255)],
    month: [''],
    title: ['', Validators.maxLength(120)],
    target_amount: [''],
    current_amount: ['0.00'],
    target_date: [''],
    status: ['ACTIVE'],
  });
  constructor() {
    this.load();
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
        },
        error: () => {
          this.loading.set(false);
          this.error.set('Deine Finanzen konnten nicht geladen werden. Bitte versuche es erneut.');
        },
      });
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
        this.form.patchValue({ amount: item.amount, month: item.month.slice(0, 7) });
      else this.form.patchValue({ ...item, target_date: item.target_date || '' });
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
      payload = { month: v.month + '-01', amount, currency: 'EUR' };
    } else {
      const target = this.amount(v.target_amount),
        current = this.amount(v.current_amount, true);
      if (!v.title.trim() || !target || current === null) {
        this.formError.set('Bitte Titel und Beträge des Sparziels prüfen.');
        return;
      }
      payload = {
        title: v.title.trim(),
        target_amount: target,
        current_amount: current,
        target_date: v.target_date || null,
        status: v.status,
        currency: 'EUR',
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
          this.load();
        },
        error: (e) => {
          this.saving.set(false);
          this.formError.set(
            e.status === 400
              ? 'Bitte prüfe deine Angaben. Pro Monat ist ein Budget möglich.'
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
          this.load();
        },
        error: () => {
          this.saving.set(false);
          this.formError.set('Löschen fehlgeschlagen. Bitte versuche es erneut.');
        },
      });
  }
}
