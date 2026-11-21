import { Component, DestroyRef, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgTemplateOutlet } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { OnboardingApiService } from '../../core/onboarding/onboarding-api.service';
import { AuthService } from '../../core/auth/auth.service';
import { ACCOUNT_DEFAULT_HOME_CURRENCY } from '../../core/fx/home-currency';
import { Brand } from '../../shared/ui/brand/brand';
import { AppIcon, IconName } from '../../shared/ui/icons/app-icon';
import { AppSelect } from '../../shared/ui/form/select';
import { Field } from '../../shared/ui/form/field';
import { AppDatePicker } from '../../shared/ui/form/date-picker';
import { CURRENCY_OPTIONS } from '../../shared/ui/currency/currencies';
import { Area, Category, FirstEntryService } from './first-entry.service';

type Usage = 'personal' | 'shared';

interface AreaInfo {
  key: Area;
  label: string;
  icon: IconName;
  what: string;
  /** Überschrift für den ersten Eintrag */
  first: string;
}

const AREAS: AreaInfo[] = [
  { key: 'finanzen', label: 'Finanzen', icon: 'finance', what: 'Budget, Ausgaben und Sparziele', first: 'Deine erste Ausgabe' },
  { key: 'haushalt', label: 'Haushalt', icon: 'household', what: 'Aufgaben, Einkauf und Verträge', first: 'Deine erste Haushaltsaufgabe' },
  { key: 'organisation', label: 'Organisation', icon: 'calendar', what: 'Termine, To-dos und Notizen', first: 'Dein erstes To-do' },
  { key: 'reisen', label: 'Reisen', icon: 'travel', what: 'Planung, Packliste und Reisebudget', first: 'Deine erste Reise' },
];

function iso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function inDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return iso(d);
}
/** „12,40“, „12.40“ oder „1.234,50“ → Zahl; ungültig → null */
function parseAmount(raw: string): number | null {
  const text = raw.trim().replace(/\s/g, '');
  if (!text) return null;
  const normalized = text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text;
  const value = Number(normalized);
  return Number.isFinite(value) && value > 0 && value < 1_000_000 ? Math.round(value * 100) / 100 : null;
}

/**
 * Onboarding (Neubau 19.11.2026, inhaltlich neu): kurz und mit echtem Ergebnis statt Erklärseiten.
 * 1 Du — Name, Heimatwährung, allein oder gemeinsam · 2 Bereiche wählen · 3 erster echter Eintrag im gewählten
 * Bereich (oder ohne weiter) · Fertig — zeigt, was angelegt wurde, und führt dorthin.
 * Die Auswahl wird VOR dem ersten Eintrag gespeichert: das Backend sieht das Onboarding sonst wegen der neuen Daten als
 * erledigt an, ohne die Auswahl zu kennen. „Überspringen“ ist auf jedem Schritt möglich.
 */
@Component({
  selector: 'app-onboarding-page',
  standalone: true,
  imports: [Brand, AppIcon, AppSelect, AppDatePicker, Field, NgTemplateOutlet, ReactiveFormsModule, RouterLink],
  templateUrl: './onboarding-page.html',
  styleUrl: './onboarding-page.scss',
})
export class OnboardingPage {
  private readonly api = inject(OnboardingApiService);
  private readonly auth = inject(AuthService);
  private readonly entries = inject(FirstEntryService);
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly heading = viewChild<ElementRef<HTMLElement>>('heading');

  readonly step = signal(1);
  readonly loading = signal(true);
  readonly allowed = signal(false);
  readonly error = signal('');
  readonly saving = signal(false);
  readonly usage = signal<Usage>('personal');
  readonly selected = signal<Area[]>([]);
  readonly entryArea = signal<Area>('finanzen');
  readonly categories = signal<Category[]>([]);
  readonly category = signal<number | null>(null);
  readonly created = signal<{ area: Area; text: string } | null>(null);
  readonly tried = signal(false);

  readonly areas = AREAS;
  readonly currencyOptions = CURRENCY_OPTIONS;
  readonly stages = ['Du', 'Bereiche', 'Erster Eintrag'];

  readonly profile = this.fb.nonNullable.group({
    name: [this.auth.currentUser()?.name ?? '', [Validators.required, Validators.minLength(2), Validators.maxLength(150)]],
    currency: [this.auth.currentUser()?.home_currency ?? ACCOUNT_DEFAULT_HOME_CURRENCY],
  });
  readonly expenseForm = this.fb.nonNullable.group({ amount: ['', Validators.required], note: ['', [Validators.required, Validators.maxLength(120)]] });
  readonly taskForm = this.fb.nonNullable.group({ title: ['', [Validators.required, Validators.maxLength(120)]], due: ['today' as 'today' | 'week' | 'none'] });
  readonly tripForm = this.fb.nonNullable.group({
    destination: ['', [Validators.required, Validators.maxLength(120)]],
    start: [inDays(14), Validators.required],
    end: [inDays(18), Validators.required],
  });

