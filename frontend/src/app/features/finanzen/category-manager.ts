import { Component, DestroyRef, ElementRef, Injector, afterNextRender, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, concat, defaultIfEmpty, last, tap } from 'rxjs';
import { ModalForm } from '../../shared/form/modal-form';
import { AppIcon } from '../../shared/icons/app-icon';
import {
  FALLBACK_CATEGORY,
  FinanceCategory,
  FinanceTransaction,
  MAX_CATEGORY_NAME,
  PrivateFinanceApi,
} from './private-finance-api.service';
import { normalizeMoneyInput } from '../../shared/currency/money-input';

/** Eine Zeile im Entwurf: bestehende Kategorie (id) oder neu angelegte (id null). */
export interface CategoryDraft {
  key: string;
  id: number | null;
  original: string;
  name: string;
  limit: string;
  color: string;
  remove: boolean;
}

/** „400“, „400,5“, „400.50“ oder „1.200“ → „400.50“ bzw. „1200.00“; leer → null; ungültig → undefined. */
export function parseLimit(raw: string): string | null | undefined {
  if (!raw.trim()) return null;
  const cleaned = normalizeMoneyInput(raw) ?? 'x';
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(cleaned)) return undefined;
  const [whole, fraction = ''] = cleaned.split('.');
  return `${BigInt(whole)}.${fraction.padEnd(2, '0')}`;
}

/** Erste Unstimmigkeit im Entwurf als verständlicher Satz — oder null, wenn alles passt. */
export function draftProblem(rows: CategoryDraft[]): string | null {
  const seen = new Set<string>();
  for (const row of rows.filter((r) => !r.remove)) {
    const name = row.name.trim().replace(/\s+/g, ' ');
    if (!name) return 'Gib jeder Kategorie einen Namen.';
    if (name.length > MAX_CATEGORY_NAME) return `„${name.slice(0, 20)}…“ ist zu lang – höchstens ${MAX_CATEGORY_NAME} Zeichen.`;
    const key = name.toLocaleLowerCase('de');
    if (seen.has(key)) return `„${name}“ gibt es doppelt. Jede Kategorie braucht einen eigenen Namen.`;
    seen.add(key);
    if (parseLimit(row.limit) === undefined) return `Bitte ein gültiges Limit für „${name}“ eingeben, z. B. 400.`;
  }
  return null;
}

function apiText(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  for (const value of Object.values(body as Record<string, unknown>)) {
    const text = Array.isArray(value) ? value[0] : value;
    if (typeof text === 'string') return text;
  }
  return null;
}

/** „Kategorien verwalten“: umbenennen, Monatslimit, eigene anlegen, löschen. Nichts wird vor „Speichern“ geschrieben;
 * beim Löschen steht vorher da, wie viele Buchungen nach „Sonstiges“ wandern. */
@Component({
  selector: 'app-category-manager',
  imports: [ModalForm, AppIcon],
  templateUrl: './category-manager.html',
  styleUrl: './category-manager.scss',
})
export class CategoryManager {
  private api = inject(PrivateFinanceApi);
  private destroy = inject(DestroyRef);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private injector = inject(Injector);

  readonly open = input.required<boolean>();
  readonly categories = input.required<FinanceCategory[]>();
  readonly transactions = input.required<FinanceTransaction[]>();
  /** Alles gespeichert: Meldung für die Statuszeile. */
  readonly saved = output<string>();
  /** Teilweise gespeichert (Fehler mittendrin): Seite neu laden, Dialog bleibt offen. */
  readonly changed = output<void>();
  readonly closed = output<void>();

  readonly fallback = FALLBACK_CATEGORY;
  readonly maxName = MAX_CATEGORY_NAME;
  readonly rows = signal<CategoryDraft[]>([]);
  readonly saving = signal(false);
  readonly error = signal('');
  private nextKey = 0;

  /** Buchungen je Kategorie — für den Hinweis beim Löschen. */
  readonly usage = computed(() => {
    const counts = new Map<number, number>();
    for (const t of this.transactions()) counts.set(t.category, (counts.get(t.category) ?? 0) + 1);
    return counts;
  });

  constructor() {
    // Nur beim Öffnen frisch aufbauen — ein Neuladen nach Teilerfolg lässt offene Eingaben stehen.
    effect(() => {
      if (!this.open()) return;
      untracked(() => {
        this.rows.set(this.categories().map((c) => this.fromCategory(c)));
        this.error.set('');
      });
    });
  }