  readonly selectedAreas = computed(() => AREAS.filter((a) => this.selected().includes(a.key)));
  readonly entryInfo = computed(() => AREAS.find((a) => a.key === this.entryArea())!);
  readonly today = iso(new Date());

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api
      .getProfile()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (status) => {
          this.loading.set(false);
          if (!status.needs_onboarding) {
            this.router.navigateByUrl('/', { replaceUrl: true });
            return;
          }
          this.allowed.set(true);
        },
        error: () => {
          this.loading.set(false);
          this.error.set('Dein Einrichtungsstand konnte nicht geladen werden. Bitte versuche es noch einmal.');
        },
      });
  }

  private go(step: number): void {
    this.error.set('');
    this.tried.set(false);
    this.step.set(step);
    setTimeout(() => this.heading()?.nativeElement.focus());
  }

  back(): void {
    if (this.step() > 1 && !this.saving()) this.go(this.step() - 1);
  }

  // ---------- 1 Du ----------
  saveProfile(): void {
    if (this.saving()) return;
    this.tried.set(true);
    if (this.profile.invalid) return;
    const { name, currency } = this.profile.getRawValue();
    const current = this.auth.currentUser();
    const changes: { name?: string; home_currency?: string } = {};
    if (name.trim() !== (current?.name ?? '')) changes.name = name.trim();
    if (currency !== (current?.home_currency ?? ACCOUNT_DEFAULT_HOME_CURRENCY)) changes.home_currency = currency;
    if (!Object.keys(changes).length) {
      this.go(2);
      return;
    }
    this.saving.set(true);
    this.auth.updateProfile(changes).subscribe({
      next: () => {
        this.saving.set(false);
        this.go(2);
      },
      error: () => {
        this.saving.set(false);
        this.error.set('Dein Name konnte nicht gespeichert werden. Bitte versuche es noch einmal.');
      },
    });
  }

  // ---------- 2 Bereiche ----------
  toggle(key: Area): void {
    this.error.set('');
    this.selected.update((list) => (list.includes(key) ? list.filter((x) => x !== key) : [...list, key]));
  }

  saveAreas(): void {
    if (this.saving()) return;
    if (!this.selected().length) {
      this.error.set('Wähle mindestens einen Bereich – du kannst die anderen jederzeit dazunehmen.');
      return;
    }
    // In der Reihenfolge der Bereiche, nicht der Klicks
    const chosen = AREAS.map((a) => a.key).filter((k) => this.selected().includes(k));
    this.saving.set(true);
    this.api
      .complete(this.usage(), chosen)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.entryArea.set(chosen[0]);
          this.prepareEntry(chosen[0]);
          this.go(3);
        },
        error: () => {
          this.saving.set(false);
          this.error.set('Deine Auswahl konnte nicht gespeichert werden. Bitte versuche es noch einmal.');
        },
      });
  }

  // ---------- 3 Erster Eintrag ----------
  chooseEntryArea(area: Area): void {
    this.entryArea.set(area);
    this.error.set('');
    this.tried.set(false);
    this.prepareEntry(area);
  }

  private prepareEntry(area: Area): void {
    if (area !== 'finanzen' || this.categories().length) return;
    this.entries.categories().subscribe({
      next: (list) => {
        this.categories.set(list.slice(0, 6));
        this.category.set(list[0]?.id ?? null);
      },
      error: () => this.categories.set([]),
    });
  }

  saveEntry(): void {
    if (this.saving()) return;
    this.tried.set(true);
    this.error.set('');
    const area = this.entryArea();
    let request: Observable<string> | null = null;
    let text = '';
    if (area === 'finanzen') {
      const amount = parseAmount(this.expenseForm.controls.amount.value);
      if (amount === null || this.expenseForm.controls.note.invalid || this.category() === null) {
        if (this.category() === null) this.error.set('Die Kategorien konnten nicht geladen werden. Bitte versuche es noch einmal.');
        return;
      }
      const note = this.expenseForm.controls.note.value.trim();
      const currency = this.profile.controls.currency.value;
      request = this.entries.expense(amount, note, this.category()!, this.today, currency);
      text = `${amount.toLocaleString('de-DE', { style: 'currency', currency })} für ${note}`;
    } else if (area === 'haushalt' || area === 'organisation') {
      if (this.taskForm.invalid) return;
      const { title, due } = this.taskForm.getRawValue();
      // „Diese Woche“ = bis Sonntag
      const date = due === 'today' ? this.today : due === 'week' ? inDays((7 - new Date().getDay()) % 7) : null;
      request = area === 'haushalt' ? this.entries.chore(title.trim(), date) : this.entries.todo(title.trim(), date);
      text = title.trim();
    } else {
      if (this.tripForm.invalid) return;
      const { destination, start, end } = this.tripForm.getRawValue();
      if (end < start) {
        this.error.set('Das Ende der Reise liegt vor dem Beginn.');
        return;
      }
      request = this.entries.trip(destination.trim(), start, end);
      text = destination.trim();
    }
    this.saving.set(true);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.created.set({ area, text });
        this.go(4);
      },
      error: () => {
        this.saving.set(false);
        this.error.set('Der Eintrag konnte nicht gespeichert werden. Prüf die Angaben und versuch es noch einmal.');
      },
    });
  }

  skipEntry(): void {
    this.created.set(null);
    this.go(4);
  }

  /** Überspringen: Auswahl mit sinnvollen Standards speichern (sonst käme das Onboarding beim nächsten Mal wieder). */
  skipAll(): void {
    if (this.saving()) return;
    const chosen = this.selected().length ? AREAS.map((a) => a.key).filter((k) => this.selected().includes(k)) : AREAS.map((a) => a.key);
    this.saving.set(true);
    this.api.complete(this.usage(), chosen).subscribe({
      next: () => {
        this.saving.set(false);
        this.router.navigateByUrl('/', { replaceUrl: true });
      },
      error: () => {
        this.saving.set(false);
        this.error.set('Das hat nicht geklappt. Bitte versuche es noch einmal.');
      },
    });
  }

  // ---------- Fertig ----------
  finish(): void {
    const created = this.created();
    const chosen = this.selected();
    const target = created ? `/${created.area}` : chosen.length === 1 ? `/${chosen[0]}` : '/';
    this.router.navigateByUrl(target, { replaceUrl: true });
  }

  areaLabel(key: Area): string {
    return AREAS.find((a) => a.key === key)!.label;
  }
  areaIcon(key: Area): IconName {
    return AREAS.find((a) => a.key === key)!.icon;
  }
}