  private fromCategory(c: FinanceCategory): CategoryDraft {
    return {
      key: `c${c.id}`,
      id: c.id,
      original: c.name,
      name: c.name,
      limit: c.monthly_goal ? c.monthly_goal.replace('.', ',') : '',
      color: c.color,
      remove: false,
    };
  }

  isFallback(row: CategoryDraft) {
    return row.id !== null && row.original === FALLBACK_CATEGORY;
  }
  movedCount(row: CategoryDraft) {
    return row.id === null ? 0 : (this.usage().get(row.id) ?? 0);
  }
  patch(key: string, change: Partial<CategoryDraft>) {
    this.rows.update((rows) => rows.map((r) => (r.key === key ? { ...r, ...change } : r)));
  }
  add() {
    const key = `n${this.nextKey++}`;
    this.rows.update((rows) => [...rows, { key, id: null, original: '', name: '', limit: '', color: '#8a93a3', remove: false }]);
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLInputElement>(`#cat-name-${key}`)?.focus(), {
      injector: this.injector,
    });
  }
  /** Neue Zeilen verschwinden sofort; bestehende werden nur zum Löschen vorgemerkt. */
  drop(row: CategoryDraft) {
    if (row.id === null) this.rows.update((rows) => rows.filter((r) => r.key !== row.key));
    else this.patch(row.key, { remove: true });
  }

  save() {
    if (this.saving()) return;
    const rows = this.rows();
    const problem = draftProblem(rows);
    if (problem) {
      this.error.set(problem);
      return;
    }
    const byId = new Map(this.categories().map((c) => [c.id, c]));
    const steps: Observable<unknown>[] = [];
    let created = 0;
    let renamed = 0;
    let removed = 0;
    let limits = 0;
    // Erst löschen (macht Namen frei), dann ändern, dann anlegen.
    for (const row of rows.filter((r) => r.remove && r.id !== null)) {
      removed++;
      steps.push(this.api.deleteCategory(row.id!).pipe(tap(() => this.rows.update((all) => all.filter((r) => r.key !== row.key)))));
    }
    for (const row of rows.filter((r) => !r.remove && r.id !== null)) {
      const before = byId.get(row.id!);
      if (!before) continue;
      const name = row.name.trim().replace(/\s+/g, ' ');
      const limit = parseLimit(row.limit) ?? null;
      const payload: { name?: string; monthly_goal?: string | null } = {};
      if (name !== before.name) payload.name = name;
      if ((limit === null ? null : Number(limit)) !== (before.monthly_goal ? Number(before.monthly_goal) : null)) payload.monthly_goal = limit;
      if (!Object.keys(payload).length) continue;
      if (payload.name) renamed++;
      else limits++;
      steps.push(this.api.updateCategory(row.id!, payload));
    }
    for (const row of rows.filter((r) => !r.remove && r.id === null)) {
      created++;
      const payload = { name: row.name.trim().replace(/\s+/g, ' '), monthly_goal: parseLimit(row.limit) ?? null };
      // Angelegte Zeilen bekommen sofort ihre id — ein erneutes Speichern nach einem Fehler legt nichts doppelt an.
      steps.push(this.api.createCategory(payload).pipe(tap((c) => this.patch(row.key, { id: c.id, original: c.name, color: c.color }))));
    }
    if (!steps.length) {
      this.closed.emit();
      return;
    }
    this.saving.set(true);
    this.error.set('');
    concat(...steps)
      .pipe(defaultIfEmpty(null), last(), takeUntilDestroyed(this.destroy))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.saved.emit(summaryText(created, renamed, removed, limits));
        },
        error: (e) => {
          this.saving.set(false);
          this.error.set(
            (e?.status === 400 && apiText(e.error)) || 'Nicht alles konnte gespeichert werden. Bitte prüfe die Angaben und versuche es erneut.',
          );
          this.changed.emit();
        },
      });
  }
}

function summaryText(created: number, renamed: number, removed: number, limits: number): string {
  const parts: string[] = [];
  if (created) parts.push(`${created} neu angelegt`);
  if (renamed) parts.push(`${renamed} umbenannt`);
  if (removed) parts.push(`${removed} gelöscht`);
  if (limits) parts.push(limits === 1 ? '1 Limit geändert' : `${limits} Limits geändert`);
  return `Kategorien gespeichert: ${parts.join(', ')}.`;
}
